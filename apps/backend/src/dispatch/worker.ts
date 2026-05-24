import { Worker, type Job } from 'bullmq';

import { env } from '../env.js';
import { eventsRepository } from '../features/events/events.repository.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';

import { dispatchRepository } from './dispatch.repository.js';
import { processEvent } from './dispatch.service.js';
import { DISPATCH_QUEUE, type DispatchJobData } from './queue.js';

/**
 * The dispatch worker. Concurrency, retry attempts and backoff come from env.
 * When a job exhausts its attempts, the `failed` handler moves the event to the
 * dead-letter queue (reason=exhausted) so it can be inspected and replayed.
 */
export function createDispatchWorker(): Worker<DispatchJobData> {
  const worker = new Worker<DispatchJobData>(
    DISPATCH_QUEUE,
    async (job: Job<DispatchJobData>) => {
      await processEvent(job.data.workspaceId, job.data.eventId);
    },
    {
      connection: redis,
      concurrency: env.DISPATCH_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? env.DISPATCH_MAX_ATTEMPTS);
    logger.warn('dispatch job failed', {
      eventId: job.data.eventId,
      attempt: job.attemptsMade,
      exhausted,
      message: err.message,
    });
    if (exhausted) {
      void deadLetterExhausted(job.data, err.message);
    }
  });

  worker.on('error', (err) => {
    logger.error('dispatch worker error', { message: err.message });
  });

  logger.info('dispatch worker started', { concurrency: env.DISPATCH_CONCURRENCY });
  return worker;
}

async function deadLetterExhausted(data: DispatchJobData, lastError: string): Promise<void> {
  try {
    const event = await eventsRepository.findById(data.workspaceId, data.eventId);
    if (!event) return;
    await dispatchRepository.deadLetter({
      workspaceId: data.workspaceId,
      eventId: data.eventId,
      eventType: event.event_type,
      reason: 'exhausted',
      lastError,
      payload: event.payload,
    });
    await eventsRepository.setStatus(data.eventId, 'failed');
  } catch (err) {
    logger.error('failed to dead-letter exhausted job', {
      eventId: data.eventId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
