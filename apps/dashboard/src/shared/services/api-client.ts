import type { PaginationMeta } from '@communique/core';

import { ENV } from '../config/env.js';

import { ApiError } from './api-error.js';
import { workspaceToken } from './workspace-token.js';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const token = workspaceToken.get();
  const res = await fetch(`${ENV.API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, json);
  }
  return json as T;
}

/** Returns the unwrapped `data` for single-resource responses. */
async function requestData<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const envelope = await request<{ data: T }>(method, path, body);
  return envelope.data;
}

/** Returns `{ data, meta }` for list responses. */
async function requestList<T>(path: string): Promise<Paginated<T>> {
  return request<Paginated<T>>('GET', path);
}

export const apiClient = {
  get: <T>(path: string) => requestData<T>('GET', path),
  list: <T>(path: string) => requestList<T>(path),
  post: <T>(path: string, body?: unknown) => requestData<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => requestData<T>('PATCH', path, body),
  delete: (path: string) => request<void>('DELETE', path),
  /** Raw post that returns the full envelope (for non-{data} or status checks). */
  postRaw: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
};
