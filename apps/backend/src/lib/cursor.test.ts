import { describe, expect, it } from 'vitest';

import { buildCursorPage, clampLimit, decodeCursor, encodeCursor } from './cursor.js';

describe('cursor codec', () => {
  it('round-trips without data loss', () => {
    const payload = { last_id: 'sub_01abc', last_sort_key: '2026-05-24T00:00:00.000Z' };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it('throws on a malformed cursor', () => {
    expect(() => decodeCursor('not-base64-json')).toThrow('Invalid cursor');
  });
});

describe('clampLimit', () => {
  it('defaults to 20 for missing/invalid', () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit('abc')).toBe(20);
    expect(clampLimit('0')).toBe(20);
  });
  it('caps at 100', () => {
    expect(clampLimit('500')).toBe(100);
  });
  it('passes through valid values', () => {
    expect(clampLimit('35')).toBe(35);
  });
});

describe('buildCursorPage', () => {
  const rows = [
    { id: 'a', created_at: '1' },
    { id: 'b', created_at: '2' },
    { id: 'c', created_at: '3' },
  ];
  const toCursor = (r: { id: string; created_at: string }) => ({
    last_id: r.id,
    last_sort_key: r.created_at,
  });

  it('reports has_more and trims the extra row', () => {
    const page = buildCursorPage(rows, 2, toCursor);
    expect(page.items).toHaveLength(2);
    expect(page.meta.has_more).toBe(true);
    expect(page.meta.next_cursor).not.toBeNull();
  });

  it('reports no more when rows fit', () => {
    const page = buildCursorPage(rows.slice(0, 2), 2, toCursor);
    expect(page.items).toHaveLength(2);
    expect(page.meta.has_more).toBe(false);
    expect(page.meta.next_cursor).toBeNull();
  });
});
