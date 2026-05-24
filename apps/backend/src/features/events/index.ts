import type { Express } from 'express';

import { eventsRoutes } from './events.routes.js';

export function register(app: Express): void {
  app.use('/api/v1', eventsRoutes);
}
