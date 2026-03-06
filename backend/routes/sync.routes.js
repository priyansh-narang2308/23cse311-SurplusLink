import express from 'express';
import { syncBulkActions, getDeltaSync } from '../controllers/sync.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const syncRouter = express.Router();

syncRouter.use(protect);

syncRouter.post('/bulk', syncBulkActions);
syncRouter.get('/delta', getDeltaSync);

export default syncRouter;
