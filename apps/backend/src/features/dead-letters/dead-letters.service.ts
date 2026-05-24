import type { DeadLetter, ReplayResult } from '@communique/core';

import { dispatchRepository } from '../../dispatch/dispatch.repository.js';
import type { CursorPage, CursorPayload } from '../../lib/cursor.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { ok, fail, type ServiceResult } from '../../lib/service-result.js';
import { eventsRepository } from '../events/events.repository.js';

export const deadLettersService = {
  async list(
    workspaceId: string,
    opts: { limit: number; cursor?: CursorPayload },
  ): Promise<ServiceResult<CursorPage<DeadLetter>>> {
    return ok(await dispatchRepository.listDeadLetters(workspaceId, opts));
  },

  async get(workspaceId: string, id: string): Promise<ServiceResult<DeadLetter>> {
    const dl = await dispatchRepository.findDeadLetter(workspaceId, id);
    if (!dl) return fail(new NotFoundError('Dead-letter entry not found.'));
    return ok(dl);
  },

  /**
   * Re-queue a dead-lettered event through the full pipeline by writing a new
   * outbox row (the relay will enqueue it). Marks the dead-letter replayed.
   */
  async replay(workspaceId: string, id: string): Promise<ServiceResult<ReplayResult>> {
    const dl = await dispatchRepository.findDeadLetter(workspaceId, id);
    if (!dl) return fail(new NotFoundError('Dead-letter entry not found.'));
    if (!dl.replayable) {
      return fail(new ConflictError('This dead-letter entry is not replayable.'));
    }
    await eventsRepository.requeue(dl.event_id);
    await dispatchRepository.markReplayed(workspaceId, id);
    return ok({ event_id: dl.event_id, requeued: true });
  },
};
