import type { NextFunction, Request, Response } from 'express';

import { logger } from '../lib/logger.js';

/** Logs each request's method, path, status and duration. */
export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
}
