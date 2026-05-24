import type { Express } from 'express';

import { providersRoutes } from './providers.routes.js';

export function register(app: Express): void {
  app.use('/api/v1', providersRoutes);
}
