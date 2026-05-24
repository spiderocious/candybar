import { z } from 'zod';

import { EVENT_STATUSES, EVENT_TARGET_KINDS } from '../domain/enums.js';

/**
 * Publish an event. Target either an audience (`audience_id`) or a single
 * subscriber (`subscriber_external_id`) — exactly one. `payload` supplies the
 * variables interpolated into the matched template(s).
 */
export const PublishEventSchema = z
  .object({
    event_type: z.string().min(1).max(120),
    payload: z.record(z.unknown()).optional(),
    audience_id: z.string().startsWith('aud_').optional(),
    subscriber_external_id: z.string().min(1).optional(),
  })
  .refine(
    (v) => Boolean(v.audience_id) !== Boolean(v.subscriber_external_id),
    'Provide exactly one of audience_id or subscriber_external_id',
  );
export type PublishEventInput = z.infer<typeof PublishEventSchema>;

export const EventSchema = z.object({
  id: z.string().startsWith('evt_'),
  workspace_id: z.string().startsWith('ws_'),
  event_type: z.string(),
  payload: z.record(z.unknown()),
  target_kind: z.enum(EVENT_TARGET_KINDS),
  target_ref: z.string(),
  status: z.enum(EVENT_STATUSES),
  idempotency_key: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Event = z.infer<typeof EventSchema>;

/** 202 Accepted response when an event is published. */
export const EventAcceptedSchema = z.object({
  id: z.string().startsWith('evt_'),
  status: z.enum(EVENT_STATUSES),
  accepted: z.literal(true),
});
export type EventAccepted = z.infer<typeof EventAcceptedSchema>;
