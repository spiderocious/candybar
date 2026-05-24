import { z } from 'zod';

export const WorkspaceSchema = z.object({
  id: z.string().startsWith('ws_'),
  name: z.string(),
  slug: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only')
    .optional(),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

/**
 * An API credential. The `key` (plaintext) is returned ONCE on creation/rotation
 * and never again — only `prefix` is shown afterwards.
 */
export const ApiCredentialSchema = z.object({
  id: z.string().startsWith('cred_'),
  workspace_id: z.string().startsWith('ws_'),
  name: z.string(),
  prefix: z.string(),
  last_used_at: z.string().datetime().nullable(),
  revoked_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});
export type ApiCredential = z.infer<typeof ApiCredentialSchema>;

/** Returned only at creation / rotation — includes the one-time plaintext key. */
export const ApiCredentialWithSecretSchema = ApiCredentialSchema.extend({
  key: z.string(),
});
export type ApiCredentialWithSecret = z.infer<typeof ApiCredentialWithSecretSchema>;

export const CreateCredentialSchema = z.object({
  name: z.string().min(2).max(120),
});
export type CreateCredentialInput = z.infer<typeof CreateCredentialSchema>;

/** Response of POST /workspaces — workspace plus its first (one-time) key. */
export const WorkspaceWithCredentialSchema = z.object({
  workspace: WorkspaceSchema,
  credential: ApiCredentialWithSecretSchema,
});
export type WorkspaceWithCredential = z.infer<typeof WorkspaceWithCredentialSchema>;
