import { CreateProviderSchema, UpdateProviderSchema } from '@communique/core';
import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { protect } from '../../middlewares/protect.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  createProvider,
  deleteProvider,
  getProviderById,
  listProviders,
  updateProvider,
} from './providers.controller.js';

export const providersRoutes: Router = Router();
providersRoutes.use('/providers', ...protect);

providersRoutes.get('/providers', asyncHandler(listProviders));
providersRoutes.post('/providers', validate(CreateProviderSchema), asyncHandler(createProvider));
providersRoutes.get('/providers/:id', asyncHandler(getProviderById));
providersRoutes.patch('/providers/:id', validate(UpdateProviderSchema), asyncHandler(updateProvider));
providersRoutes.delete('/providers/:id', asyncHandler(deleteProvider));
