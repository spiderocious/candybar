import type { Express } from 'express';

import { credentialsRoutes, workspacesPublicRoutes } from './workspaces.routes.js';

export function register(app: Express): void {
  app.use('/api/v1', workspacesPublicRoutes);
  app.use('/api/v1', credentialsRoutes);
}
