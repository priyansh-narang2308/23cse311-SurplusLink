import express from 'express';
import { getDonationReport, getNgoUtilizationReport, getVolunteerPerformanceReport } from '../controllers/report.controller.js';
import { protect, roleBasedAccess } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/donations', protect, roleBasedAccess(['admin', 'donor']), getDonationReport);
router.get('/ngo-utilization', protect, roleBasedAccess(['admin', 'ngo']), getNgoUtilizationReport);
router.get('/volunteer-performance', protect, roleBasedAccess(['admin']), getVolunteerPerformanceReport);

export default router;
