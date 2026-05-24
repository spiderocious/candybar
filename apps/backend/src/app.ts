import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from './env.js';
import { register as registerAudiences } from './features/audiences/index.js';
import { register as registerDeadLetters } from './features/dead-letters/index.js';
import { register as registerEvents } from './features/events/index.js';
import { register as registerHealth } from './features/health/index.js';
import { register as registerMetrics } from './features/metrics/index.js';
import { register as registerNotificationLog } from './features/notification-log/index.js';
import { register as registerProviders } from './features/providers/index.js';
import { register as registerRoutingRules } from './features/routing-rules/index.js';
import { register as registerSubscribers } from './features/subscribers/index.js';
import { register as registerTemplates } from './features/templates/index.js';
import { register as registerTestDispatch } from './features/test-dispatch/index.js';
import { register as registerWorkspaces } from './features/workspaces/index.js';
import { errorHandler } from './middlewares/error-handler.middleware.js';
import { httpLoggerMiddleware } from './middlewares/http-logger.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { requestIdMiddleware } from './middlewares/request-id.middleware.js';

/**
 * Builds the Express app with middleware in a deliberate order and every feature
 * registered. Tests mount this directly (Supertest) — never the listening server.
 */
export function buildApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware); // seeds X-Request-Id + AsyncLocalStorage
  app.use(httpLoggerMiddleware);

  // Health first (no auth). Then features. Each mounts its own auth + rate limit.
  registerHealth(app);
  registerWorkspaces(app);
  registerSubscribers(app);
  registerAudiences(app);
  registerTemplates(app);
  registerProviders(app);
  registerRoutingRules(app);
  registerEvents(app);
  registerNotificationLog(app);
  registerDeadLetters(app);
  registerMetrics(app);
  registerTestDispatch(app);

  app.use(notFoundMiddleware); // unmatched routes → 1004
  app.use(errorHandler); // must be last
  return app;
}
