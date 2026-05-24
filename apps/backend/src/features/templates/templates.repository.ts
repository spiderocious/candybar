import type { Channel, Template, TemplateVersion } from '@communique/core';

import { pool, withTransaction } from '../../lib/db.js';
import { buildCursorPage, type CursorPage, type CursorPayload } from '../../lib/cursor.js';

interface TemplateRow {
  id: string;
  workspace_id: string;
  name: string;
  event_type: string;
  channel: string;
  latest_version: number;
  created_at: Date;
  updated_at: Date;
}

interface VersionRow {
  id: string;
  template_id: string;
  version: number;
  subject: string | null;
  body_text: string;
  body_html: string | null;
  required_vars: string[];
  created_at: Date;
}

const toTemplate = (r: TemplateRow): Template => ({
  id: r.id,
  workspace_id: r.workspace_id,
  name: r.name,
  event_type: r.event_type,
  channel: r.channel as Channel,
  latest_version: r.latest_version,
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
});

const toVersion = (r: VersionRow): TemplateVersion => ({
  id: r.id,
  template_id: r.template_id,
  version: r.version,
  subject: r.subject,
  body_text: r.body_text,
  body_html: r.body_html,
  required_vars: r.required_vars,
  created_at: r.created_at.toISOString(),
});

export const templatesRepository = {
  async create(
    params: { id: string; workspaceId: string; name: string; eventType: string; channel: Channel },
  ): Promise<Template> {
    const r = await pool.query<TemplateRow>(
      `INSERT INTO templates (id, workspace_id, name, event_type, channel)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, workspace_id, name, event_type, channel, latest_version, created_at, updated_at`,
      [params.id, params.workspaceId, params.name, params.eventType, params.channel],
    );
    return toTemplate(r.rows[0]!);
  },

  async nameExists(workspaceId: string, name: string): Promise<boolean> {
    const r = await pool.query(`SELECT 1 FROM templates WHERE workspace_id = $1 AND name = $2`, [
      workspaceId,
      name,
    ]);
    return r.rowCount! > 0;
  },

  async findById(workspaceId: string, id: string): Promise<Template | null> {
    const r = await pool.query<TemplateRow>(
      `SELECT id, workspace_id, name, event_type, channel, latest_version, created_at, updated_at
         FROM templates WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
    return r.rows[0] ? toTemplate(r.rows[0]) : null;
  },

  async list(
    workspaceId: string,
    opts: { limit: number; cursor?: CursorPayload },
  ): Promise<CursorPage<Template>> {
    const params: unknown[] = [workspaceId];
    let where = `workspace_id = $1`;
    if (opts.cursor) {
      params.push(opts.cursor.last_sort_key, opts.cursor.last_id);
      where += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
    }
    params.push(opts.limit + 1);
    const r = await pool.query<TemplateRow>(
      `SELECT id, workspace_id, name, event_type, channel, latest_version, created_at, updated_at
         FROM templates WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return buildCursorPage(r.rows.map(toTemplate), opts.limit, (t) => ({
      last_id: t.id,
      last_sort_key: t.created_at,
    }));
  },

  /** Publishes a new immutable version and bumps the template's latest_version. */
  async publishVersion(
    params: {
      id: string;
      templateId: string;
      subject: string | null;
      bodyText: string;
      bodyHtml: string | null;
      requiredVars: string[];
    },
  ): Promise<TemplateVersion> {
    return withTransaction(async (trx) => {
      const next = await trx.query<{ latest_version: number }>(
        `UPDATE templates SET latest_version = latest_version + 1
          WHERE id = $1 RETURNING latest_version`,
        [params.templateId],
      );
      const version = next.rows[0]!.latest_version;
      const r = await trx.query<VersionRow>(
        `INSERT INTO template_versions
           (id, template_id, version, subject, body_text, body_html, required_vars)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, template_id, version, subject, body_text, body_html, required_vars, created_at`,
        [
          params.id,
          params.templateId,
          version,
          params.subject,
          params.bodyText,
          params.bodyHtml,
          JSON.stringify(params.requiredVars),
        ],
      );
      return toVersion(r.rows[0]!);
    });
  },

  async listVersions(templateId: string): Promise<TemplateVersion[]> {
    const r = await pool.query<VersionRow>(
      `SELECT id, template_id, version, subject, body_text, body_html, required_vars, created_at
         FROM template_versions WHERE template_id = $1 ORDER BY version DESC`,
      [templateId],
    );
    return r.rows.map(toVersion);
  },

  async getVersion(templateId: string, version: number): Promise<TemplateVersion | null> {
    const r = await pool.query<VersionRow>(
      `SELECT id, template_id, version, subject, body_text, body_html, required_vars, created_at
         FROM template_versions WHERE template_id = $1 AND version = $2`,
      [templateId, version],
    );
    return r.rows[0] ? toVersion(r.rows[0]) : null;
  },

  async getLatestVersion(templateId: string): Promise<TemplateVersion | null> {
    const r = await pool.query<VersionRow>(
      `SELECT id, template_id, version, subject, body_text, body_html, required_vars, created_at
         FROM template_versions WHERE template_id = $1 ORDER BY version DESC LIMIT 1`,
      [templateId],
    );
    return r.rows[0] ? toVersion(r.rows[0]) : null;
  },
};
