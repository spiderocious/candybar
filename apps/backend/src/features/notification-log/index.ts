import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { apiKeyAuth } from '../../middlewares/api-key-auth.middleware.js';
import { rateLimiter } from '../../middlewares/rate-limiter.middleware.js';

import { listLog } from './notification-log.controller.js';

export function register(app: Express): void {
  const router = Router();
  router.use('/notification-log', asyncHandler(apiKeyAuth), rateLimiter);
  router.get('/notification-log', asyncHandler(listLog));
  app.use('/api/v1', router);
}
