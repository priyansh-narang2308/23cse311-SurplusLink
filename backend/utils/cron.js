import cron from 'node-cron';
import https from 'https';
import Donation from '../models/Donation.model.js';
import User from '../models/User.model.js';
import { findSuitableVolunteers } from '../services/matching.service.js';
import { reassignMission } from '../controllers/donation.controller.js';
import { createNotification } from './notification.js';
import { checkSystemAnomalies } from './healthMonitor.js';

/**
 * @desc    Initialize Background Service Supervisor
 * @description Orchestrates system-wide health checks, logistics automation, and automated mission management.
 */
const setupCronJobs = () => {
    /**
     * Keep-alive Heartbeat
     * Frequency: Every 14 minutes (Optimized for Render/Heroku spin-down prevention)
     */
    cron.schedule('*/14 * * * *', () => {
        const backendUrl = process.env.RENDER_EXTERNAL_URL;
        if (backendUrl) {
            https.get(backendUrl, (res) => {
                console.log(`[Heartbeat] Ping successful: ${res.statusCode}`);
            }).on('error', (e) => {
                console.error(`[Heartbeat] Ping failed: ${e.message}`);
            });
        }
    });

    /**
     * System Health & Anomaly Watchdog
     * Frequency: Every 10 minutes
     * Logic: Monitoring CPU and DB health, alerting admins on failures.
     */
    cron.schedule('*/10 * * * *', async () => {
        console.log('[Cron] System Health Check: Searching for anomalies...');
        try {
            await checkSystemAnomalies();
        } catch (error) {
            console.error('[Health Cron] Monitoring failed:', error);
        }
    });

    /**
     * Mission Safety Supervisor
     * Frequency: Every 5 minutes
     * Logic: Auto-unassigns volunteers who are inactive (15m+) or overdue (20m+ beyond ETA).
     */
    cron.schedule('*/5 * * * *', async () => {
        console.log('[Cron] System Supervisor: Checking for stalled missions...');
        try {
            const now = new Date();
            const tenMinsAgo = new Date(now.getTime() - 10 * 60000); // Nudge threshold
            const fifteenMinsAgo = new Date(now.getTime() - 15 * 60000); // Reassignment threshold
            const etaThreshold = 20 * 60000; // 20 minutes allowance

            const activeMissions = await Donation.find({
                status: 'assigned',
                deliveryStatus: { $nin: ['idle', 'delivered'] },
                volunteer: { $exists: true }
            }).populate('volunteer').populate('claimedBy');

            for (const mission of activeMissions) {
                const vol = mission.volunteer;
                if (!vol) continue;

                const lastHeartbeat = vol.volunteerProfile?.lastLocationUpdate || vol.updatedAt;

                // 1. Nudge Logic (Warning)
                if (lastHeartbeat < tenMinsAgo && lastHeartbeat > fifteenMinsAgo) {
                    await createNotification(
                        vol._id,
                        'mission_nudge',
                        'mission_nudge',
                        mission._id,
                        { title: mission.title }
                    );
                }

                // 2. Delay Alert & Escalation Logic (Critical)
                const isHeartbeatStalled = lastHeartbeat < fifteenMinsAgo;
                const isETAExceeded = mission.estimatedArrivalAt &&
                    (now.getTime() > new Date(mission.estimatedArrivalAt).getTime() + etaThreshold);

                if (isHeartbeatStalled || isETAExceeded) {
                    const reason = isHeartbeatStalled ? 'Heartbeat Timeout (Inactivity)' : 'ETA Violation (Overdue)';
                    console.log(`[Supervisor] Escalating mission ${mission._id}: ${reason}`);

                    // Notify NGO about the delay
                    if (mission.claimedBy) {
                        await createNotification(
                            mission.claimedBy._id,
                            'mission_delayed',
                            'mission_delayed',
                            mission._id,
                            { title: mission.title }
                        );
                    }

                    // Trigger Escalation: Reassign Mission
                    await reassignMission(mission._id, `System Escalation: ${reason}`);
                }
            }
        } catch (error) {
            console.error('[Supervisor] Error in health checks:', error);
        }
    });

    /**
     * Automatic Expiration Watchdog
     * Frequency: Every 15 minutes
     * Logic: Marks donations as 'expired' if the current time exceeds expiryDate.
     */
    cron.schedule('*/15 * * * *', async () => {
        console.log('[Cron] Checking for expired donations...');
        try {
            const expiredDonations = await Donation.find({
                status: 'active',
                expiryDate: { $lt: new Date() }
            });

            for (const donation of expiredDonations) {
                donation.status = 'expired';

                // Update timeline
                donation.addStatusHistory(null, 'Donation expired: Pickup window has passed.');
                await donation.save();

                await createNotification(
                    donation.donor,
                    'donation_expired',
                    'donation_expired',
                    donation._id,
                    { title: donation.title }
                );
                console.log(`[Cron] Expired donation: ${donation._id}`);
            }
        } catch (err) {
            console.error('[Cron] Expiration task failed:', err);
        }
    });

    /**
     * Tiered Dispatch Expansion Engine
     * Frequency: Every 2 minutes
     * Logic: Expands radius to 20km for donations unclaimed for > 5 minutes.
     */
    cron.schedule('*/2 * * * *', async () => {
        console.log('[Cron] Checking for mission radius expansion...');
        try {
            const now = new Date();
            const fiveMinsAgo = new Date(now.getTime() - 5 * 60000);

            const stuckMissions = await Donation.find({
                status: 'assigned',
                deliveryStatus: 'idle',
                claimedAt: { $lt: fiveMinsAgo },
            });

            for (const donation of stuckMissions) {
                console.log(`[Cron] Expanding radius for donation ${donation._id}`);
                const expandedVolunteers = await findSuitableVolunteers(donation, 20000);

                if (expandedVolunteers.length > 0) {
                    const top3 = expandedVolunteers.slice(0, 3);
                    donation.dispatchedTo = top3.map(v => v._id);
                    donation.dispatchedAt = new Date();

                    // Update timeline
                    donation.addStatusHistory(null, 'Mission radius expanded: Alerting more volunteers in 20km radius.');
                    await donation.save();

                    for (const v of top3) {
                        await createNotification(
                            v._id,
                            'priority_dispatch',
                            'priority_dispatch',
                            donation._id,
                            {
                                title: donation.title,
                                foodType: donation.foodType,
                                quantity: donation.quantity,
                                distance: (v.distance / 1000).toFixed(1)
                            }
                        );
                    }
                }
            }
        } catch (err) {
            console.error('[Cron] Radius expansion failed:', err);
        }
    });
};

export default setupCronJobs;
