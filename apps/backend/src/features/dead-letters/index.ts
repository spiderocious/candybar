import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { apiKeyAuth } from '../../middlewares/api-key-auth.middleware.js';
import { rateLimiter } from '../../middlewares/rate-limiter.middleware.js';

import {
  getDeadLetter,
  listDeadLetters,
  replayDeadLetter,
} from './dead-letters.controller.js';

export function register(app: Express): void {
  const router = Router();
  router.use('/dead-letters', asyncHandler(apiKeyAuth), rateLimiter);
  router.get('/dead-letters', asyncHandler(listDeadLetters));
  router.post('/dead-letters/:id/replay', asyncHandler(replayDeadLetter));
  router.get('/dead-letters/:id', asyncHandler(getDeadLetter));
  app.use('/api/v1', router);
}
