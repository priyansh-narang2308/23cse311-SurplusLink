/**
 * @module Intelligent Matching & Prioritization Engine
 * @author Pragna
 * @description The "Brain" of the platform. This service implements the weighted suitability 
 * matrix, geospatial NGO discovery, and volunteer equity (Round Robin) logic.
 */

import Donation from '../models/Donation.model.js';
import User from '../models/User.model.js';
import SystemConfig from '../models/SystemConfig.model.js';
import mongoose from 'mongoose';

/**
 * Get urgency information based on time remaining until expiry
 * @param {Date} expiryDate - The expiry date of the donation
 * @returns {Object} Urgency info { score, level, tier }
 */
export const getUrgencyInfo = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const hoursRemaining = (expiry - now) / (1000 * 60 * 60);

    if (hoursRemaining < 3) {
        return { score: 100, level: 'Critical', tier: 1 };
    } else if (hoursRemaining < 6) {
        return { score: 60, level: 'Urgent', tier: 2 };
    } else {
        return { score: 20, level: 'Standard', tier: 3 };
    }
};

/**
 * Helper to check if a location is within a crisis zone
 */
const isInCrisisZone = (coordinates, emergencyMode) => {
    if (!emergencyMode.enabled || !emergencyMode.affectedZones || emergencyMode.affectedZones.length === 0) return false;
    return true; // Simplified for US 9.2 (Global prioritisation when enabled)
};

/**
 * Calculate the suitability score for an NGO based on a donation
 * Combines Distance (40%) and Time Urgency (60%)
 * Formula: Ranking = (DistanceScore * 0.4) + (TimeUrgencyScore * 0.6)
 * Boosts by 20% if NGO has isUrgentNeed flag
 * 
 * @param {Object} donation - The donation object
 * @param {Object} ngo - The NGO user object
 * @param {number} distance - Distance in meters
 * @param {number} unmetNeed - Unmet need for the NGO (still used for base capacity check)
 * @param {Object} systemConfig - Optional System Config for Emergency Mode overrides
 * @returns {number} Suitability score (0-100)
 */
export const calculateSuitabilityScore = (donation, ngo, distance, unmetNeed, systemConfig = null) => {
    const urgency = getUrgencyInfo(donation.expiryDate);
    const isCritical = urgency.tier === 1;

    // US 9.2: Emergency Mode Overrides
    const isEmergency = systemConfig?.emergencyMode?.enabled;
    const isInZone = isEmergency && isInCrisisZone(donation.coordinates, systemConfig.emergencyMode);

    // 1. Distance score (40% weight)
    const distanceKm = distance / 1000;
    const distanceScore = (1 / (distanceKm + 1)) * 100;
    const distanceWeight = 0.4;

    // 2. Time Urgency score (60% weight)
    const urgencyScore = urgency.score;
    const urgencyWeight = 0.6;

    // 3. Combine scores
    let finalScore = (distanceScore * distanceWeight) + (urgencyScore * urgencyWeight);

    // US 9.2: Crisis Zone Boost (Ignore capacity, priority multiplier)
    if (isInZone) {
        finalScore = finalScore * 2.5; // Massive boost for crisis zones
    } else {
        // Boost by 20% if NGO has isUrgentNeed flag
        if (ngo.ngoProfile && ngo.ngoProfile.isUrgentNeed) {
            finalScore = finalScore * 1.2;
        }

        // INTELLIGENT LOAD BALANCING (Density Check)
        // Requirement 5.6: If at >80% capacity, apply 0.5x multiplier for non-critical donations
        if (!isCritical && ngo.ngoProfile?.dailyCapacity > 0) {
            const claimedCount = ngo.ngoProfile.dailyCapacity - unmetNeed;
            const capacityUsage = claimedCount / ngo.ngoProfile.dailyCapacity;

            if (capacityUsage > 0.8) {
                finalScore = finalScore * 0.5;
            }
        }
    }

    return Math.round(Math.min(finalScore, 500) * 100) / 100;
};

/**
 * Find the best NGOs for a specific donation within a 15km radius
 * Uses MongoDB aggregation for efficient geospatial calculations
 * 
 * @param {string} donationId - The ID of the donation
 * @returns {Promise<Array>} Array of matched NGOs with suitability scores
 */
export const findBestNGOsForDonation = async (donationId) => {
    try {
        const donation = await Donation.findById(donationId);
        if (!donation) {
            throw new Error('Donation not found');
        }

        const systemConfig = await SystemConfig.findOne();
        const isEmergency = systemConfig?.emergencyMode?.enabled;

        const [lng, lat] = donation.coordinates.coordinates;

        // Use MongoDB aggregation pipeline for efficient geospatial calculations
        const pipeline = [
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [lng, lat],
                    },
                    distanceField: 'distance',
                    maxDistance: isEmergency ? 500000 : 100000, // 500km during emergency vs 100km
                    spherical: true,
                    key: 'location', // Explicitly use the NGO location index
                    query: {
                        role: 'ngo',
                        status: 'active',
                    },
                },
            },
            {
                $match: {
                    // Filter: Ensure the NGO has the required storageFacilities
                    // If donation is 'frozen', NGO must have 'frozen' facility.
                    $expr: {
                        $cond: {
                            if: { $not: ["$donation.storageReq"] },
                            then: true,
                            else: {
                                $or: [
                                    { $size: { $ifNull: ["$ngoProfile.storageFacilities", []] } }, // Match if NGO says they have any? No, filter strictly.
                                    { $in: [donation.storageReq, { $ifNull: ["$ngoProfile.storageFacilities", []] }] }
                                ]
                            }
                        }
                    }
                },
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    organization: 1,
                    email: 1,
                    distance: 1,
                    ngoProfile: 1,
                    'stats.trustScore': 1,
                    'stats.completedDonations': 1,
                },
            },
        ];

        // Fixed match logic for better clarity
        if (donation.storageReq) {
            pipeline[1].$match = {
                'ngoProfile.storageFacilities': donation.storageReq
            };
        } else {
            pipeline.splice(1, 1); // Remove match stage if no storage req
        }

        const ngos = await User.aggregate(pipeline);

        // Calculate suitability scores for each NGO
        const scoredNGOs = await Promise.all(ngos.map(async (ngo) => {
            const unmetNeed = await getUnmetNeed(ngo._id);
            const suitabilityScore = calculateSuitabilityScore(donation, ngo, ngo.distance, unmetNeed, systemConfig);
            const urgency = getUrgencyInfo(donation.expiryDate);

            return {
                ...ngo,
                suitabilityScore,
                matchPercentage: suitabilityScore,
                urgencyLevel: urgency.level,
                urgencyTier: urgency.tier,
            };
        }));

        // Sort by suitability score in descending order
        scoredNGOs.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

        return scoredNGOs;
    } catch (error) {
        console.error('Error finding best NGOs:', error);
        throw error;
    }
};

/**
 * Find the best donations for a specific NGO within a 15km radius
 * Uses MongoDB aggregation for efficient geospatial calculations
 * Prioritizes donations by:
 * 1. Distance (closer is better)
 * 2. Perishability (high perishability gets priority)
 * 3. Storage facility match
 * 
 * @param {string} ngoId - The ID of the NGO user
 * @returns {Promise<Array>} Array of matched donations with suitability scores
 */
export const findBestDonationsForNGO = async (ngoId) => {
    try {
        const ngo = await User.findById(ngoId);
        if (!ngo || ngo.role !== 'ngo') {
            throw new Error('NGO not found or invalid role');
        }

        if (!ngo.coordinates || !ngo.coordinates.lat || !ngo.coordinates.lng) {
            throw new Error('NGO coordinates not set');
        }

        const [lng, lat] = [ngo.coordinates.lng, ngo.coordinates.lat];

        // Build storage facilities filter
        let storageFilter = {};
        if (ngo.ngoProfile && ngo.ngoProfile.storageFacilities && ngo.ngoProfile.storageFacilities.length > 0) {
            storageFilter = {
                $or: [
                    { storageReq: { $exists: false } },
                    { storageReq: null },
                    { storageReq: "dry" }, // "dry" is always safe
                    { storageReq: { $in: ngo.ngoProfile.storageFacilities } },
                ],
            };
        } else {
            // New NGOs or unconfigured profiles should at least see dry food and unspecified ones
            storageFilter = {
                $or: [
                    { storageReq: { $exists: false } },
                    { storageReq: null },
                    { storageReq: "dry" }
                ]
            };
        }

        // Use MongoDB aggregation pipeline for efficient geospatial calculations
        const pipeline = [
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [lng, lat],
                    },
                    distanceField: 'distance',
                    maxDistance: 100000, // Increased to 100km for flexibility (was 15km)
                    spherical: true,
                    query: {
                        status: 'active',
                        ...storageFilter,
                    },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'donor',
                    foreignField: '_id',
                    as: 'donorInfo',
                },
            },
            {
                $unwind: {
                    path: '$donorInfo',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    description: 1,
                    foodType: 1,
                    quantity: 1,
                    expiryDate: 1,
                    perishability: 1,
                    pickupWindow: 1,
                    pickupAddress: 1,
                    coordinates: 1,
                    allergens: 1,
                    dietaryTags: 1,
                    storageReq: 1,
                    status: 1,
                    photos: 1,
                    distance: 1,
                    donor: {
                        _id: '$donorInfo._id',
                        name: '$donorInfo.name',
                        organization: '$donorInfo.organization',
                        email: '$donorInfo.email'
                    },
                    createdAt: 1,
                },
            },
        ];

        const donations = await Donation.aggregate(pipeline);
        const unmetNeed = await getUnmetNeed(ngoId);
        const systemConfig = await SystemConfig.findOne();

        // Calculate suitability scores for each donation
        const scoredDonations = donations.map((donation) => {
            const suitabilityScore = calculateSuitabilityScore(donation, ngo, donation.distance, unmetNeed, systemConfig);
            const urgency = getUrgencyInfo(donation.expiryDate);

            return {
                ...donation,
                suitabilityScore,
                matchPercentage: suitabilityScore,
                urgencyLevel: urgency.level,
                urgencyTier: urgency.tier,
            };
        });

        // Sort by suitability score in descending order
        scoredDonations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

        return scoredDonations;
    } catch (error) {
        console.error('Error finding best donations for NGO:', error);
        throw error;
    }
};

/**
 * Get unmet need for an NGO for a specific day
 * Unmet Need = dailyCapacity - sum of claimed but not delivered donations
 * 
 * @param {string} ngoId - The ID of the NGO
 * @returns {Promise<number>} Unmet need in units
 */
export const getUnmetNeed = async (ngoId) => {
    try {
        const ngo = await User.findById(ngoId);
        if (!ngo) {
            throw new Error('NGO not found');
        }

        const dailyCapacity = ngo.ngoProfile?.dailyCapacity || 0;

        // Get total quantity of claimed but not delivered donations for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const result = await Donation.aggregate([
            {
                $match: {
                    claimedBy: new mongoose.Types.ObjectId(ngoId),
                    status: { $in: ['assigned', 'picked_up', 'picked-up', 'in-transit', 'arrived'] }, // More robust status check
                    createdAt: { $gte: today, $lt: tomorrow },
                },
            },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                },
            },
        ]);

        const claimedCount = result.length > 0 ? result[0].totalCount : 0;
        const unmetNeed = Math.max(0, dailyCapacity - claimedCount);

        return unmetNeed;
    } catch (error) {
        console.error('Error calculating unmet need:', error);
        throw error;
    }
};

/**
 * Get volunteer suitability score based on distance and tier
 * @param {Object} volunteer - The volunteer object
 * @param {number} distance - Distance in meters
 * @returns {number} Suitability score
 */
export const getVolunteerSuitabilityScore = (volunteer, distance, donation) => {
    const urgency = getUrgencyInfo(donation.expiryDate);
    const isCritical = urgency.tier === 1; // < 3h
    const isStandard = urgency.tier === 3; // > 6h

    const distanceKm = distance / 1000;
    const distanceScore = (1 / (distanceKm + 1)) * 100;

    // DECISION TREE LOGIC (Requirement 5.6):
    // Is critical? Ignore load balancing, prioritize distance.
    if (isCritical) {
        return Math.round(distanceScore * 100) / 100;
    }

    // Tier weight: Champion (100), Hero (60), Rookie (20)
    const tierWeights = { champion: 100, hero: 60, rookie: 20 };
    const tierScore = tierWeights[volunteer.volunteerProfile?.tier] || 20;

    // Base score = (Distance * 0.5) + (Tier * 0.5)
    let score = (distanceScore * 0.5) + (tierScore * 0.5);

    // CAPACITY CHECK (Requirement 5.8)
    // Parse donation quantity
    const quantityStr = String(donation.quantity).toLowerCase();
    const weightMatch = quantityStr.match(/(\d+(\.\d+)?)/);
    const estimatedWeight = weightMatch ? parseFloat(weightMatch[0]) : 0;

    if (volunteer.volunteerProfile?.maxWeight > 0 && volunteer.volunteerProfile.maxWeight < estimatedWeight) {
        // Severe penalty for insufficient capacity (unless it's critical, but we handle that above)
        score = score * 0.2;
    }

    // VOLUNTEER EQUITY (Round Robin Logic)
    // If standard (>6h), prioritize few recent tasks.
    if (isStandard) {
        // Boost if no tasks today or haven't received a mission today
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));

        const hasNoMissionsToday = !volunteer.volunteerProfile.lastMissionDate || volunteer.volunteerProfile.lastMissionDate < startOfDay;
        if (hasNoMissionsToday || volunteer.currentTaskCount === 0) {
            score += 30; // Significant boost for equity
        }
    }

    return Math.round(score * 100) / 100;
};

/**
 * Find suitable volunteers for a donation
 * @param {Object} donation - The donation object
 * @param {number} radius - Radius in meters
 * @returns {Promise<Array>} List of suitable volunteers sorted by suitability
 */
export const findSuitableVolunteers = async (donation, radius = 10000) => {
    try {
        const [lng, lat] = donation.coordinates.coordinates;

        // Parse quantity to estimate weight/bulk
        const quantityStr = String(donation.quantity).toLowerCase();
        const weightMatch = quantityStr.match(/(\d+(\.\d+)?)/);
        const estimatedWeight = weightMatch ? parseFloat(weightMatch[0]) : 0;
        const needsLargeVehicle = estimatedWeight > 20; // Threshold for prioritizing cars/vans

        // Get currently active volunteers (not on a mission)
        // Active mission = any donation with this volunteer where deliveryStatus is NOT 'delivered' or 'idle'
        const activeVolunteersWithMissions = await Donation.distinct('volunteer', {
            volunteer: { $exists: true },
            deliveryStatus: { $nin: ['delivered', 'idle'] }
        });

        const pipeline = [
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [lng, lat] },
                    distanceField: 'distance',
                    maxDistance: radius,
                    spherical: true,
                    key: 'volunteerProfile.currentLocation', // Expliticly use volunteer location index
                    query: {
                        role: 'volunteer',
                        status: 'active',
                        isOnline: true,
                        _id: { $nin: activeVolunteersWithMissions }
                    },
                },
            }
        ];

        const volunteers = await User.aggregate(pipeline);

        // Map and rank
        const rankedVolunteers = volunteers.map(v => {
            const score = getVolunteerSuitabilityScore(v, v.distance, donation);

            // Prioritize vehicle type if weight is high
            let vehicleBonus = 0;
            if (needsLargeVehicle && ['car', 'van'].includes(v.volunteerProfile?.vehicleType)) {
                vehicleBonus = 20; // Significant bonus for large vehicles
            }

            return {
                ...v,
                suitabilityScore: score + vehicleBonus,
                tier: v.volunteerProfile?.tier || 'rookie'
            };
        });

        // Sort by suitability score desc
        rankedVolunteers.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

        // Return top matches (requirement says top 3 best volunteers)
        return rankedVolunteers.slice(0, 10); // Return more so controller can filter/limit as needed
    } catch (error) {
        console.error('Error finding suitable volunteers:', error);
        throw error;
    }
};

