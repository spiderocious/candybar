import pino from 'pino';

import { env } from '../env.js';

import { getContext } from './request-context.js';

/**
 * Structured logger. PII / secret paths are redacted. Request id is attached
 * automatically from AsyncLocalStorage where available.
 */
const base = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'config.api_key',
      'config.auth_token',
      'config.account_sid',
      '*.api_key',
      '*.auth_token',
      '*.password',
      '*.email',
      '*.phone',
      '*.address',
    ],
    censor: '[REDACTED]',
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }
    : {}),
});

function withCtx(): Record<string, unknown> {
  const ctx = getContext();
  return ctx ? { request_id: ctx.requestId, workspace_id: ctx.workspaceId } : {};
}

export const logger = {
  trace: (msg: string, ctx?: Record<string, unknown>) => base.trace({ ...withCtx(), ...ctx }, msg),
  debug: (msg: string, ctx?: Record<string, unknown>) => base.debug({ ...withCtx(), ...ctx }, msg),
  info: (msg: string, ctx?: Record<string, unknown>) => base.info({ ...withCtx(), ...ctx }, msg),
  warn: (msg: string, ctx?: Record<string, unknown>) => base.warn({ ...withCtx(), ...ctx }, msg),
  error: (msg: string, ctx?: Record<string, unknown>) => base.error({ ...withCtx(), ...ctx }, msg),
  raw: base,
};
