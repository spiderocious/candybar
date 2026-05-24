import { z } from 'zod';

import { CHANNELS } from '../domain/enums.js';

const BreakdownRowSchema = z.object({
  key: z.string(),
  count: z.number().int().nonnegative(),
});

export const MetricsSchema = z.object({
  events_received: z.number().int().nonnegative(),
  events_processed: z.number().int().nonnegative(),
  events_dead: z.number().int().nonnegative(),
  dispatch_success: z.number().int().nonnegative(),
  dispatch_failure: z.number().int().nonnegative(),
  dispatch_success_rate: z.number().min(0).max(1),
  retry_count: z.number().int().nonnegative(),
  dead_letter_count: z.number().int().nonnegative(),
  queue_depth: z.number().int().nonnegative(),
  by_channel: z.array(BreakdownRowSchema),
  by_event_type: z.array(BreakdownRowSchema),
  by_status: z.array(BreakdownRowSchema),
});
export type Metrics = z.infer<typeof MetricsSchema>;

export const MetricsQuerySchema = z.object({
  channel: z.enum(CHANNELS).optional(),
  event_type: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type MetricsQuery = z.infer<typeof MetricsQuerySchema>;
