import type { NextFunction, Request, Response } from 'express';
import { ulid } from 'ulid';

import { runWithContext } from '../lib/request-context.js';

/** Seeds the request id + AsyncLocalStorage context and echoes X-Request-Id. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.header('x-request-id');
  const requestId = headerId && headerId.length > 0 ? headerId : ulid();
  res.setHeader('X-Request-Id', requestId);
  runWithContext({ requestId, method: req.method, path: req.originalUrl }, () => next());
}
