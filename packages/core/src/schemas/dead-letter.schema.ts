import { z } from 'zod';

import { DEAD_LETTER_REASONS } from '../domain/enums.js';

export const DeadLetterSchema = z.object({
  id: z.string().startsWith('dlq_'),
  workspace_id: z.string().startsWith('ws_'),
  event_id: z.string().startsWith('evt_'),
  event_type: z.string(),
  reason: z.enum(DEAD_LETTER_REASONS),
  last_error: z.string().nullable(),
  payload_snapshot: z.record(z.unknown()),
  replayable: z.boolean(),
  replayed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});
export type DeadLetter = z.infer<typeof DeadLetterSchema>;

export const ReplayResultSchema = z.object({
  event_id: z.string().startsWith('evt_'),
  requeued: z.literal(true),
});
export type ReplayResult = z.infer<typeof ReplayResultSchema>;
