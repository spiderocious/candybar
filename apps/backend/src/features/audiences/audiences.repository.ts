import type { Audience } from '@communique/core';

import { buildCursorPage, type CursorPage, type CursorPayload } from '../../lib/cursor.js';
import { pool } from '../../lib/db.js';

interface AudienceRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  member_count: string | number;
  created_at: Date;
  updated_at: Date;
}

const toAudience = (r: AudienceRow): Audience => ({
  id: r.id,
  workspace_id: r.workspace_id,
  name: r.name,
  description: r.description,
  member_count: Number(r.member_count),
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
});

const SELECT = `
  SELECT a.id, a.workspace_id, a.name, a.description, a.created_at, a.updated_at,
         COALESCE((SELECT count(*) FROM audience_members m WHERE m.audience_id = a.id), 0) AS member_count
    FROM audiences a`;

export const audiencesRepository = {
  async create(
    id: string,
    workspaceId: string,
    name: string,
    description: string | null,
  ): Promise<Audience> {
    await pool.query(
      `INSERT INTO audiences (id, workspace_id, name, description) VALUES ($1, $2, $3, $4)`,
      [id, workspaceId, name, description],
    );
    return (await this.findById(workspaceId, id))!;
  },

  async nameExists(workspaceId: string, name: string): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM audiences WHERE workspace_id = $1 AND name = $2 AND is_deleted = FALSE`,
      [workspaceId, name],
    );
    return r.rowCount! > 0;
  },

  async findById(workspaceId: string, id: string): Promise<Audience | null> {
    const r = await pool.query<AudienceRow>(
      `${SELECT} WHERE a.workspace_id = $1 AND a.id = $2 AND a.is_deleted = FALSE`,
      [workspaceId, id],
    );
    return r.rows[0] ? toAudience(r.rows[0]) : null;
  },

  async list(
    workspaceId: string,
    opts: { limit: number; cursor?: CursorPayload },
  ): Promise<CursorPage<Audience>> {
    const params: unknown[] = [workspaceId];
    let where = `a.workspace_id = $1 AND a.is_deleted = FALSE`;
    if (opts.cursor) {
      params.push(opts.cursor.last_sort_key, opts.cursor.last_id);
      where += ` AND (a.created_at, a.id) < ($${params.length - 1}, $${params.length})`;
    }
    params.push(opts.limit + 1);
    const r = await pool.query<AudienceRow>(
      `${SELECT} WHERE ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT $${params.length}`,
      params,
    );
    return buildCursorPage(r.rows.map(toAudience), opts.limit, (a) => ({
      last_id: a.id,
      last_sort_key: a.created_at,
    }));
  },

  async update(
    workspaceId: string,
    id: string,
    fields: { name?: string; description?: string },
  ): Promise<Audience | null> {
    const sets: string[] = [];
    const params: unknown[] = [workspaceId, id];
    if (fields.name !== undefined) {
      params.push(fields.name);
      sets.push(`name = $${params.length}`);
    }
    if (fields.description !== undefined) {
      params.push(fields.description);
      sets.push(`description = $${params.length}`);
    }
    if (sets.length === 0) return this.findById(workspaceId, id);
    const r = await pool.query(
      `UPDATE audiences SET ${sets.join(', ')}
        WHERE workspace_id = $1 AND id = $2 AND is_deleted = FALSE`,
      params,
    );
    if (r.rowCount === 0) return null;
    return this.findById(workspaceId, id);
  },

  async softDelete(workspaceId: string, id: string): Promise<boolean> {
    const r = await pool.query(
      `UPDATE audiences SET is_deleted = TRUE, deleted_at = now()
        WHERE workspace_id = $1 AND id = $2 AND is_deleted = FALSE`,
      [workspaceId, id],
    );
    return r.rowCount! > 0;
  },

  async addMember(audienceId: string, subscriberId: string): Promise<void> {
    await pool.query(
      `INSERT INTO audience_members (audience_id, subscriber_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [audienceId, subscriberId],
    );
  },

  async removeMember(audienceId: string, subscriberId: string): Promise<boolean> {
    const r = await pool.query(
      `DELETE FROM audience_members WHERE audience_id = $1 AND subscriber_id = $2`,
      [audienceId, subscriberId],
    );
    return r.rowCount! > 0;
  },

  async listMembers(
    workspaceId: string,
    audienceId: string,
    opts: { limit: number; cursor?: CursorPayload },
  ): Promise<CursorPage<{ subscriber_id: string; external_id: string; joined_at: string }>> {
    const params: unknown[] = [workspaceId, audienceId];
    let where = `m.audience_id = $2 AND s.workspace_id = $1 AND s.is_deleted = FALSE`;
    if (opts.cursor) {
      params.push(opts.cursor.last_sort_key, opts.cursor.last_id);
      where += ` AND (m.created_at, s.id) < ($${params.length - 1}, $${params.length})`;
    }
    params.push(opts.limit + 1);
    const r = await pool.query<{ subscriber_id: string; external_id: string; created_at: Date }>(
      `SELECT s.id AS subscriber_id, s.external_id, m.created_at
         FROM audience_members m JOIN subscribers s ON s.id = m.subscriber_id
        WHERE ${where} ORDER BY m.created_at DESC, s.id DESC LIMIT $${params.length}`,
      params,
    );
    const mapped = r.rows.map((row) => ({
      subscriber_id: row.subscriber_id,
      external_id: row.external_id,
      joined_at: row.created_at.toISOString(),
    }));
    return buildCursorPage(mapped, opts.limit, (m) => ({
      last_id: m.subscriber_id,
      last_sort_key: m.joined_at,
    }));
  },
};
