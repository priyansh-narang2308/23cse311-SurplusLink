/**
 * @module Logistics & Donation Engine
 * @description Core coordination logic for the SurplusLink ecosystem.
 * 
 * Module Assignments:
 * - Donor Operations: Arpitha Amrita (createDonation, getDonorStats, getDonorHistory)
 * - NGO Operations: Sanjay (getSmartFeed, claimDonation, rejectDonation, getClaimedDonations)
 * - Volunteer Logistics: Bharath G Sec (getAvailableMissions, acceptMission, updateStatus)
 * - Intelligent Matching Integration: Pragna (initiateAutoDispatch, reassignMission)
 */

import Donation from '../models/Donation.model.js';
import User from '../models/User.model.js';
import { createNotification } from '../utils/notification.js';
import AuditLog from '../models/AuditLog.model.js';
import RejectionLog from '../models/RejectionLog.model.js';

import SafetyRule from '../models/SafetyRule.model.js';

import sendEmail from '../utils/email.js';
import { geocodeAddress } from '../utils/geocoder.js';
import { findBestDonationsForNGO, getUnmetNeed, findSuitableVolunteers } from '../services/matching.service.js';
import { getOptimalPath } from '../services/routing.service.js';
import ImpactMetric from '../models/ImpactMetric.model.js';
import { convertToWeight, calculateMeals, calculateCo2Savings } from '../utils/impact.js';
import { analyzeDonationImage } from '../services/azureVision.service.js';


/**
 * @desc    Create a new donation posting
 * @route   POST /api/v1/donations
 * @access  Private (Donor)
 * @description Handles food donation creation with image uploads, safety threshold validation, 
 *              and automatic geocoding of pickup addresses.
 */
export const createDonation = async (req, res) => {
    try {
        let {
            title,
            description,
            foodType,
            quantity,
            expiryDate,
            perishability,
            pickupWindow,
            pickupAddress,
            coordinates,
            allergens,
            dietaryTags,
            storageReq,
            foodCategory,
        } = req.body;

        const parseJsonField = (val) => {
            if (!val) return null;
            if (typeof val === 'object') return val;
            try {
                return JSON.parse(val);
            } catch (e) {
                console.error(`Failed to parse field:`, val);
                return null;
            }
        };

        pickupWindow = parseJsonField(pickupWindow);
        coordinates = parseJsonField(coordinates);
        allergens = parseJsonField(allergens) || [];
        dietaryTags = parseJsonField(dietaryTags) || [];

        if (!pickupWindow || !pickupWindow.start || !pickupWindow.end) {
            return res.status(400).json({ message: 'Invalid pickup window format.' });
        }

        const expiry = new Date(expiryDate);
        const windowStart = new Date(pickupWindow.start);
        const windowEnd = new Date(pickupWindow.end);
        const now = new Date();

        if (isNaN(expiry.getTime())) return res.status(400).json({ message: 'Invalid expiry date.' });
        if (isNaN(windowStart.getTime())) return res.status(400).json({ message: 'Invalid pickup window start date.' });
        if (isNaN(windowEnd.getTime())) return res.status(400).json({ message: 'Invalid pickup window end date.' });

        //safety Rule: validate that (expiryDate - Date.now()) > 2 hours
        const hoursToExpiry = (expiry - now) / (1000 * 60 * 60);
        if (hoursToExpiry < 2) {
            return res.status(400).json({
                message: 'Food items must be valid for at least 2 hours before expiry for safety.',
            });
        }

        // --- EPIC 6: SAFETY RULE ENFORCEMENT ---
        const rule = await SafetyRule.findOne({ foodType, isActive: true });
        if (rule) {
            if (hoursToExpiry > rule.maxDurationHours) {
                return res.status(400).json({
                    message: `Safety Violation: ${foodType} cannot be safely distributed if kept for more than ${rule.maxDurationHours} hours. (Currently: ${hoursToExpiry.toFixed(1)} hours left)`,
                });
            }
        }


        //scheduling rule: ensure pickupWindow.end < expiryDate
        if (windowEnd >= expiry) {
            return res.status(400).json({
                message: 'Pickup window must end before the food expires.',
            });
        }

        //handle photos(cloudinary)
        const photos = req.files ? req.files.map((file) => file.path) : [];

        const donationData = {
            title,
            description,
            foodType,
            quantity,
            expiryDate: expiry,
            perishability,
            photos,
            pickupWindow: {
                start: windowStart,
                end: windowEnd,
            },
            pickupAddress,
            coordinates: {
                type: 'Point',
                coordinates: Array.isArray(coordinates) ? coordinates : (coordinates?.coordinates || coordinates),
            },
            allergens,
            dietaryTags,
            donor: req.user._id,
            storageReq,
            foodCategory,
        };

        //automated address-to-coordinate conversion (geocoding)
        if (pickupAddress) {
            const geocoded = await geocodeAddress(pickupAddress);
            if (geocoded) {
                console.log(`Donation Geocoding Success: ${pickupAddress} -> [${geocoded.lng}, ${geocoded.lat}]`);
                donationData.coordinates = {
                    type: 'Point',
                    coordinates: [geocoded.lng, geocoded.lat]
                };
            }
        }

        //normalized coordinate storage for MongoDB Geospatial indexing
        if (donationData.coordinates.coordinates && Array.isArray(donationData.coordinates.coordinates)) {
        } else if (Array.isArray(donationData.coordinates)) {
            const coordsArray = donationData.coordinates;
            donationData.coordinates = { type: 'Point', coordinates: coordsArray };
        }

        const donation = await Donation.create(donationData);

        // --- Azure AI Vision Analysis ---
        if (photos.length > 0) {
            // We analyze the first photo for simplicity, or we could do more
            try {
                const aiResult = await analyzeDonationImage(photos[0]);
                if (aiResult) {
                    donation.azureAiDetection = aiResult;
                }
            } catch (aiError) {
                console.error('Azure AI Analysis failed for donation:', donation._id, aiError);
            }
        }

        // Record initial status in timeline
        donation.addStatusHistory(req.user._id, 'Donation created and posted.');
        await donation.save();

        // Audit Log
        await AuditLog.create({
            action: 'CREATE_DONATION',
            category: 'donation',
            userId: req.user._id,
            metadata: { donationId: donation._id, title: donation.title },
        });

        //notify all nearby ngos brodcast

        try {
            // Notify Donor
            await createNotification(
                req.user._id,
                'donation_created',
                'donation_created',
                donation._id,
                { title }
            );

            // US 8.2: Geo-based and Capacity-aware alert logic
            const nearbyNgos = await User.find({
                role: 'ngo',
                status: 'active',
                location: {
                    $near: {
                        $geometry: donation.coordinates,
                        $maxDistance: 15000 // 15km radius
                    }
                }
            });

            // Capacity & Storage Filter
            const targetNgos = nearbyNgos.filter(ngo => {
                // 1. Storage Facility Check
                if (storageReq && ngo.ngoProfile?.storageFacilities?.length > 0) {
                    if (!ngo.ngoProfile.storageFacilities.includes(storageReq)) return false;
                }

                // 2. Daily Capacity Check (Basic: Must have some capacity defined)
                if (ngo.ngoProfile?.dailyCapacity <= 0) return false;

                return true;
            });

            for (const ngo of targetNgos) {
                await createNotification(
                    ngo._id,
                    'donation_created',
                    'donation_created',
                    donation._id,
                    { title }
                );
            }
        } catch (notifyError) {
            console.error('Broadcast notification failed:', notifyError);
        }

        res.status(201).json(donation);
    } catch (error) {
        console.error('Donation Creation Error:', error);
        res.status(400).json({ message: error.message });
    }
};

/**
 * @desc    Get donation history for the authenticated donor
 * @route   GET /api/v1/donations/my-donations
 * @access  Private (Donor)
 */
export const getDonorHistory = async (req, res) => {
    try {
        const donations = await Donation.find({ donor: req.user._id })
            .populate('volunteer', 'name email phone avatar volunteerProfile.currentLocation')
            .populate('claimedBy', 'organization name coordinates')
            .sort({ createdAt: -1 });
        res.json(donations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Calculate and return performance statistics for a donor
 * @route   GET /api/v1/donations/stats
 * @access  Private (Donor)
 */
export const getDonorStats = async (req, res) => {
    try {
        const totalDonations = await Donation.countDocuments({ donor: req.user._id });
        const completedDonations = await Donation.countDocuments({
            donor: req.user._id,
            status: 'completed',
        });
        const acceptanceRate = totalDonations > 0 ? (completedDonations / totalDonations) * 100 : 0;

        // Monthly Breakdown
        const monthlyDataMap = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const m = months[date.getMonth()];
            monthlyDataMap[m] = { month: m, meals: 0, co2: 0 };
        }

        const myDonations = await Donation.find({ donor: req.user._id, status: 'completed' });
        myDonations.forEach(d => {
            const m = months[new Date(d.createdAt).getMonth()];
            if (monthlyDataMap[m]) {
                const weight = convertToWeight(d.quantity);
                const meals = calculateMeals(weight);
                const co2 = calculateCo2Savings(weight);
                monthlyDataMap[m].meals += meals;
                monthlyDataMap[m].co2 += co2;
            }
        });

        res.json({
            totalDonations,
            completedDonations,
            acceptanceRate: parseFloat(acceptanceRate.toFixed(2)),
            mealsSaved: myDonations.reduce((acc, d) => acc + calculateMeals(convertToWeight(d.quantity)), 0),
            co2Reduced: parseFloat(myDonations.reduce((acc, d) => acc + calculateCo2Savings(convertToWeight(d.quantity)), 0).toFixed(1)),
            sustainabilityCredits: req.user.stats?.sustainabilityCredits || 0,
            monthlyBreakdown: Object.values(monthlyDataMap)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get performance and impact statistics for an NGO
 * @route   GET /api/v1/donations/ngo/stats
 * @access  Private (NGO)
 */
export const getNgoStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Fetch all successful distributions for this NGO
        const completedDonations = await Donation.find({
            claimedBy: userId,
            status: 'completed'
        });

        // Metric 1: Total volume/meals received
        let mealsReceived = 0;
        completedDonations.forEach(d => {
            const match = String(d.quantity).match(/(\d+(\.\d+)?)/);
            if (match) {
                mealsReceived += parseFloat(match[0]);
            } else {
                mealsReceived += 1;
            }
        });

        // Metric 2: Logistics speed (Pickup-to-Delivery time)
        let totalDeliveryTime = 0;
        let deliveriesWithTime = 0;

        completedDonations.forEach(d => {
            if (d.pickedUpAt && d.deliveredAt) {
                const diff = (new Date(d.deliveredAt).getTime() - new Date(d.pickedUpAt).getTime()) / (1000 * 60); // minutes
                totalDeliveryTime += diff;
                deliveriesWithTime++;
            }
        });

        const avgDeliveryTime = deliveriesWithTime > 0 ? Math.round(totalDeliveryTime / deliveriesWithTime) : 0;

        // Metric 3: Monthly Breakdown for Charts
        const monthlyDataMap = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize last 6 months
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const m = months[d.getMonth()];
            monthlyDataMap[m] = { month: m, meals: 0, co2: 0, distributions: 0 };
        }

        completedDonations.forEach(d => {
            const date = new Date(d.createdAt);
            const m = months[date.getMonth()];
            if (monthlyDataMap[m]) {
                const weight = convertToWeight(d.quantity);
                const meals = calculateMeals(weight);
                const co2 = calculateCo2Savings(weight);
                monthlyDataMap[m].meals += meals;
                monthlyDataMap[m].co2 += co2;
                monthlyDataMap[m].distributions += 1;
            }
        });

        res.json({
            mealsReceived: parseFloat(mealsReceived.toFixed(1)),
            avgDeliveryTime,
            totalDistributions: completedDonations.length,
            monthlyData: Object.values(monthlyDataMap),
            sustainabilityCredits: req.user.stats?.sustainabilityCredits || 0,
            trend: completedDonations.length > 5 ? 15 : 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Cancel a donation posting (if not already picked up)
 * @route   PATCH /api/v1/donations/:id/cancel
 * @access  Private (Donor)
 */
export const cancelDonation = async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.id);

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (donation.donor.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Integrity Rule: Cannot cancel if in-transit or completed
        if (!['active', 'assigned'].includes(donation.status)) {
            return res.status(400).json({
                message: `Cannot cancel donation when it is in status: ${donation.status}`,
            });
        }

        donation.status = 'cancelled';

        // Update timeline
        donation.addStatusHistory(req.user._id, 'Donation cancelled by donor.');
        await donation.save();

        await createNotification(
            donation.donor,
            'donation_cancelled',
            'donation_cancelled',
            donation._id,
            { title: donation.title }
        );

        // Notify NGO if they had claimed it
        if (donation.claimedBy) {
            await createNotification(
                donation.claimedBy,
                `Attention: The donor has cancelled the donation "${donation.title}".`,
                'general',
                donation._id
            );
        }

        // Notify Volunteer if they were on the job
        if (donation.volunteer) {
            await createNotification(
                donation.volunteer,
                `Mission Cancelled: The donor has cancelled the rescue for "${donation.title}". You are now free for other missions.`,
                'general',
                donation._id
            );

            // Adjust volunteer work-load metrics
            await User.findByIdAndUpdate(donation.volunteer, {
                $inc: { currentTaskCount: -1 }
            });
        }

        res.json(donation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Retrieve full details of a specific donation
 * @route   GET /api/v1/donations/:id
 * @access  Private
 */
export const getDonationById = async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.id)
            .populate('donor', 'name email organization coordinates')
            .populate('volunteer', 'name email phone avatar volunteerProfile.currentLocation')
            .populate('claimedBy', 'organization name coordinates')
            .populate('statusHistory.updatedBy', 'name role organization');

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        res.json(donation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Close a mission, set feedback, and update donor trust scores
 * @route   PATCH /api/v1/donations/:id/complete
 * @access  Private (NGO/Volunteer)
 */
export const completeDonation = async (req, res, next) => {
    try {
        const { rating, comment } = req.body;
        const donation = await Donation.findById(req.params.id);

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (donation.status === 'completed') {
            return res.status(400).json({ message: 'Donation is already completed' });
        }

        donation.status = 'completed';
        donation.feedback = { rating, comment };

        // Update timeline
        donation.addStatusHistory(req.user._id, 'Donation successfully completed and verified.');
        await donation.save();

        // --- IMPACT ENGINE (US 7.1 & 7.2) ---
        const weight = convertToWeight(donation.quantity);
        const meals = calculateMeals(weight);
        const co2Basis = calculateCo2Savings(weight);

        // Update Daily Global Aggregate
        const today = new Date().setHours(0, 0, 0, 0);
        await ImpactMetric.findOneAndUpdate(
            { date: today },
            {
                $inc: {
                    totalMeals: meals,
                    totalCo2: co2Basis,
                    donationsCompleted: 1,
                    totalWeightKg: weight
                },
                $addToSet: {
                    donors: donation.donor,
                    ngos: donation.claimedBy
                }
            },
            { upsert: true, new: true }
        );

        // 1. Update Donor (Trust & Impact)
        const donor = await User.findById(donation.donor);
        if (donor) {
            const currentScore = donor.stats.trustScore || 5.0;
            const currentCount = donor.stats.totalRatings || 0;
            const newCount = currentCount + 1;
            const newScore = ((currentScore * currentCount) + Number(rating)) / newCount;

            // US 7.4: Sustainability Credits Logic
            const baseCredits = 50;
            const weightBonus = Math.floor(weight * 5);
            const ratingBonus = Math.max(0, (Number(rating) - 3) * 10);
            const totalCreditsAwarded = baseCredits + weightBonus + ratingBonus;

            donor.stats.trustScore = parseFloat(newScore.toFixed(2));
            donor.stats.totalRatings = newCount;
            donor.stats.completedDonations = (donor.stats.completedDonations || 0) + 1;
            donor.stats.mealsSaved = (donor.stats.mealsSaved || 0) + meals;
            donor.stats.co2Saved = (donor.stats.co2Saved || 0) + co2Basis;
            donor.stats.sustainabilityCredits = (donor.stats.sustainabilityCredits || 0) + totalCreditsAwarded;
            await donor.save();
        }

        // 2. Update NGO (Utilization & Impact)
        if (donation.claimedBy) {
            const ngo = await User.findById(donation.claimedBy);
            if (ngo) {
                // NGOs get credits for processing rescues
                const ngoCredits = 30 + Math.floor(weight * 2);

                ngo.stats.completedDonations = (ngo.stats.completedDonations || 0) + 1;
                ngo.stats.mealsSaved = (ngo.stats.mealsSaved || 0) + meals;
                ngo.stats.co2Saved = (ngo.stats.co2Saved || 0) + co2Basis;
                ngo.stats.sustainabilityCredits = (ngo.stats.sustainabilityCredits || 0) + ngoCredits;
                await ngo.save();
            }
        }

        // 3. Update Volunteer (Credits & Tier Promotion)
        if (donation.volunteer) {
            const volunteer = await User.findById(donation.volunteer);
            if (volunteer) {
                // Volunteers get higher base credits for the physical labor
                const volCredits = 80 + Math.floor(weight * 8);

                volunteer.stats.completedDonations = (volunteer.stats.completedDonations || 0) + 1;
                volunteer.stats.mealsSaved = (volunteer.stats.mealsSaved || 0) + meals;
                volunteer.stats.co2Saved = (volunteer.stats.co2Saved || 0) + co2Basis;
                volunteer.stats.sustainabilityCredits = (volunteer.stats.sustainabilityCredits || 0) + volCredits;

                // Tier logic: 10 missions = Hero, 50 missions = Champion
                const totalMissions = volunteer.stats.completedDonations;
                const oldTier = volunteer.volunteerProfile?.tier || 'rookie';

                if (totalMissions >= 50) {
                    volunteer.volunteerProfile.tier = 'champion';
                } else if (totalMissions >= 10) {
                    volunteer.volunteerProfile.tier = 'hero';
                }

                // Notify volunteer if they leveled up
                if (oldTier !== volunteer.volunteerProfile.tier) {
                    await createNotification(
                        volunteer._id,
                        `🎉 Rank Up! You are now a Surplus ${volunteer.volunteerProfile.tier.charAt(0).toUpperCase() + volunteer.volunteerProfile.tier.slice(1)}!`,
                        'level_up',
                        donation._id
                    );
                }

                await volunteer.save();
            }
        }

        // 3. Notify Stakeholders
        if (donation.volunteer) {
            await createNotification(
                donation.volunteer,
                'mission_verified',
                'donation_completed',
                donation._id,
                { title: donation.title, meals }
            );
        }

        await createNotification(
            donation.donor,
            'donation_completed',
            'donation_completed',
            donation._id,
            { title: donation.title, meals }
        );

        res.json(donation);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Generate a smart, prioritized feed for NGOs
 * @route   GET /api/v1/donations/feed
 * @access  Private (NGO)
 * @description Ranks donations based on proximity, urgency (expiry), and NGO capacity.
 */
export const getSmartFeed = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'ngo') {
            return res.status(403).json({ message: 'Only NGOs can access the feed' });
        }

        const { storageFacilities, dailyCapacity } = user.ngoProfile;

        // Execute AI-driven matching service
        let donations = [];
        let unmetNeed = 0;
        let capacityWarning = false;

        try {
            if (user.coordinates && user.coordinates.lat && user.coordinates.lng) {
                // Background Patch: Ensure legacy location field is populated for geospatial queries
                if (!user.location || (user.location.coordinates[0] === 0 && user.location.coordinates[1] === 0)) {
                    user.location = {
                        type: 'Point',
                        coordinates: [user.coordinates.lng, user.coordinates.lat]
                    };
                    await user.save();
                }

                // Core Logic: Find best donations within radius
                donations = await findBestDonationsForNGO(req.user.id);

                // Global Fallback for Testing / Low Density areas
                if (donations.length === 0) {
                    donations = await Donation.find({ status: 'active' })
                        .populate('donor', 'name organization')
                        .sort({ createdAt: -1 })
                        .limit(10);
                }

                unmetNeed = await getUnmetNeed(req.user.id);
                capacityWarning = dailyCapacity > 0 && donations.length > 0 && unmetNeed <= 0;
            } else {
                // Baseline Fallback: Return simple time-sorted active donations
                donations = await Donation.find({ status: 'active' })
                    .populate('donor', 'name organization')
                    .sort({ createdAt: -1 })
                    .limit(20);
            }
        } catch (matchingError) {
            console.error('Matching service error:', matchingError);
            const query = { status: 'active' };
            if (storageFacilities && storageFacilities.length > 0) {
                query.storageReq = { $in: storageFacilities };
            }
            donations = await Donation.find(query)
                .populate('donor', 'name organization')
                .sort({ createdAt: -1 })
                .limit(20);
        }

        res.json({
            donations: donations.map(d => ({
                ...d._doc || d,
                matchPercentage: d.matchPercentage || undefined,
                suitabilityScore: d.suitabilityScore || undefined,
                urgencyLevel: d.urgencyLevel || undefined,
            })),
            capacityWarning,
            unmetNeed,
            count: donations.length
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Claim an active donation for distribution
 * @route   PATCH /api/v1/donations/:id/claim
 * @access  Private (NGO)
 * @description Validates safety thresholds before allowing a claim.
 */
export const claimDonation = async (req, res, next) => {
    try {
        const donation = await Donation.findById(req.params.id);
        if (!donation) return res.status(404).json({ message: 'Donation not found' });
        if (donation.status !== 'active') return res.status(400).json({ message: 'Donation is no longer active' });

        // Logistic Safety Check: 30-minute buffer before expiry
        const now = new Date();
        const minsRemaining = (new Date(donation.expiryDate) - now) / (1000 * 60);
        if (minsRemaining < 30) {
            return res.status(400).json({
                message: 'Safety Threshold Reached: This donation is too close to expiry for safe transport.'
            });
        }

        donation.status = 'assigned';
        donation.claimedBy = req.user.id;
        donation.claimedAt = Date.now();

        // Update timeline
        donation.addStatusHistory(req.user._id, `Claimed by NGO: ${req.user.organization}`);
        await donation.save();

        // Audit Log
        await AuditLog.create({
            action: 'CLAIM_DONATION',
            category: 'donation',
            userId: req.user._id,
            metadata: { donationId: donation._id, title: donation.title },
        });

        await createNotification(
            donation.donor,
            'donation_assigned',
            'donation_assigned',
            donation._id,
            { title: donation.title, organization: req.user.organization }
        );

        // Immediate Dispatch: Alert top suitable volunteers
        initiateAutoDispatch(donation._id);

        res.json(donation);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Automated Mission Reassignment (Supervisor Function)
 * @description Logic to handle stalled or abandoned missions by redistributing tasks.
 * @param   {string} donationId - The ID of the mission to reassign
 * @param   {string} reason - Justification for reassignment
 */
export const reassignMission = async (donationId, reason = 'Stalled or abandoned') => {
    try {
        const donation = await Donation.findById(donationId).populate('volunteer');
        if (!donation) return;

        const oldVolunteer = donation.volunteer;

        // Reset Mission State for New Assignment
        donation.volunteer = undefined;
        donation.deliveryStatus = 'idle';
        donation.status = 'assigned';
        donation.estimatedArrivalAt = undefined;

        // Update timeline
        donation.addStatusHistory(null, `Mission reassigned. Reason: ${reason}`); // System action
        await donation.save();

        if (oldVolunteer) {
            // Adjust volunteer work-load metrics
            await User.findByIdAndUpdate(oldVolunteer._id, {
                $inc: { currentTaskCount: -1 },
                $set: { 'volunteerProfile.lastLocationUpdate': new Date(0) } // Reset heartbeat status
            });

            await createNotification(
                oldVolunteer._id,
                `The mission for "${donation.title}" has been unassigned due to: {reason}.`,
                'general',
                donation._id,
                { reason }
            );

            // Notify Donor and NGO about re-assignment
            await createNotification(
                donation.donor,
                'mission_reassigned',
                'mission_reassigned',
                donation._id,
                { title: donation.title }
            );

            if (donation.claimedBy) {
                await createNotification(
                    donation.claimedBy,
                    'mission_reassigned',
                    'mission_reassigned',
                    donation._id,
                    { title: donation.title }
                );
            }
        }

        // High-Priority Push to next available tier of volunteers
        console.log(`[Supervisor] Reassigning mission ${donationId} due to ${reason}`);
        initiateAutoDispatch(donationId, true);

    } catch (error) {
        console.error('[Supervisor] Reassignment failed:', error);
    }
};

/**
 * @desc    Internal Dispatch Logic: Multi-tiered notification engine
 * @description Implements tiered delays (30s) to give high-suitability volunteers the "First Right of Refusal".
 * @param   {string} donationId - The mission to dispatch
 * @param   {boolean} isRetry - Whether this is a high-priority reassignment
 */
export const initiateAutoDispatch = async (donationId, isRetry = false) => {
    try {
        const donation = await Donation.findById(donationId);
        if (!donation) return;

        // Discovery: Find volunteers within 10km grid
        const topVolunteers = await findSuitableVolunteers(donation, 10000);
        if (topVolunteers.length === 0) {
            console.log(`[Auto-Dispatch] No volunteers found for donation ${donationId} within 10km.`);
            return;
        }

        const priorityVolunteers = topVolunteers.slice(0, 3);

        donation.dispatchedTo = priorityVolunteers.map(v => v._id);
        donation.dispatchedAt = new Date();
        await donation.save();

        console.log(`[Auto-Dispatch] Dispatching donation ${donationId} to ${priorityVolunteers.length} volunteers.`);

        const isTest = process.env.NODE_ENV === 'test';

        // Strategy: Sequence notifications to prevent multiple volunteers from racing to the same item
        priorityVolunteers.forEach((volunteer, index) => {
            const delay = isTest ? 0 : index * 30000;

            setTimeout(async () => {
                const freshDonation = await Donation.findById(donationId);
                if (freshDonation && freshDonation.status === 'assigned' && !freshDonation.volunteer) {
                    const message = isRetry ?
                        `URGENT REASSIGNMENT: "${donation.title}" needs a volunteer immediately!` :
                        `New Mission: A donation "${donation.title}" is available near you!`;

                    await createNotification(
                        volunteer._id,
                        message,
                        'priority_dispatch',
                        donation._id,
                        {
                            title: donation.title,
                            foodType: donation.foodType,
                            quantity: donation.quantity,
                            distance: (volunteer.distance / 1000).toFixed(1)
                        }
                    );
                }
            }, delay);
        });

    } catch (error) {
        console.error('[Auto-Dispatch] Error:', error);
    }
};

/**
 * @desc    Reject a donation due to safety or quality concerns
 * @route   PATCH /api/v1/donations/:id/reject
 * @access  Private (NGO)
 */
export const rejectDonation = async (req, res, next) => {
    try {
        const { rejectionReason } = req.body;

        if (!rejectionReason) {
            return res.status(400).json({ message: 'A rejection reason is required for safety auditing.' });
        }

        const donation = await Donation.findById(req.params.id).populate('donor', 'name email');

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (!['active', 'assigned'].includes(donation.status)) {
            return res.status(400).json({ message: 'This donation is already closed or completed.' });
        }

        donation.status = 'rejected';
        donation.rejectionReason = rejectionReason;

        // Update timeline
        donation.addStatusHistory(req.user._id, `Rejected by NGO. Reason: ${rejectionReason}`);
        await donation.save();

        // Governance: Create Rejection Log Entry (US 4.4)
        const isSafety = rejectionReason.toLowerCase().includes('safety') ||
            rejectionReason.toLowerCase().includes('unsafe') ||
            rejectionReason.toLowerCase().includes('spoil') ||
            rejectionReason.toLowerCase().includes('mold') ||
            rejectionReason.includes('[Safety Issue]');

        await RejectionLog.create({
            donationId: donation._id,
            ngoId: req.user._id,
            rejectionReason: rejectionReason,
            isSafetyIssue: isSafety
        });

        let formattedReason = rejectionReason;
        const reasonMatch = rejectionReason.match(/^\[(.*?)\]\s*(.*)$/);
        if (reasonMatch) {
            formattedReason = `${reasonMatch[1]}`;
            if (reasonMatch[2]) formattedReason += ` - ${reasonMatch[2]}`;
        }

        // Notification: App Warning
        if (donation.donor) {
            await createNotification(
                donation.donor._id || donation.donor,
                'donation_rejected',
                'donation_rejected',
                donation._id,
                { title: donation.title, reason: formattedReason }
            );
        }

        // Notification: Professional Safety Email
        try {
            const emailHtml = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                <div style="background-color: #0f172a; padding: 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px;">SurplusLink</h1>
                </div>
                
                <div style="padding: 32px; background-color: #ffffff;">
                    <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Update on your Donation</h2>
                    
                    <p style="color: #475569; line-height: 1.6; margin-bottom: 24px;">Hello <strong>${donation.donor.name}</strong>,</p>
                    
                    <p style="color: #475569; line-height: 1.6; margin-bottom: 24px;">
                        Use of our platform helps reduce waste, and we appreciate your effort. However, an NGO has flagged your donation <strong>"${donation.title}"</strong> as unable to be distributed.
                    </p>

                    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin-bottom: 24px; border-radius: 6px;">
                        <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Reason for Rejection</p>
                        <p style="margin: 8px 0 0 0; color: #7f1d1d; font-size: 16px;">${formattedReason}</p>
                    </div>

                    <p style="color: #475569; line-height: 1.6; font-size: 14px;">
                        Please ensure future donations meet our <strong>Safety & Hygiene Standards</strong> to avoid account restrictions. We prioritize the health of all recipients.
                    </p>

                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                        <p style="color: #64748b; line-height: 1.5; font-size: 14px; margin: 0;">
                            Best regards,<br>
                            <span style="color: #0f172a; font-weight: 600;">The SurplusLink Safety Team</span>
                        </p>
                    </div>
                </div>
                
                <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                        &copy; ${new Date().getFullYear()} SurplusLink. All rights reserved.
                    </p>
                </div>
            </div>
            `;

            if (donation.donor && donation.donor.email) {
                await sendEmail({
                    email: donation.donor.email,
                    subject: 'Action Required: Donation Update',
                    message: `Your donation was rejected. Reason: ${formattedReason}`,
                    html: emailHtml
                });
            }
        } catch (emailError) {
            console.error('Failed to send rejection email:', emailError);
        }

        res.json(donation);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get list of all current and historical claims for an NGO
 * @route   GET /api/v1/donations/claimed
 * @access  Private (NGO)
 */
export const getClaimedDonations = async (req, res, next) => {
    try {
        const donations = await Donation.find({ claimedBy: req.user._id })
            .sort({ updatedAt: -1 })
            .populate('donor', 'name organization coordinates')
            .populate('volunteer', 'name email phone avatar volunteerProfile.currentLocation');
        res.json(donations);
    } catch (error) {
        next(error);
    }
};
/**
 * @desc    Find suitable missions for online volunteers
 * @route   GET /api/v1/donations/available-missions
 * @access  Private (Volunteer)
 * @description Filters by proximity, vehicle capacity, and implementation of the "First Right of Refusal" 2-minute lock.
 */
export const getAvailableMissions = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        // State Check: Only online volunteers can receive tasks
        if (!user.isOnline) {
            return res.status(400).json({ message: 'You must be online to find missions.' });
        }

        const { maxWeight, currentLocation } = user.volunteerProfile || {};

        const query = {
            status: 'assigned',
            deliveryStatus: 'idle',
            volunteer: { $exists: false },
        };

        let donations;

        const now = new Date();
        const safetyThreshold = new Date(now.getTime() + 30 * 60000); // Expiry > 30m
        const lockThreshold = new Date(now.getTime() - 2 * 60000); // 2 minute lock window

        // Logistic Rule: Honor the 2-minute priority period for dispatched volunteers
        const lockFilter = {
            $or: [
                { dispatchedAt: { $exists: false } },
                { dispatchedAt: { $lt: lockThreshold } },
                { dispatchedTo: req.user.id }
            ]
        };

        const baseQuery = {
            ...query,
            expiryDate: { $gt: safetyThreshold },
            ...lockFilter
        };

        if (currentLocation && currentLocation.coordinates && currentLocation.coordinates.length === 2) {
            donations = await Donation.find({
                ...baseQuery,
                coordinates: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: currentLocation.coordinates
                        }
                    }
                }
            }).populate('donor', 'name address stats.trustScore').populate('claimedBy', 'organization address');
        } else {
            donations = await Donation.find(baseQuery).populate('donor', 'name address stats.trustScore').populate('claimedBy', 'organization address');
        }

        // Capacity Rule: Filter missions based on volunteer vehicle weight limits
        const suitableMissions = donations.filter(donation => {
            if (!maxWeight) return true;

            const quantityStr = String(donation.quantity).toLowerCase();
            const match = quantityStr.match(/(\d+(\.\d+)?)/);
            if (match) {
                const weight = parseFloat(match[0]);
                return weight <= maxWeight;
            }
            return true;
        });

        res.json(suitableMissions);

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Commit to a specific delivery mission
 * @route   PATCH /api/v1/donations/:id/accept-mission
 * @access  Private (Volunteer)
 */
export const acceptMission = async (req, res, next) => {
    try {
        const donationId = req.params.id;
        const volunteerId = req.user.id;

        const donation = await Donation.findById(donationId);
        if (!donation) {
            return res.status(400).json({ message: 'Mission not found.' });
        }

        const now = new Date();
        const minsRemaining = (new Date(donation.expiryDate) - now) / (1000 * 60);
        if (minsRemaining < 30) {
            return res.status(400).json({
                message: 'Safety Threshold Reached: Too close to expiry for safe delivery.'
            });
        }

        // Atomic Transaction: Ensure no two volunteers can claim the same mission
        const updatedDonation = await Donation.findOneAndUpdate(
            {
                _id: donationId,
                status: 'assigned',
                deliveryStatus: 'idle',
                volunteer: { $exists: false }
            },
            {
                volunteer: volunteerId,
                deliveryStatus: 'pending_pickup',
                $set: {
                    status: 'assigned',
                    estimatedArrivalAt: new Date(Date.now() + 60 * 60000) // Baseline 1-hour ETA prediction
                }
            },
            { new: true }
        ).populate('donor', 'name email').populate('claimedBy', 'organization email');

        if (!updatedDonation) {
            return res.status(400).json({ message: 'Mission already taken.' });
        }

        // Update timeline
        updatedDonation.addStatusHistory(req.user._id, `Mission accepted by volunteer: ${req.user.name}`);
        await updatedDonation.save();

        // Update Volunteer State for Equity & Load Balancing
        await User.findByIdAndUpdate(volunteerId, {
            $inc: { currentTaskCount: 1 },
            $set: {
                'volunteerProfile.lastMissionDate': new Date(),
                'volunteerProfile.lastLocationUpdate': new Date()
            }
        });

        const donationFinal = updatedDonation;
        const volunteerName = req.user.name;

        await createNotification(
            donationFinal.donor._id,
            'volunteer_accepted',
            'volunteer_accepted',
            donationFinal._id,
            { name: volunteerName, title: donationFinal.title }
        );

        if (donationFinal.claimedBy) {
            await createNotification(
                donationFinal.claimedBy._id,
                `Volunteer ${volunteerName} has accepted your delivery and is heading to the donor.`,
                'volunteer_accepted',
                donationFinal._id
            );
        }

        res.json(donationFinal);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update the granular stage of a delivery mission
 * @route   PATCH /api/v1/donations/:id/delivery-status
 * @access  Private (Volunteer)
 */
export const updateDeliveryStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const validStatuses = ['heading_to_pickup', 'at_pickup', 'in_transit', 'arrived_at_delivery'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status update for this endpoint' });
        }

        const donation = await Donation.findById(req.params.id);

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (donation.volunteer && donation.volunteer.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized for this mission' });
        }

        donation.deliveryStatus = status;

        // Update timeline
        donation.addStatusHistory(req.user._id, `Delivery status updated to: ${status.replace(/_/g, ' ')}`);
        await donation.save();

        // Safety Heartbeat: Update volunteer's activity timestamp
        await User.findByIdAndUpdate(req.user.id, {
            $set: { 'volunteerProfile.lastLocationUpdate': new Date() }
        });

        res.json(donation);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Confirm food pickup with photo proof
 * @route   PATCH /api/v1/donations/:id/pickup
 * @access  Private (Volunteer)
 */
export const confirmPickup = async (req, res, next) => {
    try {
        const pickupPhoto = req.file ? req.file.path : null;

        if (!pickupPhoto) {
            return res.status(400).json({ message: 'Proof of pickup (photo) is required' });
        }

        const donation = await Donation.findById(req.params.id).populate('claimedBy', 'organization');

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (!donation.volunteer || donation.volunteer.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized for this mission' });
        }

        const allowedForPickup = ['pending_pickup', 'heading_to_pickup', 'at_pickup'];
        if (!allowedForPickup.includes(donation.deliveryStatus)) {
            return res.status(400).json({ message: `Cannot pickup from current status: ${donation.deliveryStatus}` });
        }

        donation.deliveryStatus = 'picked_up';
        donation.pickupPhoto = pickupPhoto;
        donation.pickedUpAt = Date.now();

        // Update timeline
        donation.addStatusHistory(req.user._id, 'Food successfully picked up from donor.');
        await donation.save();

        if (donation.claimedBy) {
            await createNotification(
                donation.claimedBy._id,
                'donation_picked_up',
                'donation_picked_up',
                donation._id,
                { title: donation.title, name: req.user.name }
            );
        }

        await createNotification(
            donation.donor,
            'donation_picked_up',
            'donation_picked_up',
            donation._id,
            { title: donation.title, name: req.user.name }
        );

        res.json(donation);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Confirm final delivery and upload NGO handoff proof
 * @route   PATCH /api/v1/donations/:id/deliver
 * @access  Private (Volunteer)
 */
export const confirmDelivery = async (req, res, next) => {
    try {
        const deliveryPhoto = req.file ? req.file.path : null;
        const { notes } = req.body;

        if (!deliveryPhoto) {
            return res.status(400).json({ message: 'Proof of delivery (photo) is required' });
        }

        const donation = await Donation.findById(req.params.id).populate('claimedBy', 'organization');

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (!donation.volunteer || donation.volunteer.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized for this mission' });
        }

        const allowedPreviousStates = ['picked_up', 'in_transit', 'arrived_at_delivery'];
        if (!allowedPreviousStates.includes(donation.deliveryStatus)) {
            return res.status(400).json({ message: 'Cannot confirm delivery. Ensure item is picked up first.' });
        }

        donation.deliveryStatus = 'delivered';
        donation.deliveryPhoto = deliveryPhoto;
        donation.deliveryNotes = notes;
        donation.deliveredAt = Date.now();

        // Update timeline
        donation.addStatusHistory(req.user._id, `Food delivered to NGO: ${donation.claimedBy?.organization || 'NGO'}`);
        await donation.save();

        // Level-Up Engine: Update volunteer rank based on successful physical completion
        const volunteer = await User.findById(req.user.id);
        if (volunteer) {
            const oldTier = volunteer.volunteerProfile.tier;

            // Calculate metrics
            const weight = convertToWeight(donation.quantity);
            const meals = calculateMeals(weight);
            const co2Basis = calculateCo2Savings(weight);

            // US 7.4: Sustainability Credits for Volunteers (Higher rewards for logistics)
            const volCredits = 75 + Math.floor(weight * 10);

            volunteer.stats.completedDonations = (volunteer.stats.completedDonations || 0) + 1;
            volunteer.stats.mealsSaved = (volunteer.stats.mealsSaved || 0) + meals;
            volunteer.stats.co2Saved = (volunteer.stats.co2Saved || 0) + co2Basis;
            volunteer.stats.sustainabilityCredits = (volunteer.stats.sustainabilityCredits || 0) + volCredits;
            volunteer.currentTaskCount = Math.max(0, (volunteer.currentTaskCount || 1) - 1);

            // Tier Calculation
            const count = volunteer.stats.completedDonations;
            let newTier = 'rookie';
            if (count >= 50) newTier = 'champion';
            else if (count >= 10) newTier = 'hero';

            if (newTier !== oldTier) {
                volunteer.volunteerProfile.tier = newTier;
                await createNotification(
                    volunteer._id,
                    'promoted',
                    'general',
                    null,
                    { tier: newTier.toUpperCase() }
                );
            }
            await volunteer.save();
        }

        if (donation.claimedBy) {
            await createNotification(
                donation.claimedBy._id,
                'donation_delivered',
                'donation_delivered',
                donation._id,
                { title: donation.title }
            );
        }

        await createNotification(
            donation.donor,
            'donation_delivered',
            'donation_delivered',
            donation._id,
            { title: donation.title }
        );

        res.json(donation);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Volunteer reports a failure or drops an active mission
 * @route   PATCH /api/v1/donations/:id/fail-mission
 * @access  Private (Volunteer)
 */
export const failMission = async (req, res, next) => {
    try {
        const { failureReason } = req.body;

        if (!failureReason) {
            return res.status(400).json({ message: 'A failure reason is required.' });
        }

        const donation = await Donation.findById(req.params.id).populate('claimedBy', 'organization');

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (donation.volunteer && donation.volunteer.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized.' });
        }

        const volunteerName = req.user.name;

        // Reset and Trigger Re-dispatch
        await reassignMission(donation._id, `Volunteer Reported Failure: ${failureReason}`);

        await User.findByIdAndUpdate(req.user.id, {
            $inc: { 'stats.cancelledDonations': 1 }
        });

        if (donation.claimedBy) {
            await createNotification(
                donation.claimedBy._id,
                'mission_reassigned',
                'mission_reassigned',
                donation._id,
                { title: donation.title }
            );
        }

        res.json({ message: 'Mission failed and reset successfully', donation });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get the volunteer's current ongoing mission
 * @route   GET /api/v1/donations/active-mission
 * @access  Private (Volunteer)
 */
export const getVolunteerActiveMission = async (req, res, next) => {
    try {
        const activeMission = await Donation.findOne({
            volunteer: req.user.id,
            deliveryStatus: { $in: ['pending_pickup', 'heading_to_pickup', 'at_pickup', 'picked_up', 'in_transit', 'arrived_at_delivery'] }
        })
            .populate('donor', 'name address email organization coordinates')
            .populate('claimedBy', 'organization address email coordinates')
            .populate('volunteer', 'name');

        res.json(activeMission);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Retrieve historical log of missions completed by a volunteer
 * @route   GET /api/v1/donations/volunteer/history
 * @access  Private (Volunteer)
 */
export const getVolunteerHistory = async (req, res, next) => {
    try {
        const history = await Donation.find({
            volunteer: req.user.id,
            status: 'completed'
        }).sort({ updatedAt: -1 })
            .populate('donor', 'name organization')
            .populate('claimedBy', 'organization')
            .populate('volunteer', 'name');

        res.json(history);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Admin Monitoring: Global view of all missions currently in-transit
 * @route   GET /api/v1/donations/admin/active-missions
 * @access  Private (Admin)
 */
export const getAdminActiveMissions = async (req, res, next) => {
    try {
        const activeMissions = await Donation.find({
            deliveryStatus: { $in: ['pending_pickup', 'heading_to_pickup', 'at_pickup', 'picked_up', 'in_transit', 'arrived_at_delivery'] }
        })
            .populate('volunteer', 'name volunteerProfile.currentLocation volunteerProfile.vehicleType isOnline')
            .populate('donor', 'name address coordinates')
            .populate('claimedBy', 'organization address');

        res.json(activeMissions);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get suitability-ranked list of NGOs for a donation (UI recommendation)
 * @route   GET /api/v1/donations/:id/best-ngos
 * @access  Private (Donor)
 */
export const getBestNGOs = async (req, res, next) => {
    try {
        const donationId = req.params.id;
        const donation = await Donation.findById(donationId);

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (donation.donor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const bestNGOs = await findBestNGOsForDonation(donationId);
        res.json(bestNGOs);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get dynamic, optimized delivery route from volunteer to donor to NGO
 * @route   GET /api/v1/donations/:id/optimized-route
 * @access  Private (Volunteer)
 * @description Injects "Dynamic Diversions" if a high-priority nearby mission is detected.
 */
export const getOptimizedRoute = async (req, res, next) => {
    try {
        const donationId = req.params.id;
        const volunteerId = req.user.id;

        const donation = await Donation.findById(donationId)
            .populate('donor', 'coordinates address')
            .populate('claimedBy', 'location address');

        if (!donation) {
            return res.status(404).json({ message: 'Donation not found.' });
        }

        const user = await User.findById(volunteerId);
        const volunteerCoords = user.volunteerProfile?.currentLocation?.coordinates;

        if (!volunteerCoords || volunteerCoords[0] === 0) {
            return res.status(400).json({ message: 'Volunteer location not available.' });
        }

        const stops = [
            {
                id: 'pickup',
                type: 'pickup',
                coordinates: donation.coordinates.coordinates,
                address: donation.pickupAddress,
                priority: 5
            },
            {
                id: 'dropoff',
                type: 'dropoff',
                coordinates: donation.claimedBy?.location?.coordinates || [0, 0],
                address: donation.claimedBy?.address,
                priority: 5
            }
        ];

        // Logic: Diversion Scanner
        const now = new Date();
        const urgencyThreshold = new Date(now.getTime() + 60 * 60000); // Items expiring < 1hr

        const highPriorityDonations = await Donation.find({
            status: 'assigned',
            deliveryStatus: 'idle',
            volunteer: { $exists: false },
            expiryDate: { $lt: urgencyThreshold, $gt: now },
            coordinates: {
                $near: {
                    $geometry: { type: 'Point', coordinates: volunteerCoords },
                    $maxDistance: 5000 // 5km radius
                }
            }
        }).limit(1);

        if (highPriorityDonations.length > 0) {
            const extra = highPriorityDonations[0];
            stops.push({
                id: `diversion-${extra._id}`,
                type: 'pickup',
                coordinates: extra.coordinates.coordinates,
                address: extra.pickupAddress,
                priority: 10, // Override base path
                isDiversion: true,
                diversionDonationId: extra._id
            });
            console.log(`[Routing] High-priority diversion injected for mission ${extra._id}`);
        }

        const optimizedResult = await getOptimalPath(volunteerCoords, stops);

        res.json({
            missionId: donationId,
            currentLocation: { lng: volunteerCoords[0], lat: volunteerCoords[1] },
            ...optimizedResult,
            diversionSuggested: stops.length > 2
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Abort an accepted mission before pickup
 * @route   PATCH /api/v1/donations/:id/cancel-mission
 * @access  Private (Volunteer)
 */
export const cancelMission = async (req, res, next) => {
    try {
        const donation = await Donation.findById(req.params.id);
        if (!donation) return res.status(404).json({ message: 'Donation not found' });

        if (donation.volunteer?.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const { reason } = req.body || { reason: 'Emergency/Breakdown' };

        await reassignMission(donation._id, `Volunteer Emergency: ${reason}`);

        res.json({ message: 'Mission cancelled and sent for reassignment.' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Discovery: Locate and rank suitable volunteers for a specific donation
 * @route   GET /api/v1/donations/:id/potential-volunteers
 * @access  Private (NGO/Admin)
 */
export const getPotentialVolunteers = async (req, res, next) => {
    try {
        const donation = await Donation.findById(req.params.id);
        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        const volunteers = await findSuitableVolunteers(donation, 15000); // 15km search grid

        const response = volunteers.map(v => ({
            id: v._id,
            name: v.name,
            matchScore: v.suitabilityScore,
            distance: v.distance,
            tier: v.tier,
            vehicleType: v.volunteerProfile?.vehicleType
        }));

        res.json(response);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get system-wide metrics for the Admin dashboard
 * @route   GET /api/v1/donations/admin/stats
 * @access  Private (Admin)
 */
export const getAdminStats = async (req, res, next) => {
    try {
        const donationsToday = await Donation.countDocuments({
            createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
        });

        const activeRoutes = await Donation.countDocuments({
            status: { $in: ['assigned', 'picked_up'] }
        });

        const totalUsers = await User.countDocuments();

        const impact = await User.aggregate([
            { $group: { _id: null, meals: { $sum: "$stats.mealsSaved" }, co2: { $sum: "$stats.co2Saved" } } }
        ]);

        const monthlyDataMap = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const m = months[date.getMonth()];
            monthlyDataMap[m] = { month: m, donations: 0, impact: 0 };
        }

        const recentDonations = await Donation.find({
            status: 'completed',
            createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) }
        });

        recentDonations.forEach(d => {
            const m = months[new Date(d.createdAt).getMonth()];
            if (monthlyDataMap[m]) {
                monthlyDataMap[m].donations += 1;
                const match = String(d.quantity).match(/(\d+(\.\d+)?)/);
                monthlyDataMap[m].impact += match ? parseFloat(match[0]) : 1;
            }
        });

        res.json({
            donationsToday,
            activeRoutes,
            totalUsers,
            totalMealsSaved: impact[0]?.meals || 0,
            totalCo2Saved: impact[0]?.co2 || 0,
            monthlyData: Object.values(monthlyDataMap)
        });
    } catch (error) {
        next(error);
    }
};
