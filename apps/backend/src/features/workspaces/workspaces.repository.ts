import type { ApiCredential, Workspace } from '@communique/core';

import { pool, type Sql } from '../../lib/db.js';

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
}

interface CredentialRow {
  id: string;
  workspace_id: string;
  name: string;
  prefix: string;
  last_used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

const toWorkspace = (r: WorkspaceRow): Workspace => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
});

const toCredential = (r: CredentialRow): ApiCredential => ({
  id: r.id,
  workspace_id: r.workspace_id,
  name: r.name,
  prefix: r.prefix,
  last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
  revoked_at: r.revoked_at ? r.revoked_at.toISOString() : null,
  created_at: r.created_at.toISOString(),
});

export const workspacesRepository = {
  async slugExists(slug: string): Promise<boolean> {
    const r = await pool.query(`SELECT 1 FROM workspaces WHERE slug = $1`, [slug]);
    return r.rowCount! > 0;
  },

  async createWorkspace(id: string, name: string, slug: string): Promise<Workspace> {
    const r = await pool.query<WorkspaceRow>(
      `INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)
       RETURNING id, name, slug, created_at, updated_at`,
      [id, name, slug],
    );
    return toWorkspace(r.rows[0]!);
  },

  async findWorkspace(id: string): Promise<Workspace | null> {
    const r = await pool.query<WorkspaceRow>(
      `SELECT id, name, slug, created_at, updated_at FROM workspaces WHERE id = $1`,
      [id],
    );
    return r.rows[0] ? toWorkspace(r.rows[0]) : null;
  },

  async createCredential(
    params: { id: string; workspaceId: string; name: string; keyHash: string; prefix: string },
    sql: Sql = pool,
  ): Promise<ApiCredential> {
    const r = await sql.query<CredentialRow>(
      `INSERT INTO api_credentials (id, workspace_id, name, key_hash, prefix)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, workspace_id, name, prefix, last_used_at, revoked_at, created_at`,
      [params.id, params.workspaceId, params.name, params.keyHash, params.prefix],
    );
    return toCredential(r.rows[0]!);
  },

  async listCredentials(workspaceId: string): Promise<ApiCredential[]> {
    const r = await pool.query<CredentialRow>(
      `SELECT id, workspace_id, name, prefix, last_used_at, revoked_at, created_at
         FROM api_credentials WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId],
    );
    return r.rows.map(toCredential);
  },

  async findCredential(workspaceId: string, id: string): Promise<ApiCredential | null> {
    const r = await pool.query<CredentialRow>(
      `SELECT id, workspace_id, name, prefix, last_used_at, revoked_at, created_at
         FROM api_credentials WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
    return r.rows[0] ? toCredential(r.rows[0]) : null;
  },

  async revokeCredential(workspaceId: string, id: string): Promise<boolean> {
    const r = await pool.query(
      `UPDATE api_credentials SET revoked_at = now()
        WHERE workspace_id = $1 AND id = $2 AND revoked_at IS NULL`,
      [workspaceId, id],
    );
    return r.rowCount! > 0;
  },
};
