import { CreateCredentialSchema, CreateWorkspaceSchema } from '@communique/core';
import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { apiKeyAuth } from '../../middlewares/api-key-auth.middleware.js';
import { rateLimiter } from '../../middlewares/rate-limiter.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  createWorkspace,
  getWorkspace,
  issueCredential,
  listCredentials,
  revokeCredential,
  rotateCredential,
} from './workspaces.controller.js';

/** Unauthenticated bootstrap routes: create a workspace, fetch one by id. */
export const workspacesPublicRoutes: Router = Router();
workspacesPublicRoutes.post(
  '/workspaces',
  validate(CreateWorkspaceSchema),
  asyncHandler(createWorkspace),
);
workspacesPublicRoutes.get('/workspaces/:id', asyncHandler(getWorkspace));

/** Authenticated credential management (scoped to the calling workspace). */
export const credentialsRoutes: Router = Router();
credentialsRoutes.use('/workspace/credentials', asyncHandler(apiKeyAuth), rateLimiter);
credentialsRoutes.get('/workspace/credentials', asyncHandler(listCredentials));
credentialsRoutes.post(
  '/workspace/credentials',
  validate(CreateCredentialSchema),
  asyncHandler(issueCredential),
);
credentialsRoutes.post(
  '/workspace/credentials/:id/rotate',
  asyncHandler(rotateCredential),
);
credentialsRoutes.delete('/workspace/credentials/:id', asyncHandler(revokeCredential));
