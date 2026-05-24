import { PublishEventSchema } from '@communique/core';
import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { protect } from '../../middlewares/protect.js';
import { validate } from '../../middlewares/validate.middleware.js';

import { getEvent, publishEvent } from './events.controller.js';

export const eventsRoutes: Router = Router();
eventsRoutes.use('/events', ...protect);

eventsRoutes.post('/events', validate(PublishEventSchema), asyncHandler(publishEvent));
eventsRoutes.get('/events/:id', asyncHandler(getEvent));
