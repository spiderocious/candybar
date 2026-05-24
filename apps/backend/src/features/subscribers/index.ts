import type { Express } from 'express';

import { subscribersRoutes } from './subscribers.routes.js';

export function register(app: Express): void {
  app.use('/api/v1', subscribersRoutes);
}
