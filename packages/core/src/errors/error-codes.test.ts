import { describe, expect, it } from 'vitest';

import {
  ERROR_CODES,
  ERROR_CODE_HTTP_STATUS,
  ERROR_CODE_TYPE,
  ERROR_TYPES,
} from './error-codes.js';

describe('error codes', () => {
  it('every code in 1001..1009', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(code).toBeGreaterThanOrEqual(1001);
      expect(code).toBeLessThanOrEqual(1009);
    }
  });

  it('1001 is validation, 1009 is fatal', () => {
    expect(ERROR_CODES.VALIDATION).toBe(1001);
    expect(ERROR_CODES.FATAL).toBe(1009);
  });

  it('maps every code to an http status and a type', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_CODE_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(Object.values(ERROR_TYPES)).toContain(ERROR_CODE_TYPE[code]);
    }
  });

  it('validation maps to 400 + validation_error', () => {
    expect(ERROR_CODE_HTTP_STATUS[ERROR_CODES.VALIDATION]).toBe(400);
    expect(ERROR_CODE_TYPE[ERROR_CODES.VALIDATION]).toBe(ERROR_TYPES.VALIDATION);
  });
});
