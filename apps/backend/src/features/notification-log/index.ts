import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { protect } from '../../middlewares/protect.js';

import { listLog } from './notification-log.controller.js';

export function register(app: Express): void {
  const router = Router();
  router.use('/notification-log', ...protect);
  router.get('/notification-log', asyncHandler(listLog));
  app.use('/api/v1', router);
}
