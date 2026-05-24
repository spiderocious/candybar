import { z } from 'zod';

import { CHANNELS, PROVIDER_KEYS } from '../domain/enums.js';

/**
 * Provider config shapes per provider key. These are what the dashboard collects
 * and what gets encrypted at rest. `console` needs no config.
 */
export const ConsoleConfigSchema = z.object({}).strict();

export const ResendConfigSchema = z.object({
  api_key: z.string().min(1),
  from_email: z.string().email(),
  from_name: z.string().optional(),
});

export const TwilioConfigSchema = z.object({
  account_sid: z.string().min(1),
  auth_token: z.string().min(1),
  from_number: z.string().min(1),
});

export const ProviderConfigSchema = z.union([
  ConsoleConfigSchema,
  ResendConfigSchema,
  TwilioConfigSchema,
]);
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/** Provider as returned by the API — config is MASKED, never returned in full. */
export const ProviderSchema = z.object({
  id: z.string().startsWith('prov_'),
  workspace_id: z.string().startsWith('ws_'),
  channel: z.enum(CHANNELS),
  provider_key: z.enum(PROVIDER_KEYS),
  priority: z.number().int().positive(),
  enabled: z.boolean(),
  config_masked: z.record(z.string()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Provider = z.infer<typeof ProviderSchema>;

export const CreateProviderSchema = z.object({
  channel: z.enum(CHANNELS),
  provider_key: z.enum(PROVIDER_KEYS),
  priority: z.number().int().positive().max(100).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()),
});
export type CreateProviderInput = z.infer<typeof CreateProviderSchema>;

export const UpdateProviderSchema = z.object({
  priority: z.number().int().positive().max(100).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});
export type UpdateProviderInput = z.infer<typeof UpdateProviderSchema>;
