import { ERROR_CODES, ERROR_TYPES } from '@communique/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { validationErrorFromZod } from './errors.js';

describe('validationErrorFromZod (single-field)', () => {
  const schema = z.object({
    email: z.string().email(),
    phone: z.string().min(7),
  });

  it('reports ONLY the first failing field when several are invalid', () => {
    const result = schema.safeParse({ email: 'nope', phone: '1' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const err = validationErrorFromZod(result.error);
    expect(err.errorCode).toBe(ERROR_CODES.VALIDATION);
    expect(err.type).toBe(ERROR_TYPES.VALIDATION);
    // email is declared first in the schema, so it's surfaced first.
    expect(err.field).toBe('email');
    expect(err.message).toMatch(/email/i);
  });

  it('surfaces the next field once the first is fixed', () => {
    const result = schema.safeParse({ email: 'ada@example.com', phone: '1' });
    if (result.success) throw new Error('expected failure');
    const err = validationErrorFromZod(result.error);
    expect(err.field).toBe('phone');
  });

  it('humanises a missing required field', () => {
    const result = schema.safeParse({});
    if (result.success) throw new Error('expected failure');
    const err = validationErrorFromZod(result.error);
    expect(err.message).toMatch(/required/i);
  });
});
