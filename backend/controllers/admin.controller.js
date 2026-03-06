import User from '../models/User.model.js';
import SafetyRule from '../models/SafetyRule.model.js';
import VerificationLog from '../models/VerificationLog.model.js';
import ViolationLog from '../models/ViolationLog.model.js';
import AuditLog from '../models/AuditLog.model.js';
import Donation from '../models/Donation.model.js';
import SystemConfig from '../models/SystemConfig.model.js';
import { createNotification } from '../utils/notification.js';

/**
 * @desc    Toggle Emergency Mode
 * @route   POST /api/v1/admin/emergency-mode
 * @access  Private/Admin
 */
export const toggleEmergencyMode = async (req, res, next) => {
    try {
        const { enabled, reason, affectedZones, priorityRadius } = req.body;

        let config = await SystemConfig.findOne();
        if (!config) {
            config = new SystemConfig();
        }

        const wasEnabled = config.emergencyMode.enabled;

        config.emergencyMode = {
            enabled,
            activatedAt: enabled ? new Date() : config.emergencyMode.activatedAt,
            activatedBy: enabled ? req.user._id : config.emergencyMode.activatedBy,
            reason: reason || config.emergencyMode.reason,
            affectedZones: affectedZones || config.emergencyMode.affectedZones,
            priorityRadius: priorityRadius || config.emergencyMode.priorityRadius,
        };

        // If newly enabled, create a global broadcast alert
        if (enabled && !wasEnabled) {
            config.broadcastMessage = {
                text: `🚨 EMERGENCY MODE ACTIVATED: ${reason || 'Prioritizing crisis zones.'}`,
                active: true,
                updatedAt: new Date()
            };

            // Notify all active NGOs and Volunteers (Broadcast)
            const stakeholders = await User.find({
                role: { $in: ['ngo', 'volunteer'] },
                status: 'active'
            }).select('_id');

            for (const person of stakeholders) {
                await createNotification(
                    person._id,
                    'emergency_mode_alert',
                    'general',
                    null,
                    { reason: reason || 'Urgent logistics prioritization in effect.' }
                );
            }
        } else if (!enabled && wasEnabled) {
            config.broadcastMessage.active = false;
        }

        await config.save();

        // Audit Log
        await AuditLog.create({
            action: `EMERGENCY_MODE_${enabled ? 'ENABLED' : 'DISABLED'}`,
            category: 'system',
            userId: req.user._id,
            metadata: { reason, affectedZones },
        });

        res.json({
            message: `Emergency mode ${enabled ? 'activated' : 'deactivated'} successfully.`,
            config: config.emergencyMode
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get Current System Config
 * @route   GET /api/v1/admin/system-config
 * @access  Private/Admin
 */
export const getSystemConfig = async (req, res, next) => {
    try {
        let config = await SystemConfig.findOne();
        if (!config) {
            config = await SystemConfig.create({});
        }
        res.json(config);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all pending users for verification
 * @route   GET /api/v1/admin/pending-users
 * @access  Private/Admin
 */
export const getPendingUsers = async (req, res, next) => {
    try {
        const users = await User.find({ status: 'pending' }).select('-password');
        res.json(users);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Verify/Approve a user
 * @route   POST /api/v1/admin/verify-user
 * @access  Private/Admin
 */
export const verifyUser = async (req, res, next) => {
    try {
        const { userId, status, remarks } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        user.status = status === 'approved' ? 'active' : 'rejected';
        user.isVerified = status === 'approved';
        await user.save();

        await VerificationLog.create({
            userId,
            adminId: req.user._id,
            status,
            remarks,
        });

        // Audit Log
        await AuditLog.create({
            action: `USER_VERIFICATION_${status.toUpperCase()}`,
            category: 'verification',
            userId: req.user._id,
            metadata: { targetUserId: userId, remarks },
        });

        // 🔔 Notify User
        await createNotification(
            userId,
            'account_verify',
            'general',
            null,
            { status }
        );

        res.json({ message: `User ${status} successfully` });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Manage Safety Rules (Create/Update)
 * @route   POST /api/v1/admin/safety-rules
 * @access  Private/Admin
 */
export const manageSafetyRule = async (req, res, next) => {
    try {
        const { foodType, maxDurationHours, storageRequired } = req.body;

        const rule = await SafetyRule.findOneAndUpdate(
            { foodType },
            { maxDurationHours, storageRequired, isActive: true },
            { upsert: true, new: true }
        );

        // Audit Log
        await AuditLog.create({
            action: 'MANAGE_SAFETY_RULE',
            category: 'safety',
            userId: req.user._id,
            metadata: { rule },
        });

        res.json(rule);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all safety rules
 * @route   GET /api/v1/admin/safety-rules
 * @access  Private/Admin
 */
export const getSafetyRules = async (req, res, next) => {
    try {
        const rules = await SafetyRule.find();
        res.json(rules);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Log a violation for a user
 * @route   POST /api/v1/admin/log-violation
 * @access  Private/Admin
 */
export const logViolation = async (req, res, next) => {
    try {
        const { userId, violationType, actionTaken, description, severity } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        user.violationCount += 1;

        // Auto-suspension threshold
        if (user.violationCount >= 3) {
            user.status = 'deactivated';
        }

        await user.save();

        const violation = await ViolationLog.create({
            userId,
            adminId: req.user._id,
            violationType,
            actionTaken,
            description,
            severity,
        });

        // Audit Log
        await AuditLog.create({
            action: 'LOG_VIOLATION',
            category: 'user',
            userId: req.user._id,
            metadata: { targetUserId: userId, violationId: violation._id, actionTaken },
        });

        res.json({
            message: 'Violation logged successfully',
            violationCount: user.violationCount,
            accountStatus: user.status
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get Audit Logs
 * @route   GET /api/v1/admin/audit-logs
 * @access  Private/Admin
 */
export const getAuditLogs = async (req, res, next) => {
    try {
        const logs = await AuditLog.find()
            .populate('userId', 'name email role')
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(logs);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Admin Intervention (Cancel/Reassign donation task)
 * @route   POST /api/v1/admin/intervene-task
 * @access  Private/Admin
 */
export const interveneTask = async (req, res, next) => {
    try {
        const { donationId, action, reason } = req.body;

        const donation = await Donation.findById(donationId)
            .populate('donor')
            .populate('claimedBy')
            .populate('volunteer');

        if (!donation) {
            res.status(404);
            throw new Error('Donation task not found');
        }

        const oldVolunteer = donation.volunteer;
        const oldNgo = donation.claimedBy;

        if (action === 'cancel') {
            donation.status = 'active';
            donation.claimedBy = null;
            donation.volunteer = null;
            donation.deliveryStatus = 'idle';
        } else if (action === 'reassign') {
            donation.claimedBy = null;
            donation.volunteer = null;
            donation.status = 'active';
            donation.deliveryStatus = 'idle';
        } else if (action === 'pause') {
            // Future requirement: pause logic
            donation.status = 'active'; // Temporarily reset to active but could be a 'paused' state
        }

        await donation.save();

        // 🔔 Notify Stakeholders of intervention
        const participants = [donation.donor, oldNgo, oldVolunteer].filter(Boolean);
        for (const participant of participants) {
            await createNotification(
                participant._id,
                'admin_intervention',
                'general',
                donation._id,
                { title: donation.title, action, reason }
            );
        }

        // Audit Log
        await AuditLog.create({
            action: `ADMIN_INTERVENTION_${action.toUpperCase()}`,
            category: 'donation',
            userId: req.user._id,
            metadata: { donationId, reason, action, affectedUsers: participants.map(p => p._id) },
        });

        res.json({ message: `Task ${action}ed successfully and stakeholders notified.` });
    } catch (error) {
        next(error);
    }
};
