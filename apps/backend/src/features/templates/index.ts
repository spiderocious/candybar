import type { Express } from 'express';

import { templatesRoutes } from './templates.routes.js';

export function register(app: Express): void {
  app.use('/api/v1', templatesRoutes);
}
