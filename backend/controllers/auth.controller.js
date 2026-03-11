/**
 * @module Authentication & Profile Management
 * @author Priyansh Narang
 * @description This module handles the registration, login, and secure session management 
 * for all user roles (Donor, NGO, Volunteer). It includes OTP verification and 
 * role-based access control initialization.
 */

import User from '../models/User.model.js';
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/email.js';
import crypto from 'crypto';

/**
 * @desc    Register a new user (Donor, NGO, or Volunteer)
 * @route   POST /api/v1/auth/signup
 * @access  Public
 */
const signupUser = async (req, res, next) => {
    const { name, email, password, role, organization } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            res.status(400);
            throw new Error('User already exists');
        }

        if ((role === 'ngo' || role === 'donor') && !organization) {
            res.status(400);
            throw new Error('Organization/Business name is required for NGOs and Donors');
        }

        const validRoles = ['donor', 'ngo', 'volunteer', 'admin'];
        if (!validRoles.includes(role)) {
            res.status(400);
            throw new Error('Invalid role');
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        const user = await User.create({
            name,
            email,
            password,
            role,
            status: (role === 'volunteer' || role === 'admin') ? 'active' : 'pending',
            organization: (role === 'ngo' || role === 'donor') ? organization : undefined,
            otp,
            otpExpires
        });

        if (user) {
            const emailTemplate = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; color: white; }
                        .header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px; }
                        .content { padding: 40px 30px; text-align: center; }
                        .otp-box { background: #f0fdf4; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; margin: 30px 0; display: inline-block; }
                        .otp-code { font-size: 42px; font-weight: bold; color: #047857; letter-spacing: 5px; margin: 0; }
                        .message { font-size: 16px; color: #4b5563; margin-bottom: 20px; }
                        .expiry { color: #6b7280; font-size: 14px; margin-top: 15px; }
                        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>SurplusLink</h1>
                        </div>
                        <div class="content">
                            <h2 style="color: #111827; margin-top: 0;">Welcome Aboard!</h2>
                            <p class="message">Thank you for registering. Please verify your email address to continue:</p>
                            
                            <div class="otp-box">
                                <p class="otp-code">${otp}</p>
                            </div>
                            
                            <p class="expiry">This code is valid for <strong>10 minutes</strong>.</p>
                        </div>
                        <div class="footer">
                            &copy; ${new Date().getFullYear()} SurplusLink. All rights reserved.
                        </div>
                    </div>
                </body>
                </html>
            `;

            sendEmail({
                email: user.email,
                subject: 'Verify Your Email Address',
                message: `Your verification code is: ${otp}`,
                html: emailTemplate
            }).catch(err => console.error("Failed to send welcome OTP email:", err));

            res.status(201).json({
                success: true,
                message: 'Registration successfull! Please verify your email.',
                requiresOtp: true,
                email: user.email,
                devOtp: otp,
                token: generateToken(user._id, user.role)
            });
        } else {
            res.status(400);
            throw new Error('Invalid user data');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Authenticate user and set secure session cookie
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const loginUser = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            if (user.status === 'deactivated') {
                res.status(401);
                throw new Error('User account is deactivated');
            }

            const token = generateToken(user._id, user.role);

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: 30 * 24 * 60 * 60 * 1000
            });

            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                organization: user.organization,
                status: user.status,
                avatar: user.avatar,
                createdAt: user.createdAt,
                isOnline: user.isOnline,
                volunteerProfile: user.volunteerProfile,
                token: token
            });
        } else {
            res.status(401);
            throw new Error('Invalid email or password');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Logout user and clear session cookie
 * @route   POST /api/v1/auth/logout
 * @access  Public
 */
const logoutUser = async (req, res, next) => {
    try {
        res.cookie('token', '', {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            expires: new Date(0),
        });
        res.status(200).json({ success: true, message: 'Successfully logged out' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Generate and send dynamic Login OTP
 * @route   POST /api/v1/auth/send-otp
 * @access  Public
 */
const sendOTP = async (req, res, next) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        const message = `Your SurplusLink verification code is: ${otp}\n\nThis code expires in 10 minutes.`;

        const emailTemplate = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; color: white; }
                    .header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px; }
                    .content { padding: 40px 30px; text-align: center; }
                    .otp-box { background: #f0fdf4; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; margin: 30px 0; display: inline-block; }
                    .otp-code { font-size: 42px; font-weight: bold; color: #047857; letter-spacing: 5px; margin: 0; }
                    .message { font-size: 16px; color: #4b5563; margin-bottom: 20px; }
                    .expiry { color: #6b7280; font-size: 14px; margin-top: 15px; }
                    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>SurplusLink</h1>
                    </div>
                    <div class="content">
                        <h2 style="color: #111827; margin-top: 0;">Login Verification</h2>
                        <p class="message">Enter the following verification code to access your account:</p>
                        
                        <div class="otp-box">
                            <p class="otp-code">${otp}</p>
                        </div>
                        
                        <p class="expiry">This code is valid for <strong>10 minutes</strong>.<br>If you didn't request this, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        &copy; ${new Date().getFullYear()} SurplusLink. All rights reserved.
                    </div>
                </div>
            </body>
            </html>
        `;

        sendEmail({
            email: user.email,
            subject: 'Your Login Verification Code',
            message,
            html: emailTemplate
        }).catch(error => console.error("Failed to send OTP email:", error));

        res.status(200).json({ success: true, message: 'OTP sent to email', devOtp: otp });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Validate OTP and initiate session
 * @route   POST /api/v1/auth/verify-otp
 * @access  Public
 */
const verifyOTP = async (req, res, next) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({
            email,
            otp,
            otpExpires: { $gt: Date.now() }
        });

        if (!user) {
            res.status(400);
            throw new Error('Invalid or expired OTP');
        }

        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        if (user.status === 'deactivated') {
            res.status(401);
            throw new Error('User account is deactivated');
        }

        const token = generateToken(user._id, user.role);

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            organization: user.organization,
            status: user.status,
            avatar: user.avatar,
            createdAt: user.createdAt,
            isOnline: user.isOnline,
            volunteerProfile: user.volunteerProfile,
            token: token
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Request password reset link
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
async function forgotPassword(req, res, next) {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            res.status(404);
            throw new Error('User not found with this email');
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

        await user.save();

        res.json({
            success: true,
            message: 'Reset link generated',
            resetToken: resetToken
        });
    } catch (error) {
        next(error);
    }
}

/**
 * @desc    Reset password using valid token
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
async function resetPassword(req, res, next) {
    const { password } = req.body;
    const { token } = req.params;

    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            res.status(400);
            throw new Error('Invalid or expired reset token');
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ success: true, message: 'Password reset successfull' });
    } catch (error) {
        next(error);
    }
}

export { signupUser, loginUser, logoutUser, forgotPassword, resetPassword, sendOTP, verifyOTP };

