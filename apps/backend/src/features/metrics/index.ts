import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { protect } from '../../middlewares/protect.js';

import { getMetrics } from './metrics.controller.js';

export function register(app: Express): void {
  const router = Router();
  router.use('/metrics', ...protect);
  router.get('/metrics', asyncHandler(getMetrics));
  app.use('/api/v1', router);
}
