import { z } from 'zod';

import { ATTEMPT_STATUSES, CHANNELS, DISPATCH_STATUSES } from '../domain/enums.js';

export const DispatchSchema = z.object({
  id: z.string().startsWith('dsp_'),
  workspace_id: z.string().startsWith('ws_'),
  event_id: z.string().startsWith('evt_'),
  subscriber_id: z.string().startsWith('sub_'),
  channel: z.enum(CHANNELS),
  template_version_id: z.string().nullable(),
  status: z.enum(DISPATCH_STATUSES),
  attempts: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Dispatch = z.infer<typeof DispatchSchema>;

/** One row of the notification log — a single provider send attempt. */
export const DispatchAttemptSchema = z.object({
  id: z.string().startsWith('att_'),
  dispatch_id: z.string().startsWith('dsp_'),
  workspace_id: z.string().startsWith('ws_'),
  subscriber_id: z.string().startsWith('sub_'),
  event_type: z.string(),
  channel: z.enum(CHANNELS),
  provider_key: z.string().nullable(),
  attempt_no: z.number().int().nonnegative(),
  status: z.enum(ATTEMPT_STATUSES),
  error_code: z.string().nullable(),
  error_detail: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type DispatchAttempt = z.infer<typeof DispatchAttemptSchema>;

export const TestDispatchSchema = z.object({
  subscriber_external_id: z.string().min(1),
  template_id: z.string().startsWith('tpl_'),
  version: z.number().int().positive().optional(),
  variables: z.record(z.unknown()).optional(),
});
export type TestDispatchInput = z.infer<typeof TestDispatchSchema>;

export const TestDispatchResultSchema = z.object({
  dispatch_id: z.string().startsWith('dsp_'),
  status: z.enum(DISPATCH_STATUSES),
  provider_key: z.string().nullable(),
  detail: z.string().nullable(),
});
export type TestDispatchResult = z.infer<typeof TestDispatchResultSchema>;
