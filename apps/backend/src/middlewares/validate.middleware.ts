import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

import { validationErrorFromZod } from '../lib/errors.js';

type Part = 'body' | 'query' | 'params';

/**
 * Validates one request part against a Zod schema. On failure, throws a
 * single-field ValidationError (only the first offending field is reported).
 * On success, replaces req[part] with the parsed value.
 */
export function validate<T extends ZodTypeAny>(schema: T, part: Part = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      throw validationErrorFromZod(result.error);
    }
    // Reassign the parsed, typed value back onto the request.
    Object.defineProperty(req, part, { value: result.data as z.infer<T>, writable: true });
    next();
  };
}
