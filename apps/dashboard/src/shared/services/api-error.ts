import type { ErrorEnvelope, ErrorType } from '@communique/core';

/**
 * Thrown by the api client on any non-2xx response. Carries the FLAT error
 * envelope fields so UI can switch on `errorCode` (stable) and show `field`
 * inline for validation errors.
 */
export class ApiError extends Error {
  readonly errorCode: number;
  readonly type: ErrorType;
  readonly field: string | undefined;
  readonly httpStatus: number;

  constructor(httpStatus: number, envelope: Partial<ErrorEnvelope>) {
    super(envelope.errorMessage ?? 'Request failed.');
    this.name = 'ApiError';
    this.httpStatus = httpStatus;
    this.errorCode = envelope.errorCode ?? 0;
    this.type = (envelope.type ?? 'internal_error') as ErrorType;
    this.field = envelope.field;
  }

  isValidation(): boolean {
    return this.errorCode === 1001;
  }
  isUnauthorized(): boolean {
    return this.errorCode === 1002;
  }
}
