/** Centralised env access. Only VITE_-prefixed, non-secret config is exposed. */
export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
} as const;
