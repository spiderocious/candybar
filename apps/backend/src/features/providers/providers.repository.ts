import type { Channel, Provider, ProviderKey } from '@communique/core';

import { pool } from '../../lib/db.js';
import { decryptJson, maskConfig } from '../../lib/encryption.js';

interface ProviderRow {
  id: string;
  workspace_id: string;
  channel: string;
  provider_key: string;
  priority: number;
  enabled: boolean;
  config_encrypted: string;
  created_at: Date;
  updated_at: Date;
}

const toProvider = (r: ProviderRow): Provider => ({
  id: r.id,
  workspace_id: r.workspace_id,
  channel: r.channel as Channel,
  provider_key: r.provider_key as ProviderKey,
  priority: r.priority,
  enabled: r.enabled,
  config_masked: maskConfig(decryptJson<Record<string, unknown>>(r.config_encrypted)),
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
});

/** Resolved provider including DECRYPTED config — only for the dispatch worker. */
export interface ResolvedProvider {
  id: string;
  provider_key: ProviderKey;
  channel: Channel;
  priority: number;
  config: Record<string, unknown>;
}

export const providersRepository = {
  async create(
    params: {
      id: string;
      workspaceId: string;
      channel: Channel;
      providerKey: ProviderKey;
      priority: number;
      enabled: boolean;
      configEncrypted: string;
    },
  ): Promise<Provider> {
    const r = await pool.query<ProviderRow>(
      `INSERT INTO providers
         (id, workspace_id, channel, provider_key, priority, enabled, config_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, workspace_id, channel, provider_key, priority, enabled, config_encrypted, created_at, updated_at`,
      [
        params.id,
        params.workspaceId,
        params.channel,
        params.providerKey,
        params.priority,
        params.enabled,
        params.configEncrypted,
      ],
    );
    return toProvider(r.rows[0]!);
  },

  async priorityTaken(workspaceId: string, channel: Channel, priority: number): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM providers WHERE workspace_id = $1 AND channel = $2 AND priority = $3`,
      [workspaceId, channel, priority],
    );
    return r.rowCount! > 0;
  },

  async nextPriority(workspaceId: string, channel: Channel): Promise<number> {
    const r = await pool.query<{ max: number | null }>(
      `SELECT MAX(priority) AS max FROM providers WHERE workspace_id = $1 AND channel = $2`,
      [workspaceId, channel],
    );
    return (r.rows[0]?.max ?? 0) + 1;
  },

  async findById(workspaceId: string, id: string): Promise<Provider | null> {
    const r = await pool.query<ProviderRow>(
      `SELECT id, workspace_id, channel, provider_key, priority, enabled, config_encrypted, created_at, updated_at
         FROM providers WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
    return r.rows[0] ? toProvider(r.rows[0]) : null;
  },

  async list(workspaceId: string): Promise<Provider[]> {
    const r = await pool.query<ProviderRow>(
      `SELECT id, workspace_id, channel, provider_key, priority, enabled, config_encrypted, created_at, updated_at
         FROM providers WHERE workspace_id = $1 ORDER BY channel, priority`,
      [workspaceId],
    );
    return r.rows.map(toProvider);
  },

  /** Ordered, enabled providers for a channel WITH decrypted config (dispatch only). */
  async resolveForChannel(workspaceId: string, channel: Channel): Promise<ResolvedProvider[]> {
    const r = await pool.query<ProviderRow>(
      `SELECT id, workspace_id, channel, provider_key, priority, enabled, config_encrypted, created_at, updated_at
         FROM providers
        WHERE workspace_id = $1 AND channel = $2 AND enabled = TRUE
        ORDER BY priority ASC`,
      [workspaceId, channel],
    );
    return r.rows.map((row) => ({
      id: row.id,
      provider_key: row.provider_key as ProviderKey,
      channel: row.channel as Channel,
      priority: row.priority,
      config: decryptJson<Record<string, unknown>>(row.config_encrypted),
    }));
  },

  async update(
    workspaceId: string,
    id: string,
    fields: { priority?: number; enabled?: boolean; configEncrypted?: string },
  ): Promise<Provider | null> {
    const sets: string[] = [];
    const params: unknown[] = [workspaceId, id];
    if (fields.priority !== undefined) {
      params.push(fields.priority);
      sets.push(`priority = $${params.length}`);
    }
    if (fields.enabled !== undefined) {
      params.push(fields.enabled);
      sets.push(`enabled = $${params.length}`);
    }
    if (fields.configEncrypted !== undefined) {
      params.push(fields.configEncrypted);
      sets.push(`config_encrypted = $${params.length}`);
    }
    if (sets.length === 0) return this.findById(workspaceId, id);
    const r = await pool.query(
      `UPDATE providers SET ${sets.join(', ')} WHERE workspace_id = $1 AND id = $2`,
      params,
    );
    if (r.rowCount === 0) return null;
    return this.findById(workspaceId, id);
  },

  async remove(workspaceId: string, id: string): Promise<boolean> {
    const r = await pool.query(`DELETE FROM providers WHERE workspace_id = $1 AND id = $2`, [
      workspaceId,
      id,
    ]);
    return r.rowCount! > 0;
  },
};
