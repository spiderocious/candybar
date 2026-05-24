import type { RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler.js';

import { apiKeyAuth } from './api-key-auth.middleware.js';
import { rateLimiter } from './rate-limiter.middleware.js';

/**
 * The standard guard chain for a workspace-scoped route group: resolve the API
 * credential, then rate-limit. BOTH are async and BOTH must be wrapped with
 * `asyncHandler` — a bare async middleware that rejects becomes an unhandled
 * promise rejection that crashes the process instead of reaching the error
 * handler. Bundling them here means a new feature can never forget the wrapper.
 *
 * Usage: `router.use('/things', ...protect);`
 */
export const protect: RequestHandler[] = [asyncHandler(apiKeyAuth), asyncHandler(rateLimiter)];
