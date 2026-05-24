import type { Express } from 'express';

import { audiencesRoutes } from './audiences.routes.js';

export function register(app: Express): void {
  app.use('/api/v1', audiencesRoutes);
}
