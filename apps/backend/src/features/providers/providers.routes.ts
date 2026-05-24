import { CreateProviderSchema, UpdateProviderSchema } from '@communique/core';
import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { apiKeyAuth } from '../../middlewares/api-key-auth.middleware.js';
import { rateLimiter } from '../../middlewares/rate-limiter.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  createProvider,
  deleteProvider,
  getProviderById,
  listProviders,
  updateProvider,
} from './providers.controller.js';

export const providersRoutes: Router = Router();
providersRoutes.use('/providers', asyncHandler(apiKeyAuth), rateLimiter);

providersRoutes.get('/providers', asyncHandler(listProviders));
providersRoutes.post('/providers', validate(CreateProviderSchema), asyncHandler(createProvider));
providersRoutes.get('/providers/:id', asyncHandler(getProviderById));
providersRoutes.patch('/providers/:id', validate(UpdateProviderSchema), asyncHandler(updateProvider));
providersRoutes.delete('/providers/:id', asyncHandler(deleteProvider));
