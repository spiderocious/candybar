import { Queue } from 'bullmq';

import { env } from '../env.js';
import { redis } from '../lib/redis.js';

export const DISPATCH_QUEUE = 'communique-dispatch';

export interface DispatchJobData {
  eventId: string;
  workspaceId: string;
}

/**
 * The dispatch queue. The outbox relay adds jobs; the worker consumes them.
 * Retry/backoff are configured per-job from env so a single event's processing
 * is retried with exponential backoff before being dead-lettered.
 */
export const dispatchQueue = new Queue<DispatchJobData>(DISPATCH_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: env.DISPATCH_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: env.DISPATCH_BACKOFF_MS },
    removeOnComplete: 1000,
    removeOnFail: false,
  },
});

/** Enqueue an event for dispatch. Job id = event id so re-adds dedupe. */
export async function enqueueDispatch(data: DispatchJobData): Promise<void> {
  await dispatchQueue.add('dispatch', data, { jobId: data.eventId });
}

export async function queueDepth(): Promise<number> {
  const counts = await dispatchQueue.getJobCounts('waiting', 'active', 'delayed');
  return (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
}
