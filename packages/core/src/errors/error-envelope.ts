import { z } from 'zod';

import { ERROR_CODES, ERROR_TYPES } from './error-codes.js';

/**
 * The FLAT error envelope returned by every failing request.
 *
 *   {
 *     "errorCode": 1001,
 *     "errorMessage": "Email is invalid.",
 *     "type": "validation_error",
 *     "field": "email"   // present only for validation errors (1001)
 *   }
 *
 * `field` is optional and only populated for single-field validation failures so
 * the client knows which input to highlight. Exactly one field is ever reported.
 */
export const ErrorEnvelopeSchema = z.object({
  errorCode: z.union([
    z.literal(ERROR_CODES.VALIDATION),
    z.literal(ERROR_CODES.UNAUTHENTICATED),
    z.literal(ERROR_CODES.FORBIDDEN),
    z.literal(ERROR_CODES.NOT_FOUND),
    z.literal(ERROR_CODES.CONFLICT),
    z.literal(ERROR_CODES.UNPROCESSABLE),
    z.literal(ERROR_CODES.RATE_LIMITED),
    z.literal(ERROR_CODES.UPSTREAM),
    z.literal(ERROR_CODES.FATAL),
  ]),
  errorMessage: z.string(),
  type: z.union([
    z.literal(ERROR_TYPES.VALIDATION),
    z.literal(ERROR_TYPES.AUTH),
    z.literal(ERROR_TYPES.FORBIDDEN),
    z.literal(ERROR_TYPES.NOT_FOUND),
    z.literal(ERROR_TYPES.CONFLICT),
    z.literal(ERROR_TYPES.UNPROCESSABLE),
    z.literal(ERROR_TYPES.RATE_LIMIT),
    z.literal(ERROR_TYPES.UPSTREAM),
    z.literal(ERROR_TYPES.SERVER),
    z.literal(ERROR_TYPES.INTERNAL),
  ]),
  field: z.string().optional(),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
