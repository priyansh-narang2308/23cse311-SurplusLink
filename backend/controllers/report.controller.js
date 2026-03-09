/**
 * @module Analytics & reporting Engine
 * @author Priyansh Narang
 * @description Generates aggregated metrics for system-wide transparency including
 * donation activity, NGO utilization, and volunteer performance scoring.
 */

import Donation from '../models/Donation.model.js';
import User from '../models/User.model.js';
import ImpactMetric from '../models/ImpactMetric.model.js';
import SafetyRule from '../models/SafetyRule.model.js';
import RejectionLog from '../models/RejectionLog.model.js';
import VerificationLog from '../models/VerificationLog.model.js';
import ViolationLog from '../models/ViolationLog.model.js';
import AuditLog from '../models/AuditLog.model.js';
import mongoose from 'mongoose';
import { convertToWeight, calculateMeals, calculateCo2Savings } from '../utils/impact.js';

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

        // Post-processing to add standardized impact metrics (US 7.1, 7.2)
        const result = report.map(item => {
            const weight = convertToWeight(item.quantity);
            return {
                ...item,
                weightKg: weight,
                meals: calculateMeals(weight),
                co2: calculateCo2Savings(weight)
            };
        });

        res.status(200).json(result);
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
        const { period, volunteerId } = req.query;

        // Calculate period start date
        let periodStartDate = new Date(0);
        const now = new Date();
        if (period === 'last_7_days') {
            periodStartDate = new Date(now.setDate(now.getDate() - 7));
        } else if (period === 'last_30_days') {
            periodStartDate = new Date(now.setDate(now.getDate() - 30));
        }

        const matchQuery = { role: 'volunteer' };
        if (volunteerId) {
            matchQuery._id = new mongoose.Types.ObjectId(volunteerId);
        }

        const report = await User.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'donations',
                    localField: '_id',
                    foreignField: 'volunteer',
                    as: 'missions',
                },
            },
            {
                $facet: {
                    // 1. Leaderboard (Per-volunteer stats)
                    leaderboard: [
                        {
                            $addFields: {
                                filteredMissions: {
                                    $filter: {
                                        input: '$missions',
                                        as: 'm',
                                        cond: { $gte: ['$$m.createdAt', periodStartDate] },
                                    },
                                },
                            },
                        },
                        {
                            $project: {
                                id: '$_id',
                                name: 1,
                                avatar: 1,
                                tier: { $ifNull: ['$volunteerProfile.tier', 'rookie'] },
                                vehicleType: { $ifNull: ['$volunteerProfile.vehicleType', 'bicycle'] },
                                isOnline: { $ifNull: ['$isOnline', false] },
                                status: {
                                    $cond: [
                                        { $gt: [{ $size: { $filter: { input: '$missions', as: 'm', cond: { $in: ['$$m.status', ['assigned', 'picked_up']] } } } }, 0] },
                                        'on-delivery',
                                        { $cond: [{ $eq: ['$isOnline', true] }, 'online', 'offline'] }
                                    ]
                                },
                                missionsCompleted: {
                                    $size: { $filter: { input: '$filteredMissions', as: 'm', cond: { $eq: ['$$m.status', 'completed'] } } }
                                },
                                missionsFailed: {
                                    $size: { $filter: { input: '$filteredMissions', as: 'm', cond: { $in: ['$$m.status', ['cancelled', 'rejected']] } } }
                                },
                                avgEta: {
                                    $ifNull: [
                                        {
                                            $avg: {
                                                $map: {
                                                    input: { $filter: { input: '$filteredMissions', as: 'm', cond: { $and: [{ $eq: ['$$m.status', 'completed'] }, { $ne: ['$$m.pickedUpAt', null] }, { $ne: ['$$m.deliveredAt', null] }] } } },
                                                    as: 'm',
                                                    in: { $dateDiff: { startDate: '$$m.pickedUpAt', endDate: '$$m.deliveredAt', unit: 'second' } }
                                                }
                                            }
                                        },
                                        0
                                    ]
                                },
                                hasProofCompliance: {
                                    $let: {
                                        vars: {
                                            completed: { $filter: { input: '$filteredMissions', as: 'm', cond: { $eq: ['$$m.status', 'completed'] } } }
                                        },
                                        in: {
                                            $cond: [
                                                { $eq: [{ $size: '$$completed' }, 0] },
                                                true,
                                                {
                                                    $eq: [
                                                        { $size: '$$completed' },
                                                        { $size: { $filter: { input: '$$completed', as: 'm', cond: { $and: [{ $ne: ['$$m.pickupPhoto', null] }, { $ne: ['$$m.deliveryPhoto', null] }] } } } }
                                                    ]
                                                }
                                            ]
                                        }
                                    }
                                },
                                history: {
                                    $slice: [
                                        {
                                            $map: {
                                                input: { $sortArray: { input: '$filteredMissions', sortBy: { createdAt: -1 } } },
                                                as: 'm',
                                                in: {
                                                    id: '$$m._id',
                                                    status: { $cond: [{ $eq: ['$$m.status', 'completed'] }, 'completed', 'failed'] },
                                                    timestamp: '$$m.createdAt',
                                                    photoUrl: { $ifNull: ['$$m.deliveryPhoto', '$$m.pickupPhoto'] }
                                                }
                                            }
                                        },
                                        5
                                    ]
                                }
                            }
                        },
                        { $sort: { missionsCompleted: -1 } }
                    ],
                    // 2. Overview Stats (Global)
                    overview: [
                        { $unwind: '$missions' },
                        { $match: { 'missions.createdAt': { $gte: periodStartDate } } },
                        {
                            $group: {
                                _id: null,
                                totalAssigned: { $sum: 1 },
                                completed: { $sum: { $cond: [{ $eq: ['$missions.status', 'completed'] }, 1, 0] } },
                                proofCompliant: { $sum: { $cond: [{ $and: [{ $eq: ['$missions.status', 'completed'] }, { $ne: ['$missions.deliveryPhoto', null] }] }, 1, 0] } },
                                avgResponseMs: {
                                    $avg: {
                                        $cond: [
                                            { $and: [{ $ne: ['$missions.pickedUpAt', null] }, { $ne: ['$missions.claimedAt', null] }] },
                                            { $dateDiff: { startDate: '$missions.claimedAt', endDate: '$missions.pickedUpAt', unit: 'millisecond' } },
                                            null
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                fleetDeliveryRate: { $round: [{ $multiply: [{ $divide: ['$completed', { $max: [1, '$totalAssigned'] }] }, 100] }, 1] },
                                avgResponseTime: { $round: [{ $divide: [{ $ifNull: ['$avgResponseMs', 0] }, 60000] }, 0] },
                                complianceScore: { $round: [{ $multiply: [{ $divide: ['$proofCompliant', { $max: [1, '$completed'] }] }, 100] }, 1] }
                            }
                        }
                    ],
                    // 3. Efficiency By Tier
                    efficiencyByTier: [
                        { $unwind: '$missions' },
                        { $match: { 'missions.status': 'completed', 'missions.pickedUpAt': { $ne: null }, 'missions.deliveredAt': { $ne: null } } },
                        {
                            $group: {
                                _id: { $ifNull: ['$volunteerProfile.tier', 'rookie'] },
                                avgTime: { $avg: { $dateDiff: { startDate: '$missions.pickedUpAt', endDate: '$missions.deliveredAt', unit: 'minute' } } }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                tier: { $concat: [{ $toUpper: { $substr: ['$_id', 0, 1] } }, { $substr: ['$_id', 1, -1] }] },
                                avgTime: { $round: ['$avgTime', 1] }
                            }
                        },
                        { $sort: { avgTime: 1 } }
                    ],
                    // 4. Recent Proof Global
                    recentProof: [
                        { $unwind: '$missions' },
                        { $match: { 'missions.deliveryPhoto': { $ne: null } } },
                        { $sort: { 'missions.deliveredAt': -1 } },
                        { $limit: 10 },
                        {
                            $project: {
                                _id: 0,
                                id: '$missions._id',
                                photoUrl: '$missions.deliveryPhoto',
                                timestamp: '$missions.deliveredAt',
                                volunteerName: '$name'
                            }
                        }
                    ],
                    // 5. Active Count
                    activeVolunteers: [
                        { $match: { isOnline: true } },
                        { $count: 'online' }
                    ]
                }
            }
        ]);

        const result = report[0];

        // Format and combine
        const finalResponse = {
            overview: {
                ...(result.overview[0] || { fleetDeliveryRate: 0, avgResponseTime: 0, complianceScore: 0 }),
                activeHeroes: result.activeVolunteers[0]?.online || 0
            },
            leaderboard: result.leaderboard,
            efficiencyByTier: result.efficiencyByTier.length > 0 ? result.efficiencyByTier : [
                { tier: 'Champion', avgTime: 0 },
                { tier: 'Hero', avgTime: 0 },
                { tier: 'Rookie', avgTime: 0 }
            ],
            recentProof: result.recentProof
        };

        res.status(200).json(finalResponse);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Generate a system-wide impact summary report (US 7.1 & 7.2)
 * @route   GET /api/v1/reports/impact-summary
 * @access  Private (Admin)
 * @description Aggregates meals saved and CO2 emissions avoided over time.
 */
const getImpactSummary = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const stats = await ImpactMetric.find(query).sort({ date: 1 });

        const totals = await ImpactMetric.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalMeals: { $sum: '$totalMeals' },
                    totalCo2: { $sum: '$totalCo2' },
                    totalWeightKg: { $sum: '$totalWeightKg' },
                    donationsCompleted: { $sum: '$donationsCompleted' },
                }
            }
        ]);

        res.json({
            summary: totals[0] || { totalMeals: 0, totalCo2: 0, totalWeightKg: 0, donationsCompleted: 0 },
            timeline: stats
        });
    } catch (error) {
        next(error);
    }
};

const getSafetyComplianceReport = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }

        // 1. Safety Rejections (Rejections flagged as safety issues)
        const safetyRejections = await RejectionLog.find({
            ...dateFilter,
            isSafetyIssue: true
        }).populate('donationId ngoId');

        // 2. Expired/Unsafe Food (Donations that expired before being picked up)
        const unsafeDonations = await Donation.find({
            ...dateFilter,
            status: { $in: ['expired', 'rejected'] }
        }).populate('donor');

        // 3. User Violations (Direct violations logged by admins)
        const userViolations = await ViolationLog.find(dateFilter).populate('userId adminId');

        // 4. Verification Audits (History of user verification actions)
        const verificationHistory = await VerificationLog.find(dateFilter).populate('userId adminId');

        // 5. Admin Governance Actions (Filtered from generic AuditLog)
        const adminActions = await AuditLog.find({
            ...dateFilter,
            category: { $in: ['safety', 'system'] }
        }).populate('userId');

        // 6. Summary Metrics
        const reportSummary = {
            totalSafetyRejections: safetyRejections.length,
            expiredEntries: unsafeDonations.filter(d => d.status === 'expired').length,
            violationsRecorded: userViolations.length,
            pendingVerifications: verificationHistory.filter(v => v.status === 'pending').length,
            totalGovernanceActions: adminActions.length
        };

        res.status(200).json({
            success: true,
            summary: reportSummary,
            data: {
                safetyRejections,
                unsafeDonations,
                userViolations,
                verificationHistory,
                governanceActions: adminActions
            }
        });
    } catch (error) {
        next(error);
    }
};

export { getDonationReport, getNgoUtilizationReport, getVolunteerPerformanceReport, getImpactSummary, getSafetyComplianceReport };
