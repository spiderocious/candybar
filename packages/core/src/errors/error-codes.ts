/**
 * Communiqué numeric error codes (1001–1009).
 *
 * The error envelope is intentionally FLAT (no nested `error` object):
 *
 *   { errorCode: 1001, errorMessage: "Email is invalid.", type: "validation_error" }
 *
 * Clients switch on `errorCode` (stable number) — never on `errorMessage` (human
 * text, may change). `type` is a coarse machine-readable category for grouping.
 *
 * Code map:
 *   1001  payload / input validation failure (one field at a time — see note below)
 *   1002  authentication failure (missing / invalid API key)
 *   1003  authorization failure (valid key, wrong workspace / not permitted)
 *   1004  resource not found
 *   1005  conflict (duplicate, immutable-version edit, state conflict)
 *   1006  unprocessable (semantically wrong but well-formed — e.g. missing template vars)
 *   1007  rate limited
 *   1008  upstream / provider / dependency failure (recoverable, transient)
 *   1009  extreme, irreconcilable internal error (unexpected, non-recoverable)
 *
 * VALIDATION (1001) is single-field: if several fields are invalid, the response
 * reports exactly ONE — the first failing field. After the client fixes it and
 * resubmits, the next failing field is reported, and so on.
 */

export const ERROR_CODES = {
  VALIDATION: 1001,
  UNAUTHENTICATED: 1002,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  CONFLICT: 1005,
  UNPROCESSABLE: 1006,
  RATE_LIMITED: 1007,
  UPSTREAM: 1008,
  FATAL: 1009,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_TYPES = {
  VALIDATION: 'validation_error',
  AUTH: 'auth_error',
  FORBIDDEN: 'forbidden_error',
  NOT_FOUND: 'not_found_error',
  CONFLICT: 'conflict_error',
  UNPROCESSABLE: 'unprocessable_error',
  RATE_LIMIT: 'rate_limit_error',
  UPSTREAM: 'upstream_error',
  SERVER: 'server_error',
  INTERNAL: 'internal_error',
} as const;

export type ErrorType = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES];

/** The HTTP status each numeric error code maps to. */
export const ERROR_CODE_HTTP_STATUS: Record<ErrorCode, number> = {
  [ERROR_CODES.VALIDATION]: 400,
  [ERROR_CODES.UNAUTHENTICATED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.UNPROCESSABLE]: 422,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.UPSTREAM]: 502,
  [ERROR_CODES.FATAL]: 500,
};

/** The default `type` each numeric error code maps to (overridable per-error). */
export const ERROR_CODE_TYPE: Record<ErrorCode, ErrorType> = {
  [ERROR_CODES.VALIDATION]: ERROR_TYPES.VALIDATION,
  [ERROR_CODES.UNAUTHENTICATED]: ERROR_TYPES.AUTH,
  [ERROR_CODES.FORBIDDEN]: ERROR_TYPES.FORBIDDEN,
  [ERROR_CODES.NOT_FOUND]: ERROR_TYPES.NOT_FOUND,
  [ERROR_CODES.CONFLICT]: ERROR_TYPES.CONFLICT,
  [ERROR_CODES.UNPROCESSABLE]: ERROR_TYPES.UNPROCESSABLE,
  [ERROR_CODES.RATE_LIMITED]: ERROR_TYPES.RATE_LIMIT,
  [ERROR_CODES.UPSTREAM]: ERROR_TYPES.UPSTREAM,
  [ERROR_CODES.FATAL]: ERROR_TYPES.INTERNAL,
};
