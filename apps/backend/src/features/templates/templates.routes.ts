import { CreateTemplateSchema, PreviewTemplateSchema, PublishVersionSchema } from '@communique/core';
import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { apiKeyAuth } from '../../middlewares/api-key-auth.middleware.js';
import { rateLimiter } from '../../middlewares/rate-limiter.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  createTemplate,
  getTemplate,
  getVersion,
  listTemplates,
  listVersions,
  previewTemplate,
  publishVersion,
} from './templates.controller.js';

export const templatesRoutes = Router();
templatesRoutes.use('/templates', asyncHandler(apiKeyAuth), rateLimiter);

templatesRoutes.get('/templates', asyncHandler(listTemplates));
templatesRoutes.post('/templates', validate(CreateTemplateSchema), asyncHandler(createTemplate));

templatesRoutes.get('/templates/:id/versions/:version', asyncHandler(getVersion));
templatesRoutes.get('/templates/:id/versions', asyncHandler(listVersions));
templatesRoutes.post(
  '/templates/:id/versions',
  validate(PublishVersionSchema),
  asyncHandler(publishVersion),
);
templatesRoutes.post(
  '/templates/:id/preview',
  validate(PreviewTemplateSchema),
  asyncHandler(previewTemplate),
);

templatesRoutes.get('/templates/:id', asyncHandler(getTemplate));
