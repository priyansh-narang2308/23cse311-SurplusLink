import Donation from '../models/Donation.model.js';
import AuditLog from '../models/AuditLog.model.js';

/**
 * @desc    Bulk Sync Offline Actions
 * @route   POST /api/v1/sync/bulk
 * @access  Private
 * @description Processes a list of actions performed while offline.
 *              Uses syncKey for idempotency and clientUpdatedAt for conflict resolution.
 */
export const syncBulkActions = async (req, res, next) => {
    try {
        const { actions } = req.body; // Array of { type, data, syncKey, clientUpdatedAt }

        if (!actions || !Array.isArray(actions)) {
            return res.status(400).json({ message: 'No actions provided for sync.' });
        }

        const results = {
            success: [],
            skipped: [],
            errors: []
        };

        for (const action of actions) {
            const { type, data, syncKey, clientUpdatedAt } = action;

            try {
                // IDEMPOTENCY CHECK: If syncKey already exists, we might skip or update
                const existing = await Donation.findOne({ syncKey });

                if (existing) {
                    // Conflict Resolution: Only update if current action is newer than what we have
                    if (new Date(clientUpdatedAt) > new Date(existing.clientUpdatedAt || 0)) {
                        Object.assign(existing, data);
                        existing.clientUpdatedAt = clientUpdatedAt;
                        await existing.save();
                        results.success.push({ syncKey, status: 'updated' });
                    } else {
                        results.skipped.push({ syncKey, reason: 'stale_data' });
                    }
                    continue;
                }

                // PROCESS ACTION TYPES
                if (type === 'CREATE_DONATION') {
                    const newDonation = await Donation.create({
                        ...data,
                        donor: req.user._id,
                        syncKey,
                        clientUpdatedAt
                    });
                    results.success.push({ syncKey, id: newDonation._id, status: 'created' });
                } else if (type === 'UPDATE_STATUS') {
                    const donation = await Donation.findById(data.donationId);
                    if (donation) {
                        donation.status = data.status || donation.status;
                        donation.deliveryStatus = data.deliveryStatus || donation.deliveryStatus;
                        donation.syncKey = syncKey;
                        donation.clientUpdatedAt = clientUpdatedAt;
                        donation.addStatusHistory(req.user._id, 'Sync from offline mode');
                        await donation.save();
                        results.success.push({ syncKey, status: 'synced_status' });
                    } else {
                        results.errors.push({ syncKey, error: 'Donation not found' });
                    }
                }
            } catch (err) {
                console.error(`Sync Error for key ${syncKey}:`, err);
                results.errors.push({ syncKey, error: err.message });
            }
        }

        // Audit Log for Sync Operation
        await AuditLog.create({
            action: 'OFFLINE_SYNC_BULK',
            category: 'system',
            userId: req.user._id,
            metadata: {
                actionCount: actions.length,
                successCount: results.success.length,
                errorCount: results.errors.length
            }
        });

        res.json(results);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delta Sync for Offline Data
 * @route   GET /api/v1/sync/delta
 * @access  Private
 * @description Fetches all records updated after a specific timestamp.
 */
export const getDeltaSync = async (req, res, next) => {
    try {
        const { lastSyncAt } = req.query;
        const since = lastSyncAt ? new Date(lastSyncAt) : new Date(0);

        const updatedDonations = await Donation.find({
            updatedAt: { $gt: since }
        }).sort({ updatedAt: 1 });

        res.json({
            timestamp: new Date(),
            donations: updatedDonations
        });
    } catch (error) {
        next(error);
    }
};
