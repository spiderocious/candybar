import type { Request, Response } from 'express';

import { pool } from '../../lib/db.js';
import { redis } from '../../lib/redis.js';
import { ResponseUtil } from '../../lib/response.js';

/** Liveness: the process is up. */
export async function live(_req: Request, res: Response): Promise<void> {
  ResponseUtil.ok(res, { status: 'ok' });
}

/** Readiness: dependencies (Postgres + Redis) are reachable. */
export async function ready(_req: Request, res: Response): Promise<void> {
  const checks: Record<string, 'ok' | 'down'> = { postgres: 'down', redis: 'down' };
  try {
    await pool.query('SELECT 1');
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'down';
  }
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'down';
  } catch {
    checks.redis = 'down';
  }
  const healthy = checks.postgres === 'ok' && checks.redis === 'ok';
  res.status(healthy ? 200 : 503).json({ data: { status: healthy ? 'ready' : 'degraded', checks } });
}
