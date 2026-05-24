import { z } from 'zod';

import { CHANNELS } from '../domain/enums.js';

export const SubscriberChannelSchema = z.object({
  id: z.string().startsWith('chn_'),
  subscriber_id: z.string().startsWith('sub_'),
  channel: z.enum(CHANNELS),
  address: z.string(),
  verified: z.boolean(),
  created_at: z.string().datetime(),
});
export type SubscriberChannel = z.infer<typeof SubscriberChannelSchema>;

export const SubscriberSchema = z.object({
  id: z.string().startsWith('sub_'),
  workspace_id: z.string().startsWith('ws_'),
  external_id: z.string(),
  attributes: z.record(z.unknown()),
  is_deleted: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Subscriber = z.infer<typeof SubscriberSchema>;

export const SubscriberWithChannelsSchema = SubscriberSchema.extend({
  channels: z.array(SubscriberChannelSchema),
  optouts: z.array(z.enum(CHANNELS)),
  audiences: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type SubscriberWithChannels = z.infer<typeof SubscriberWithChannelsSchema>;

const ChannelInputSchema = z.object({
  channel: z.enum(CHANNELS),
  address: z.string().min(1),
});

/**
 * Register a subscriber. Idempotent on (workspace, external_id): registering the
 * same external_id again updates attributes/channels rather than duplicating.
 */
export const RegisterSubscriberSchema = z.object({
  external_id: z.string().min(1).max(255),
  attributes: z.record(z.unknown()).optional(),
  channels: z.array(ChannelInputSchema).optional(),
});
export type RegisterSubscriberInput = z.infer<typeof RegisterSubscriberSchema>;

export const UpdateSubscriberSchema = z.object({
  attributes: z.record(z.unknown()).optional(),
});
export type UpdateSubscriberInput = z.infer<typeof UpdateSubscriberSchema>;

export const AddChannelSchema = ChannelInputSchema;
export type AddChannelInput = z.infer<typeof AddChannelSchema>;

export const SetOptOutSchema = z.object({
  channel: z.enum(CHANNELS),
  opted_out: z.boolean(),
});
export type SetOptOutInput = z.infer<typeof SetOptOutSchema>;
