import os from 'os';
import osUtils from 'os-utils';
import mongoose from 'mongoose';
import SystemConfig from '../models/SystemConfig.model.js';
import User from '../models/User.model.js';
import { createNotification } from './notification.js';

/**
 * @desc    Collects detailed system health metrics
 */
export const getSystemHealth = async () => {
    const memoryUsage = process.memoryUsage();

    // Database check
    const dbStatus = mongoose.connection.readyState === 1 ? 'Healthy' : 'Disconnected';

    // CPU Usage (Async)
    const cpuUsage = await new Promise((resolve) => {
        osUtils.cpuUsage((value) => resolve((value * 100).toFixed(2)));
    });

    return {
        status: dbStatus === 'Healthy' ? 'Healthy' : 'Critical',
        timestamp: new Date(),
        uptime: process.uptime(),
        system: {
            platform: os.platform(),
            cpuUsage: `${cpuUsage}%`,
            freeMem: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
            totalMem: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`
        },
        process: {
            memoryRSS: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
            memoryHeapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
        },
        database: {
            status: dbStatus
        }
    };
};

/**
 * @desc    Checks for health anomalies and alerts admins
 */
export const checkSystemAnomalies = async () => {
    const health = await getSystemHealth();
    const cpuVal = parseFloat(health.system.cpuUsage);

    let anomalyDetected = false;
    let anomalyReason = '';

    // 1. Critical DB Failure
    if (health.database.status !== 'Healthy') {
        anomalyDetected = true;
        anomalyReason = 'DATABASE_DISCONNECTED';
    }

    // 2. High CPU Usage (> 85%)
    if (cpuVal > 85) {
        anomalyDetected = true;
        anomalyReason = 'HIGH_CPU_USAGE';
    }

    if (anomalyDetected) {
        console.error(`🚨 System Anomaly Detected: ${anomalyReason}`);

        // Notify Admins
        const admins = await User.find({ role: 'admin' }).select('_id');
        for (const admin of admins) {
            await createNotification(
                admin._id,
                `SYSTEM_ALERT: ${anomalyReason}`,
                'general',
                null,
                { reason: anomalyReason, value: cpuVal }
            );
        }

        // Potential Action: Trigger Emergency Mode if DB is down
        if (anomalyReason === 'DATABASE_DISCONNECTED') {
            const config = await SystemConfig.findOne();
            if (config && !config.emergencyMode.enabled) {
                // We don't auto-enable but we could theoretically
                console.log('Action Suggestion: Manual Emergency Mode activation recommended.');
            }
        }
    }

    return { anomalyDetected, anomalyReason };
};
