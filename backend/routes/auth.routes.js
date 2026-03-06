import express from 'express';
import {
    signupUser,
    loginUser,
    logoutUser,
    forgotPassword,
    resetPassword,
    sendOTP,
    verifyOTP,
} from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const authRouter = express.Router();

authRouter.post('/signup', authLimiter, signupUser);
authRouter.post('/login', authLimiter, loginUser);
authRouter.post('/logout', logoutUser);
authRouter.post('/forgot-password', authLimiter, forgotPassword);
authRouter.post('/reset-password/:token', authLimiter, resetPassword);
authRouter.post('/send-otp', authLimiter, sendOTP);
authRouter.post('/verify-otp', authLimiter, verifyOTP);

export default authRouter;
