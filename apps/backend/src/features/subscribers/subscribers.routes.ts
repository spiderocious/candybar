import {
  AddChannelSchema,
  RegisterSubscriberSchema,
  SetOptOutSchema,
  UpdateSubscriberSchema,
} from '@communique/core';
import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { apiKeyAuth } from '../../middlewares/api-key-auth.middleware.js';
import { rateLimiter } from '../../middlewares/rate-limiter.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  addChannel,
  deleteSubscriber,
  getHistory,
  getSubscriber,
  listSubscribers,
  registerSubscriber,
  removeChannel,
  setOptOut,
  updateSubscriber,
} from './subscribers.controller.js';

export const subscribersRoutes = Router();
subscribersRoutes.use('/subscribers', asyncHandler(apiKeyAuth), rateLimiter);

subscribersRoutes.get('/subscribers', asyncHandler(listSubscribers));
subscribersRoutes.post(
  '/subscribers',
  validate(RegisterSubscriberSchema),
  asyncHandler(registerSubscriber),
);

// Sub-resources before the bare :id where it matters; Express matches by full path.
subscribersRoutes.get('/subscribers/:id/history', asyncHandler(getHistory));
subscribersRoutes.post(
  '/subscribers/:id/channels',
  validate(AddChannelSchema),
  asyncHandler(addChannel),
);
subscribersRoutes.delete('/subscribers/:id/channels/:channelId', asyncHandler(removeChannel));
subscribersRoutes.post(
  '/subscribers/:id/optouts',
  validate(SetOptOutSchema),
  asyncHandler(setOptOut),
);

subscribersRoutes.get('/subscribers/:id', asyncHandler(getSubscriber));
subscribersRoutes.patch(
  '/subscribers/:id',
  validate(UpdateSubscriberSchema),
  asyncHandler(updateSubscriber),
);
subscribersRoutes.delete('/subscribers/:id', asyncHandler(deleteSubscriber));
