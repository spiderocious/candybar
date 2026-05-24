import type { Event, EventAccepted, PublishEventInput } from '@communique/core';

import { NotFoundError } from '../../lib/errors.js';
import { ok, fail, type ServiceResult } from '../../lib/service-result.js';

import { eventsRepository } from './events.repository.js';

export const eventsService = {
  /**
   * Accepts an event for asynchronous processing. The publisher does NOT wait for
   * delivery — we persist (event + outbox in one tx) and return 202. Idempotency
   * is enforced on (workspace, idempotency_key): the same key returns the same
   * event id and never produces a second dispatch.
   */
  async publish(
    workspaceId: string,
    input: PublishEventInput,
    idempotencyKey: string | null,
  ): Promise<ServiceResult<EventAccepted>> {
    const targetKind = input.audience_id ? 'audience' : 'subscriber';
    const targetRef = input.audience_id ?? input.subscriber_external_id!;

    const { event } = await eventsRepository.ingest({
      workspaceId,
      eventType: input.event_type,
      payload: input.payload ?? {},
      targetKind,
      targetRef,
      idempotencyKey,
    });

    return ok({ id: event.id, status: event.status, accepted: true });
  },

  async get(workspaceId: string, id: string): Promise<ServiceResult<Event>> {
    const event = await eventsRepository.findById(workspaceId, id);
    if (!event) return fail(new NotFoundError('Event not found.'));
    return ok(event);
  },
};
