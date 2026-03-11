/**
 * @module User & Profile Management Logic
 * @author Priyansh Narang
 * @description Handles the retrieval and modification of detailed user profiles,
 * organization settings for NGOs, and real-time logistics state (availability/location) for Volunteers.
 */

import User from '../models/User.model.js';
import Donation from '../models/Donation.model.js';
import { geocodeAddress, reverseGeocode } from '../utils/geocoder.js';

/**
 * @desc    Fetch authenticated user's full profile data
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
const getUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            // Apply Data Privacy Masking (EPIC 6)
            res.json(user.toJSON({ role: req.user.role, userId: req.user._id }));
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Approve/Reject organization verification status (Admin Action)
 * @route   PATCH /api/v1/users/verify
 * @access  Admin
 */
const verifyUser = async (req, res, next) => {
    const { userId, status } = req.body;

    try {
        const user = await User.findById(userId);

        if (user) {
            user.status = status || user.status;
            const updatedUser = await user.save();
            res.json({
                message: `User status updated to ${updatedUser.status}`,
                id: updatedUser.id,
                status: updatedUser.status
            });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Edit general user profile details (Name, Address, Avatar)
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
const updateUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.address = req.body.address || user.address;

            // Priority 1: Explicitly provided coordinates (Map Pin)
            // Priority 2: Automated geocoding from address string
            if (req.body.coordinates) {
                user.coordinates = req.body.coordinates;
            } else if (req.body.address && req.body.address !== user.address) {
                const geocoded = await geocodeAddress(req.body.address);
                if (geocoded) {
                    user.coordinates = geocoded;
                }
            }

            if (req.file) {
                user.avatar = req.file.path;
            } else if (req.body.avatar === '') {
                // Allow clearing avatar if explicitly passed as empty string
                user.avatar = undefined;
            }

            const updatedUser = await user.save();
            res.json(updatedUser);
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Submit KYC/Organization documents for verification
 * @route   PUT /api/v1/users/verify-documents
 * @access  Private
 */
const submitVerification = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.taxId = req.body.taxId || user.taxId;
            user.permitNumber = req.body.permitNumber || user.permitNumber;
            user.address = req.body.address || user.address;

            // Update coordinates if address is provided during verification
            if (req.body.address) {
                const geocoded = await geocodeAddress(req.body.address);
                if (geocoded) {
                    user.coordinates = geocoded;
                }
            }

            if (req.file) {
                user.documentUrl = req.file.path;
            }

            user.status = 'pending';

            const updatedUser = await user.save();

            res.json({
                success: true,
                message: 'Verification documents submitted successfully',
                user: {
                    id: updatedUser.id,
                    status: updatedUser.status,
                    documentUrl: updatedUser.documentUrl
                }
            });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get master list of all users on platform
 * @route   GET /api/v1/users/admin/users
 * @access  Admin
 */
const getUsers = async (req, res, next) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        // Apply Data Privacy Masking (EPIC 6)
        res.json(users.map(u => u.toJSON({ role: req.user.role, userId: req.user._id })));
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Retrieve organizations waiting for verification review
 * @route   GET /api/v1/users/admin/pending
 * @access  Admin
 */
const getPendingVerifications = async (req, res, next) => {
    try {
        const users = await User.find({
            status: 'pending',
            $or: [
                { taxId: { $exists: true } },
                { documentUrl: { $exists: true } }
            ]
        }).sort({ createdAt: -1 });
        // Apply Data Privacy Masking (EPIC 6)
        res.json(users.map(u => u.toJSON({ role: req.user.role, userId: req.user._id })));
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Configure NGO-specific settings (Capacity, Storage, etc.)
 * @route   PUT /api/v1/users/profile/ngo
 * @access  Private (NGO)
 */
const updateNGOSettings = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user && user.role === 'ngo') {
            const { dailyCapacity, storageFacilities, isUrgentNeed } = req.body;

            user.ngoProfile = {
                dailyCapacity: dailyCapacity !== undefined ? dailyCapacity : user.ngoProfile.dailyCapacity,
                storageFacilities: storageFacilities || user.ngoProfile.storageFacilities,
                isUrgentNeed: isUrgentNeed !== undefined ? isUrgentNeed : user.ngoProfile.isUrgentNeed,
            };

            const updatedUser = await user.save();
            res.json(updatedUser);
        } else {
            res.status(404);
            throw new Error('NGO profile not found or user is not an NGO');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Toggle volunteer online/offline status for dispatch
 * @route   PATCH /api/v1/users/volunteer/status
 * @access  Private (Volunteer)
 */
const toggleVolunteerStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user && user.role === 'volunteer') {
            user.isOnline = req.body.isOnline;
            const updatedUser = await user.save();
            res.json(updatedUser);
        } else {
            res.status(404);
            throw new Error('User not found or not a volunteer');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Configure volunteer profile (Vehicle type, max carrying weight)
 * @route   PATCH /api/v1/users/volunteer/profile
 * @access  Private (Volunteer)
 */
const updateVolunteerProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user && user.role === 'volunteer') {
            const { vehicleType, maxWeight } = req.body;

            if (vehicleType) {
                user.volunteerProfile.vehicleType = vehicleType;
            }
            if (maxWeight !== undefined) {
                user.volunteerProfile.maxWeight = maxWeight;
            }

            const updatedUser = await user.save();
            res.json(updatedUser);
        } else {
            res.status(404);
            throw new Error('User not found or not a volunteer');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Real-time GPS update for volunteer tracking and smart routing
 * @route   PATCH /api/v1/users/volunteer/location
 * @access  Private (Volunteer)
 */
const updateVolunteerLocation = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user && user.role === 'volunteer') {
            const { lat, lng } = req.body;

            if (lat !== undefined && lng !== undefined) {
                user.volunteerProfile.currentLocation = {
                    type: 'Point',
                    coordinates: [lng, lat], // GeoJSON expects [lng, lat]
                };

                // Also update main coordinates field for backward compatibility or general use
                user.coordinates = { lat, lng };
            }

            const updatedUser = await user.save();
            res.json(updatedUser);
        } else {
            res.status(404);
            throw new Error('User not found or not a volunteer');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get detailed impact metrics and leaderboard stats for a volunteer
 * @route   GET /api/v1/users/volunteer/stats
 * @access  Private (Volunteer)
 */
const getVolunteerStats = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user || user.role !== 'volunteer') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Source of Truth: Count actual completed missions from the database
        const completedMissions = await Donation.find({
            volunteer: user._id,
            $or: [
                { status: 'completed' },
                { deliveryStatus: 'delivered' }
            ]
        });

        const actualCompletedCount = completedMissions.length;
        const cancelledCount = user.stats.cancelledDonations || 0;
        const totalAccepted = actualCompletedCount + cancelledCount;

        // Reliability Score
        let reliabilityScore = 0;
        if (totalAccepted > 0) {
            reliabilityScore = (actualCompletedCount / totalAccepted) * 100;
        } else {
            reliabilityScore = 100;
        }

        // Total Impact (Weight moved)
        let totalImpact = 0;
        completedMissions.forEach(mission => {
            const match = String(mission.quantity).match(/(\d+(\.\d+)?)/);
            if (match) {
                totalImpact += parseFloat(match[0]);
            }
        });

        // Data Integrity Sync: Update cached stats if they divergence is found
        if (user.stats.completedDonations !== actualCompletedCount) {
            user.stats.completedDonations = actualCompletedCount;

            // Re-verify Tier based on corrected count
            if (actualCompletedCount >= 50) user.volunteerProfile.tier = 'champion';
            else if (actualCompletedCount >= 10) user.volunteerProfile.tier = 'hero';
            else user.volunteerProfile.tier = 'rookie';

            await user.save();
        }

        res.json({
            totalDeliveries: actualCompletedCount,
            totalImpact: parseFloat(totalImpact.toFixed(2)),
            reliabilityScore: parseFloat(reliabilityScore.toFixed(2)),
            tier: user.volunteerProfile.tier
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Find and manage volunteers associated with an NGO
 * @route   GET /api/v1/users/ngo/volunteers
 * @access  Private (NGO)
 */
const getNgoVolunteers = async (req, res, next) => {
    try {
        // Find all donations claimed by this NGO that have a volunteer assigned
        const donations = await Donation.find({
            claimedBy: req.user._id,
            volunteer: { $exists: true }
        }).populate('volunteer', 'name email phone avatar stats volunteerProfile isOnline');

        // Extract unique volunteers and format them for the dashboard
        const uniqueVolunteersMap = new Map();

        donations.forEach(donation => {
            if (donation.volunteer) {
                const vol = donation.volunteer;
                const volId = vol._id.toString();

                if (!uniqueVolunteersMap.has(volId)) {
                    // Determine status based on active missions
                    let currentTask = null;
                    let status = vol.isOnline ? 'available' : 'offline';

                    const onRouteStatuses = ['pending_pickup', 'at_pickup', 'picked_up', 'in_transit', 'arrived_at_delivery'];
                    if (onRouteStatuses.includes(donation.deliveryStatus)) {
                        status = 'on_route';
                        const isHeadingToPickup = ['pending_pickup', 'at_pickup'].includes(donation.deliveryStatus);
                        currentTask = isHeadingToPickup
                            ? `Picking up from ${donation.donorName || 'Donor'}`
                            : `Delivering to ${req.user.organization || 'NGO Center'}`;
                    } else if (donation.deliveryStatus === 'delivered' && donation.status !== 'completed') {
                        status = 'busy';
                        currentTask = 'Verification Pending';
                    }

                    uniqueVolunteersMap.set(volId, {
                        id: vol._id,
                        name: vol.name,
                        email: vol.email,
                        phone: vol.phone || '+1 234-567-8900',
                        status: status,
                        currentTask: currentTask,
                        completedTasks: vol.stats?.completedDonations || 0,
                        rating: vol.stats?.trustScore || 5.0,
                        avatar: vol.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${vol.name}`,
                    });
                }
            }
        });

        res.json(Array.from(uniqueVolunteersMap.values()));
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Reverse geocode coordinates to address
 * @route   POST /api/v1/users/reverse-geocode
 * @access  Private
 */
const getAddressFromCoords = async (req, res, next) => {
    try {
        const { lat, lng } = req.body;
        if (!lat || !lng) {
            return res.status(400).json({ message: 'Latitude and Longitude are required' });
        }

        const address = await reverseGeocode(lat, lng);
        if (address) {
            res.json({ address });
        } else {
            res.status(404).json({ message: 'Address not found for these coordinates' });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update user preferences (Language & Accessibility)
 * @route   PATCH /api/v1/users/preferences
 * @access  Private
 * @description Supports User Stories 7.5 and 7.6.
 */
const updatePreferences = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            const { language, accessibilityPreferences, notificationPreferences } = req.body;

            if (language) {
                user.language = language;
            }

            if (accessibilityPreferences) {
                user.accessibilityPreferences = {
                    ...user.accessibilityPreferences,
                    ...accessibilityPreferences
                };
            }

            if (notificationPreferences) {
                user.notificationPreferences = {
                    ...user.notificationPreferences,
                    ...notificationPreferences
                };
            }

            const updatedUser = await user.save();
            res.json({
                success: true,
                language: updatedUser.language,
                accessibilityPreferences: updatedUser.accessibilityPreferences,
                notificationPreferences: updatedUser.notificationPreferences
            });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Permanently delete a user from the database (Admin Action)
 * @route   DELETE /api/v1/users/:id
 * @access  Admin
 */
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            if (user.role === 'admin') {
                res.status(403);
                throw new Error('Admins cannot be deleted');
            }
            await User.findByIdAndDelete(req.params.id);
            res.json({ message: 'User removed successfully' });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};

export {
    getUserProfile,
    verifyUser,
    updateUserProfile,
    submitVerification,
    getUsers,
    getPendingVerifications,
    updateNGOSettings,
    toggleVolunteerStatus,
    updateVolunteerProfile,
    updateVolunteerLocation,
    getVolunteerStats,
    getNgoVolunteers,
    getAddressFromCoords,
    updatePreferences,
    deleteUser
};
