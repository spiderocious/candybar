import { ERROR_CODES, ERROR_CODE_TYPE, type ErrorEnvelope } from '@communique/core';
import type { ErrorRequestHandler, Response } from 'express';
import { ZodError } from 'zod';

import { AppError, RateLimitedError, validationErrorFromZod } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/**
 * The one place errors become responses. Produces the FLAT envelope:
 *   { errorCode, errorMessage, type, field? }
 * Must be registered last in the middleware chain.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  // Zod errors that slipped past validate() → single-field validation envelope.
  if (err instanceof ZodError) {
    return send(res, validationErrorFromZod(err));
  }

  if (err instanceof AppError) {
    if (err instanceof RateLimitedError) {
      res.setHeader('Retry-After', String(err.retryAfter));
    }
    if (err.errorCode >= ERROR_CODES.UNPROCESSABLE) {
      logger.warn('handled error', { errorCode: err.errorCode, message: err.message });
    }
    return send(res, err);
  }

  // Anything else is an unexpected, irreconcilable failure → 1009.
  logger.error('unhandled error', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  const envelope: ErrorEnvelope = {
    errorCode: ERROR_CODES.FATAL,
    errorMessage: 'An unexpected error occurred.',
    type: ERROR_CODE_TYPE[ERROR_CODES.FATAL],
  };
  return res.status(500).json(envelope);
};

function send(res: Response, err: AppError) {
  const envelope: ErrorEnvelope = {
    errorCode: err.errorCode,
    errorMessage: err.message,
    type: err.type,
    ...(err.field !== undefined ? { field: err.field } : {}),
  };
  return res.status(err.httpStatus).json(envelope);
}
