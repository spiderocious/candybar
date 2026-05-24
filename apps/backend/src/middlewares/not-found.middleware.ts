import type { NextFunction, Request, Response } from 'express';

import { NotFoundError } from '../lib/errors.js';

/** Catches unmatched routes and converts them into a 1004 envelope. */
export function notFoundMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError('Route not found.'));
}
