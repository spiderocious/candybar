import type { AppError } from './errors.js';

/**
 * Services return a ServiceResult instead of throwing for *expected* failures
 * (not found, conflict, validation). Controllers unwrap it. Throwing is reserved
 * for unexpected failures, which the global handler turns into a 1009.
 */
export type ServiceResult<T> = { success: true; data: T } | { success: false; error: AppError };

export const ok = <T>(data: T): ServiceResult<T> => ({ success: true, data });

export const fail = (error: AppError): ServiceResult<never> => ({ success: false, error });
