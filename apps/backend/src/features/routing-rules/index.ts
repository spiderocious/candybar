import type { Express } from 'express';

import { routingRulesRoutes } from './routing-rules.routes.js';

export function register(app: Express): void {
  app.use('/api/v1', routingRulesRoutes);
}
