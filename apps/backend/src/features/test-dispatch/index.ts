import { TestDispatchSchema } from '@communique/core';
import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { protect } from '../../middlewares/protect.js';
import { validate } from '../../middlewares/validate.middleware.js';

import { runTestDispatch } from './test-dispatch.controller.js';

export function register(app: Express): void {
  const router = Router();
  router.use('/test-dispatch', ...protect);
  router.post('/test-dispatch', validate(TestDispatchSchema), asyncHandler(runTestDispatch));
  app.use('/api/v1', router);
}
