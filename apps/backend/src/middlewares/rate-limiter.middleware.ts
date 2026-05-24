import type { NextFunction, Request, Response } from 'express';

import { env } from '../env.js';
import { RateLimitedError } from '../lib/errors.js';
import { redis } from '../lib/redis.js';
import { getContext } from '../lib/request-context.js';

/**
 * Token-bucket rate limiter keyed by API credential (falls back to IP for
 * unauthenticated requests). Implemented with a small Lua script so the
 * check-and-decrement is atomic.
 */
const SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local bucket = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(bucket[1])
local ts = tonumber(bucket[2])
if tokens == nil then tokens = capacity; ts = now end
local elapsed = math.max(0, now - ts)
tokens = math.min(capacity, tokens + elapsed * refill)
local allowed = 0
if tokens >= 1 then allowed = 1; tokens = tokens - 1 end
redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', key, math.ceil(capacity / refill) + 1)
return { allowed, math.floor(tokens) }
`;

export async function rateLimiter(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const ctx = getContext();
  const identity = ctx?.credentialId ?? req.ip ?? 'anonymous';
  const key = `rl:${identity}`;
  const now = Date.now() / 1000;

  const [allowed] = (await redis.eval(
    SCRIPT,
    1,
    key,
    String(env.RATE_LIMIT_CAPACITY),
    String(env.RATE_LIMIT_REFILL_PER_SEC),
    String(now),
  )) as [number, number];

  if (allowed === 0) {
    throw new RateLimitedError(Math.ceil(1 / env.RATE_LIMIT_REFILL_PER_SEC));
  }
  next();
}
