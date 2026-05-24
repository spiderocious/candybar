import { Redis } from 'ioredis';

import { env } from '../env.js';

/**
 * Shared Redis connection. BullMQ requires `maxRetriesPerRequest: null` on the
 * connection it uses for blocking commands, so we set it here.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export async function closeRedis(): Promise<void> {
  redis.disconnect();
}
