import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { apiKeyAuth } from '../../middlewares/api-key-auth.middleware.js';
import { rateLimiter } from '../../middlewares/rate-limiter.middleware.js';

import { getMetrics } from './metrics.controller.js';

export function register(app: Express): void {
  const router = Router();
  router.use('/metrics', asyncHandler(apiKeyAuth), rateLimiter);
  router.get('/metrics', asyncHandler(getMetrics));
  app.use('/api/v1', router);
}
