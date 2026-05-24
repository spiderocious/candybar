import type { PaginationMeta } from '@communique/core';

import { ValidationError } from './errors.js';

export interface CursorPayload {
  last_id: string;
  last_sort_key: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  // A malformed cursor is bad CLIENT input (a stale bookmark, a fuzzer, a typo),
  // not a server fault — surface it as a single-field 400/1001, never a 500/1009.
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
    if (typeof parsed.last_id !== 'string' || typeof parsed.last_sort_key !== 'string') {
      throw new Error('bad shape');
    }
    return parsed;
  } catch {
    throw new ValidationError('Invalid pagination cursor.', 'cursor');
  }
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

export interface CursorPage<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Given `limit + 1` rows fetched from the DB, slice to `limit` and build the
 * page meta. `toCursor` derives the next cursor from the last visible row.
 */
export function buildCursorPage<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => CursorPayload,
): CursorPage<T> {
  const has_more = rows.length > limit;
  const items = has_more ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    meta: {
      next_cursor: has_more && last !== undefined ? encodeCursor(toCursor(last)) : null,
      has_more,
    },
  };
}
