import { z } from 'zod';

export const AudienceSchema = z.object({
  id: z.string().startsWith('aud_'),
  workspace_id: z.string().startsWith('ws_'),
  name: z.string(),
  description: z.string().nullable(),
  member_count: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Audience = z.infer<typeof AudienceSchema>;

export const CreateAudienceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
});
export type CreateAudienceInput = z.infer<typeof CreateAudienceSchema>;

export const UpdateAudienceSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
});
export type UpdateAudienceInput = z.infer<typeof UpdateAudienceSchema>;

export const AddAudienceMemberSchema = z.object({
  subscriber_id: z.string().startsWith('sub_'),
});
export type AddAudienceMemberInput = z.infer<typeof AddAudienceMemberSchema>;
