import express from 'express';
import {
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
} from '../controllers/user.controller.js';
import { protect, roleBasedAccess } from '../middleware/auth.middleware.js';
import upload from '../config/cloudinary.js';

const userRouter = express.Router();

userRouter.get('/profile', protect, getUserProfile);
userRouter.put('/profile', protect, upload.single('avatar'), updateUserProfile);
userRouter.put('/verify-documents', protect, upload.single('verificationDoc'), submitVerification);
userRouter.patch('/verify', protect, roleBasedAccess(['admin']), verifyUser);
userRouter.get('/admin/users', protect, roleBasedAccess(['admin']), getUsers);
userRouter.get('/admin/pending', protect, roleBasedAccess(['admin']), getPendingVerifications);
userRouter.put('/profile/ngo', protect, roleBasedAccess(['ngo']), updateNGOSettings);
userRouter.patch('/volunteer/status', protect, roleBasedAccess(['volunteer']), toggleVolunteerStatus);
userRouter.patch('/volunteer/profile', protect, roleBasedAccess(['volunteer']), updateVolunteerProfile); // Updates static details
userRouter.patch('/volunteer/location', protect, roleBasedAccess(['volunteer']), updateVolunteerLocation); // Updates dynamic location
userRouter.get('/volunteer/stats', protect, roleBasedAccess(['volunteer']), getVolunteerStats);
userRouter.get('/ngo/volunteers', protect, roleBasedAccess(['ngo']), getNgoVolunteers);
userRouter.post('/reverse-geocode', protect, getAddressFromCoords);
userRouter.patch('/preferences', protect, updatePreferences);
userRouter.delete('/:id', protect, roleBasedAccess(['admin']), deleteUser);

export default userRouter;
