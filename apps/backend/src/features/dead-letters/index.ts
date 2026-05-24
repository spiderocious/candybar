import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { protect } from '../../middlewares/protect.js';

import {
  getDeadLetter,
  listDeadLetters,
  replayDeadLetter,
} from './dead-letters.controller.js';

export function register(app: Express): void {
  const router = Router();
  router.use('/dead-letters', ...protect);
  router.get('/dead-letters', asyncHandler(listDeadLetters));
  router.post('/dead-letters/:id/replay', asyncHandler(replayDeadLetter));
  router.get('/dead-letters/:id', asyncHandler(getDeadLetter));
  app.use('/api/v1', router);
}
