/**
 * @module Public Routes
 * @description Unauthenticated routes accessible to anyone — used for the community food board.
 * No protect middleware is applied here intentionally.
 */
import express from 'express';
import { getOpenPickupDonations, softReserveDonation, getOpenDeliveryRequests } from '../controllers/donation.controller.js';

const router = express.Router();

// GET /api/v1/public/open-donations — community food board feed (no login)
router.get('/open-donations', getOpenPickupDonations);

// POST /api/v1/public/reserve/:id — soft walk-in reservation (no login)
router.post('/reserve/:id', softReserveDonation);

// GET /api/v1/public/open-delivery-requests — open-pickup donations needing volunteer delivery
router.get('/open-delivery-requests', getOpenDeliveryRequests);

export default router;
