import type { Server } from 'node:http';

import { buildApp } from './app.js';
import { outboxRelay } from './dispatch/outbox-relay.js';
import { dispatchQueue } from './dispatch/queue.js';
import { createDispatchWorker } from './dispatch/worker.js';
import { env } from './env.js';
import { closePool } from './lib/db.js';
import { logger } from './lib/logger.js';
import { closeRedis } from './lib/redis.js';

const app = buildApp();
const worker = createDispatchWorker();
outboxRelay.start();

const server: Server = app.listen(env.PORT, () => {
  logger.info('communique backend listening', { port: env.PORT, env: env.NODE_ENV });
});

let shuttingDown = false;

/**
 * Graceful shutdown: stop accepting new HTTP, stop the relay, let in-flight
 * dispatch jobs finish (worker.close waits), then close connections.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutdown initiated', { signal });

  server.close();
  await outboxRelay.stop();
  await worker.close(); // waits for active jobs to complete
  await dispatchQueue.close();
  await closePool();
  await closeRedis();

  logger.info('shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
