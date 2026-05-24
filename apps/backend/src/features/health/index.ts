import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';

import { live, ready } from './health.controller.js';

export function register(app: Express): void {
  const router = Router();
  router.get('/', asyncHandler(live));
  router.get('/ready', asyncHandler(ready));
  app.use('/health', router);
}
