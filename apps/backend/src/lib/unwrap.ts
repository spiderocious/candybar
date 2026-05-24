import type { ServiceResult } from './service-result.js';

/**
 * Unwraps a ServiceResult inside a controller: returns the data on success,
 * throws the AppError on failure (caught by the global error handler). Keeps
 * controllers to a single readable line.
 */
export function unwrap<T>(result: ServiceResult<T>): T {
  if (!result.success) throw result.error;
  return result.data;
}
