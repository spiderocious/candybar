import {
  ERROR_CODES,
  ERROR_CODE_HTTP_STATUS,
  ERROR_CODE_TYPE,
  type ErrorCode,
  type ErrorType,
} from '@communique/core';
import type { ZodError } from 'zod';

/**
 * Domain error carrying the flat-envelope fields. Thrown by services/middleware;
 * the global error handler serializes it. `field` is only set for validation
 * errors (1001) and identifies the single offending field.
 */
export class AppError extends Error {
  readonly errorCode: ErrorCode;
  readonly httpStatus: number;
  readonly type: ErrorType;
  readonly field?: string;

  constructor(errorCode: ErrorCode, message: string, opts?: { field?: string; type?: ErrorType }) {
    super(message);
    this.name = 'AppError';
    this.errorCode = errorCode;
    this.httpStatus = ERROR_CODE_HTTP_STATUS[errorCode];
    this.type = opts?.type ?? ERROR_CODE_TYPE[errorCode];
    if (opts?.field !== undefined) this.field = opts.field;
  }
}

/**
 * Validation error focused on ONE field. Even when multiple fields are invalid,
 * only the first failing field is surfaced; the client fixes it and resubmits to
 * see the next.
 */
export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(ERROR_CODES.VALIDATION, message, field !== undefined ? { field } : undefined);
    this.name = 'ValidationError';
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Missing or invalid API credential.') {
    super(ERROR_CODES.UNAUTHENTICATED, message);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource.') {
    super(ERROR_CODES.FORBIDDEN, message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found.') {
    super(ERROR_CODES.NOT_FOUND, message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict.') {
    super(ERROR_CODES.CONFLICT, message);
    this.name = 'ConflictError';
  }
}

export class UnprocessableError extends AppError {
  constructor(message = 'Request could not be processed.') {
    super(ERROR_CODES.UNPROCESSABLE, message);
    this.name = 'UnprocessableError';
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfter: number;
  constructor(retryAfter: number, message = 'Too many requests.') {
    super(ERROR_CODES.RATE_LIMITED, message);
    this.name = 'RateLimitedError';
    this.retryAfter = retryAfter;
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'An upstream dependency failed.') {
    super(ERROR_CODES.UPSTREAM, message);
    this.name = 'UpstreamError';
  }
}

/**
 * Turn a ZodError into a single-field ValidationError. Zod issues are ordered by
 * the schema's field order, so the first issue is the field we surface. The
 * message is humanised: "Email is invalid." rather than "Invalid email".
 */
export function validationErrorFromZod(error: ZodError): ValidationError {
  const issue = error.issues[0];
  if (!issue) return new ValidationError('Invalid request.');

  const field = issue.path.length > 0 ? issue.path.map(String).join('.') : undefined;
  const message = humaniseIssue(field, issue.message);
  return new ValidationError(message, field);
}

function humaniseIssue(field: string | undefined, raw: string): string {
  if (!field) return ensureSentence(raw);
  const label = toLabel(field);
  const lower = raw.toLowerCase();

  if (lower.includes('required') || lower.includes('expected') || lower.includes('received')) {
    return `${label} is required.`;
  }
  if (lower.includes('invalid email')) return `${label} is invalid.`;
  if (lower.startsWith('string must contain at least')) {
    return `${label} is too short.`;
  }
  if (lower.startsWith('string must contain at most')) {
    return `${label} is too long.`;
  }
  // Custom .refine() / .regex() messages are already human — use them verbatim.
  return ensureSentence(raw.includes(label) ? raw : `${label}: ${raw}`);
}

function toLabel(field: string): string {
  const last = field.split('.').pop() ?? field;
  const spaced = last.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function ensureSentence(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return 'Invalid request.';
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}
