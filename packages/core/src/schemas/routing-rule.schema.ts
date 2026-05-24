import { z } from 'zod';

import { CHANNELS } from '../domain/enums.js';

export const RoutingRuleSchema = z.object({
  id: z.string().startsWith('rule_'),
  workspace_id: z.string().startsWith('ws_'),
  event_type: z.string(),
  channel: z.enum(CHANNELS),
  audience_id: z.string().startsWith('aud_').nullable(),
  template_id: z.string().startsWith('tpl_'),
  enabled: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

/**
 * A rule says: when an event of `event_type` arrives, dispatch via `channel`
 * using `template_id`. If `audience_id` is set, fan out to that audience;
 * otherwise the rule applies to directly-targeted events.
 */
export const CreateRoutingRuleSchema = z.object({
  event_type: z.string().min(1).max(120),
  channel: z.enum(CHANNELS),
  template_id: z.string().startsWith('tpl_'),
  audience_id: z.string().startsWith('aud_').optional(),
  enabled: z.boolean().optional(),
});
export type CreateRoutingRuleInput = z.infer<typeof CreateRoutingRuleSchema>;

export const UpdateRoutingRuleSchema = z.object({
  channel: z.enum(CHANNELS).optional(),
  template_id: z.string().startsWith('tpl_').optional(),
  audience_id: z.string().startsWith('aud_').nullable().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateRoutingRuleInput = z.infer<typeof UpdateRoutingRuleSchema>;
