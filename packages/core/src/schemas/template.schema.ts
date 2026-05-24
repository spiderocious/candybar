import { z } from 'zod';

import { CHANNELS } from '../domain/enums.js';

export const TemplateSchema = z.object({
  id: z.string().startsWith('tpl_'),
  workspace_id: z.string().startsWith('ws_'),
  name: z.string(),
  event_type: z.string(),
  channel: z.enum(CHANNELS),
  latest_version: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Template = z.infer<typeof TemplateSchema>;

export const TemplateVersionSchema = z.object({
  id: z.string().startsWith('tplv_'),
  template_id: z.string().startsWith('tpl_'),
  version: z.number().int().positive(),
  subject: z.string().nullable(),
  body_text: z.string(),
  body_html: z.string().nullable(),
  required_vars: z.array(z.string()),
  created_at: z.string().datetime(),
});
export type TemplateVersion = z.infer<typeof TemplateVersionSchema>;

export const TemplateWithVersionsSchema = TemplateSchema.extend({
  versions: z.array(TemplateVersionSchema),
});
export type TemplateWithVersions = z.infer<typeof TemplateWithVersionsSchema>;

export const CreateTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  event_type: z.string().min(1).max(120),
  channel: z.enum(CHANNELS),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;

/**
 * Publishing a version creates a NEW immutable version. `subject`/`body_html`
 * apply to email; SMS uses `body_text` only. `required_vars` are validated to be
 * present in an event payload before dispatch — missing vars route to dead-letter.
 */
export const PublishVersionSchema = z.object({
  subject: z.string().max(255).optional(),
  body_text: z.string().min(1),
  body_html: z.string().optional(),
  required_vars: z.array(z.string()).optional(),
});
export type PublishVersionInput = z.infer<typeof PublishVersionSchema>;

export const PreviewTemplateSchema = z.object({
  version: z.number().int().positive().optional(),
  variables: z.record(z.unknown()),
});
export type PreviewTemplateInput = z.infer<typeof PreviewTemplateSchema>;

export const TemplatePreviewSchema = z.object({
  subject: z.string().nullable(),
  body_text: z.string(),
  body_html: z.string().nullable(),
  missing_vars: z.array(z.string()),
});
export type TemplatePreview = z.infer<typeof TemplatePreviewSchema>;
