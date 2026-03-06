import express from 'express';
import {
    getPendingUsers,
    verifyUser,
    manageSafetyRule,
    getSafetyRules,
    logViolation,
    getAuditLogs,
    interveneTask,
    toggleEmergencyMode,
    getSystemConfig,
    getHealthReport,
    triggerManualHealthCheck,
} from '../controllers/admin.controller.js';
import { protect, roleBasedAccess } from '../middleware/auth.middleware.js';

const adminRouter = express.Router();

adminRouter.use(protect);
adminRouter.use(roleBasedAccess(['admin']));
adminRouter.get('/pending-users', getPendingUsers);
adminRouter.post('/verify-user', verifyUser);
adminRouter.post('/safety-rules', manageSafetyRule);
adminRouter.get('/safety-rules', getSafetyRules);
adminRouter.post('/log-violation', logViolation);
adminRouter.get('/audit-logs', getAuditLogs);
adminRouter.post('/intervene-task', interveneTask);
adminRouter.post('/emergency-mode', toggleEmergencyMode);
adminRouter.get('/system-config', getSystemConfig);
adminRouter.get('/health', getHealthReport);
adminRouter.post('/health-check', triggerManualHealthCheck);

export default adminRouter;
