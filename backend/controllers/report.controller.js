import Donation from '../models/Donation.model.js';
import User from '../models/User.model.js';
import mongoose from 'mongoose';

/**
 * @desc    Generate a detailed donation activity report with filtering
 * @route   GET /api/v1/reports/donations
 * @access  Private (Admin, Donor)
 * @description Supports multi-dimensional filtering by date range, status, and donor ID (admin only).
 */
const getDonationReport = async (req, res, next) => {
    try {
        const { startDate, endDate, status, donorId } = req.query;

        let query = {};

        // Security logic: Donors only see their own donations
        if (req.user.role === 'donor') {
            query.donor = new mongoose.Types.ObjectId(req.user.id);
        } else if (req.user.role === 'admin') {
            // Admin can filter by donorId if provided
            if (donorId) {
                query.donor = new mongoose.Types.ObjectId(donorId);
            }
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by date range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        const report = await Donation.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'users',
                    localField: 'donor',
                    foreignField: '_id',
                    as: 'donorDetails',
                },
            },
            { $unwind: '$donorDetails' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'claimedBy',
                    foreignField: '_id',
                    as: 'ngoDetails',
                },
            },
            {
                $unwind: {
                    path: '$ngoDetails',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    _id: 0,
                    donationId: '$_id',
                    donorName: '$donorDetails.name',
                    donorOrg: '$donorDetails.organization',
                    recipientNgo: '$ngoDetails.organization',
                    foodType: 1,
                    quantity: 1,
                    status: 1,
                    expiryDate: 1,
                    pickupWindow: 1,
                    createdAt: 1,
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        res.status(200).json(report);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Generate a detailed NGO utilization and performance report
 * @route   GET /api/v1/reports/ngo-utilization
 * @access  Private (Admin, NGO)
 * @description Aggregates NGO performance metrics including claim rates, success rates, 
 *              capacity usage, and rejection analysis.
 */
const getNgoUtilizationReport = async (req, res, next) => {
    try {
        const { ngoId, startDate, endDate } = req.query;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Security Filtering: NGOs only see their own data; Admins see all or filtered
        let userMatch = { role: 'ngo' };
        if (req.user.role === 'ngo') {
            userMatch._id = new mongoose.Types.ObjectId(req.user.id);
        } else if (req.user.role === 'admin' && ngoId) {
            userMatch._id = new mongoose.Types.ObjectId(ngoId);
        }

        // Logic & Aggregation Pipeline
        // Starting with User (NGOs) to ensure we include those with zero claims
        const report = await User.aggregate([
            { $match: userMatch },
            {
                $lookup: {
                    from: 'donations',
                    localField: '_id',
                    foreignField: 'claimedBy',
                    as: 'claims',
                },
            },
            {
                $unwind: {
                    path: '$claims',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $addFields: {
                    // Check if the claim falls within the requested date range
                    isInRange: {
                        $and: [
                            { $ne: ['$claims', null] },
                            startDate ? { $gte: ['$claims.claimedAt', new Date(startDate)] } : true,
                            endDate ? { $lte: ['$claims.claimedAt', new Date(endDate)] } : true,
                        ],
                    },
                    // Check if the claim happened in the last 24h for capacity monitoring
                    isLast24h: {
                        $and: [
                            { $ne: ['$claims', null] },
                            { $gte: ['$claims.claimedAt', oneDayAgo] },
                        ],
                    },
                    // Parse quantity string to numeric value (e.g., "10.5 kg" -> 10.5)
                    claimQty: {
                        $convert: {
                            input: {
                                $getField: {
                                    field: "match",
                                    input: {
                                        $regexFind: {
                                            input: { $ifNull: [{ $toString: "$claims.quantity" }, "0"] },
                                            regex: "[0-9]+(\\.[0-9]+)?"
                                        }
                                    }
                                }
                            },
                            to: "double",
                            onError: 0.0,
                            onNull: 0.0
                        }
                    }
                },
            },
            {
                $group: {
                    _id: '$_id',
                    organization: { $first: '$organization' },
                    dailyCapacity: { $first: '$ngoProfile.dailyCapacity' },
                    totalClaims: {
                        $sum: { $cond: ['$isInRange', 1, 0] }
                    },
                    completed: {
                        $sum: { $cond: [{ $and: ['$isInRange', { $eq: ['$claims.status', 'completed'] }] }, 1, 0] }
                    },
                    rejected: {
                        $sum: { $cond: [{ $and: ['$isInRange', { $eq: ['$claims.status', 'rejected'] }] }, 1, 0] }
                    },
                    urgentRescues: {
                        $sum: { $cond: [{ $and: ['$isInRange', { $eq: ['$claims.perishability', 'high'] }] }, 1, 0] }
                    },
                    last24hVolume: {
                        $sum: { $cond: ['$isLast24h', '$claimQty', 0] }
                    },
                    rejectionReasons: {
                        $push: {
                            $cond: [{ $and: ['$isInRange', { $eq: ['$claims.status', 'rejected'] }, { $ne: ['$claims.rejectionReason', null] }] }, '$claims.rejectionReason', '$$REMOVE']
                        }
                    },
                    dailyStats: {
                        $push: {
                            $cond: [
                                '$isInRange',
                                {
                                    date: { $dateToString: { format: '%Y-%m-%d', date: '$claims.claimedAt' } },
                                    units: '$claimQty'
                                },
                                '$$REMOVE'
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    ngoId: '$_id',
                    organization: 1,
                    summary: {
                        totalClaims: '$totalClaims',
                        completed: '$completed',
                        rejected: '$rejected',
                        utilizationRate: {
                            $cond: [
                                { $gt: ['$dailyCapacity', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$last24hVolume', '$dailyCapacity'] }, 100] }, 0] },
                                0
                            ]
                        },
                        urgentRescues: '$urgentRescues'
                    },
                    rejectionReasons: 1,
                    dailyStats: 1,
                    dailyCapacity: 1
                }
            }
        ]);

        // Post-aggregation formatting to match standard frontend structures
        const formattedResults = report.map(r => {
            // rejectionBreakdown count
            const reasonsMap = {};
            r.rejectionReasons?.forEach(reason => {
                reasonsMap[reason] = (reasonsMap[reason] || 0) + 1;
            });

            // dailyUtilization group by date
            const dailyMap = {};
            r.dailyStats?.forEach(stat => {
                dailyMap[stat.date] = (dailyMap[stat.date] || 0) + stat.units;
            });

            return {
                ngoId: r.ngoId,
                ngoName: r.organization,
                summary: r.summary,
                rejectionBreakdown: Object.entries(reasonsMap).map(([reason, count]) => ({ reason, count })),
                dailyUtilization: Object.entries(dailyMap).map(([date, units]) => ({
                    date,
                    units: parseFloat(units.toFixed(1)),
                    capacity: r.dailyCapacity
                })).sort((a, b) => a.date.localeCompare(b.date))
            };
        });

        // Return single object for specific NGO, else return array (Master List)
        if (req.user.role === 'ngo' || (req.user.role === 'admin' && ngoId)) {
            res.status(200).json(formattedResults[0] || {
                summary: { totalClaims: 0, completed: 0, rejected: 0, utilizationRate: 0, urgentRescues: 0 },
                rejectionBreakdown: [],
                dailyUtilization: []
            });
        } else {
            res.status(200).json(formattedResults);
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Generate a high-fidelity logistics report for volunteer performance
 * @route   GET /api/v1/reports/volunteer-performance
 * @access  Private (Admin only)
 * @description Aggregates volunteer mission metrics, logistics efficiency, and tier correlation.
 */
const getVolunteerPerformanceReport = async (req, res, next) => {
    try {
        const { volunteerId, period } = req.query;

        // Calculate period start date
        let periodStartDate = new Date(0); // Default to all time
        const now = new Date();
        if (period === 'last_7_days') {
            periodStartDate = new Date(now.setDate(now.getDate() - 7));
        } else if (period === 'last_30_days') {
            periodStartDate = new Date(now.setDate(now.getDate() - 30));
        }

        let userMatch = { role: 'volunteer' };
        if (volunteerId) {
            userMatch._id = new mongoose.Types.ObjectId(volunteerId);
        }

        const report = await User.aggregate([
            { $match: userMatch },
            {
                $lookup: {
                    from: 'donations',
                    localField: '_id',
                    foreignField: 'volunteer',
                    as: 'missions',
                },
            },
            {
                $addFields: {
                    filteredMissions: {
                        $filter: {
                            input: '$missions',
                            as: 'mission',
                            cond: { $gte: ['$$mission.createdAt', periodStartDate] },
                        },
                    },
                },
            },
            {
                $addFields: {
                    stats: {
                        totalMissions: { $size: '$filteredMissions' },
                        completed: {
                            $size: {
                                $filter: {
                                    input: '$filteredMissions',
                                    as: 'm',
                                    cond: { $eq: ['$$m.status', 'completed'] },
                                },
                            },
                        },
                        failed: {
                            $size: {
                                $filter: {
                                    input: '$filteredMissions',
                                    as: 'm',
                                    cond: { $in: ['$$m.status', ['cancelled', 'rejected']] },
                                },
                            },
                        },
                        avgDeliveryTimeMs: {
                            $avg: {
                                $map: {
                                    input: {
                                        $filter: {
                                            input: '$filteredMissions',
                                            as: 'm',
                                            cond: {
                                                $and: [
                                                    { $eq: ['$$m.status', 'completed'] },
                                                    { $ne: [{ $ifNull: ['$$m.pickedUpAt', null] }, null] },
                                                    { $ne: [{ $ifNull: ['$$m.deliveredAt', null] }, null] },
                                                ],
                                            },
                                        },
                                    },
                                    as: 'm',
                                    in: { $dateDiff: { startDate: '$$m.pickedUpAt', endDate: '$$m.deliveredAt', unit: 'millisecond' } },
                                },
                            },
                        },
                        proofCompliantMissions: {
                            $size: {
                                $filter: {
                                    input: '$filteredMissions',
                                    as: 'm',
                                    cond: {
                                        $and: [
                                            { $eq: ['$$m.status', 'completed'] },
                                            { $ne: [{ $ifNull: ['$$m.pickupPhoto', null] }, null] },
                                            { $ne: [{ $ifNull: ['$$m.deliveryPhoto', null] }, null] },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                    currentMission: {
                        $filter: {
                            input: '$missions',
                            as: 'm',
                            cond: { $in: ['$$m.status', ['assigned', 'picked_up']] },
                        },
                    },
                    historyData: {
                        $map: {
                            input: {
                                $setUnion: {
                                    $map: {
                                        input: '$filteredMissions',
                                        as: 'm',
                                        in: { $dateToString: { format: '%Y-%m-%d', date: '$$m.createdAt' } }
                                    }
                                }
                            },
                            as: 'date',
                            in: {
                                date: '$$date',
                                missions: {
                                    $size: {
                                        $filter: {
                                            input: '$filteredMissions',
                                            as: 'm',
                                            cond: { $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$$m.createdAt' } }, '$$date'] }
                                        }
                                    }
                                },
                                timeSpentMs: {
                                    $sum: {
                                        $map: {
                                            input: {
                                                $filter: {
                                                    input: '$filteredMissions',
                                                    as: 'm',
                                                    cond: {
                                                        $and: [
                                                            { $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$$m.createdAt' } }, '$$date'] },
                                                            { $ne: [{ $ifNull: ['$$m.pickedUpAt', null] }, null] },
                                                            { $ne: [{ $ifNull: ['$$m.deliveredAt', null] }, null] }
                                                        ]
                                                    }
                                                }
                                            },
                                            as: 'm',
                                            in: { $dateDiff: { startDate: '$$m.pickedUpAt', endDate: '$$m.deliveredAt', unit: 'millisecond' } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
            },
            {
                $project: {
                    _id: 0,
                    volunteerId: '$_id',
                    name: 1,
                    stats: {
                        totalMissions: '$stats.totalMissions',
                        completed: '$stats.completed',
                        avgDeliveryTime: {
                            $concat: [
                                { $toString: { $ifNull: [{ $round: [{ $divide: ['$stats.avgDeliveryTimeMs', 60000] }, 0] }, 0] } },
                                ' mins',
                            ],
                        },
                        proofCompliance: {
                            $concat: [
                                {
                                    $toString: {
                                        $cond: [
                                            { $gt: ['$stats.completed', 0] },
                                            { $round: [{ $multiply: [{ $divide: ['$stats.proofCompliantMissions', '$stats.completed'] }, 100] }, 1] },
                                            0
                                        ]
                                    }
                                },
                                '%',
                            ],
                        },
                        successRate: {
                            $cond: [
                                { $gt: ['$stats.totalMissions', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$stats.completed', '$stats.totalMissions'] }, 100] }, 1] },
                                0
                            ]
                        }
                    },
                    profile: {
                        tier: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$volunteerProfile.tier', 'champion'] }, then: 'Champion' },
                                    { case: { $eq: ['$volunteerProfile.tier', 'hero'] }, then: 'Hero' },
                                ],
                                default: 'Rookie'
                            }
                        },
                        vehicle: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$volunteerProfile.vehicleType', 'bicycle'] }, then: 'Bicycle' },
                                    { case: { $eq: ['$volunteerProfile.vehicleType', 'scooter'] }, then: 'Scooter' },
                                    { case: { $eq: ['$volunteerProfile.vehicleType', 'car'] }, then: 'Car' },
                                    { case: { $eq: ['$volunteerProfile.vehicleType', 'van'] }, then: 'Van' },
                                ],
                                default: 'N/A'
                            }
                        },
                        isOnline: { $ifNull: ['$isOnline', false] },
                        status: {
                            $cond: [{ $gt: [{ $size: '$currentMission' }, 0] }, 'On Route', 'Available']
                        }
                    },
                    history: {
                        $slice: [
                            {
                                $map: {
                                    input: '$historyData',
                                    as: 'h',
                                    in: {
                                        date: '$$h.date',
                                        missions: '$$h.missions',
                                        timeSpent: {
                                            $concat: [
                                                { $toString: { $round: [{ $divide: ['$$h.timeSpentMs', 60000] }, 0] } },
                                                'm'
                                            ]
                                        }
                                    }
                                }
                            },
                            -7 // Last 7 days of activity
                        ]
                    }
                },
            },
            { $sort: { 'history.date': -1 } }
        ]);

        res.status(200).json(report);
    } catch (error) {
        next(error);
    }
};

export { getDonationReport, getNgoUtilizationReport, getVolunteerPerformanceReport };
