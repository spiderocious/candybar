import type {
  Channel,
  Subscriber,
  SubscriberChannel,
  SubscriberWithChannels,
} from '@communique/core';

import { pool, type Sql } from '../../lib/db.js';
import { buildCursorPage, type CursorPage, type CursorPayload } from '../../lib/cursor.js';

interface SubscriberRow {
  id: string;
  workspace_id: string;
  external_id: string;
  attributes: Record<string, unknown>;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ChannelRow {
  id: string;
  subscriber_id: string;
  channel: string;
  address: string;
  verified: boolean;
  created_at: Date;
}

const toSubscriber = (r: SubscriberRow): Subscriber => ({
  id: r.id,
  workspace_id: r.workspace_id,
  external_id: r.external_id,
  attributes: r.attributes,
  is_deleted: r.is_deleted,
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
});

const toChannel = (r: ChannelRow): SubscriberChannel => ({
  id: r.id,
  subscriber_id: r.subscriber_id,
  channel: r.channel as Channel,
  address: r.address,
  verified: r.verified,
  created_at: r.created_at.toISOString(),
});

export const subscribersRepository = {
  /** Idempotent upsert on (workspace, external_id): dedups registrations. */
  async upsert(
    params: { id: string; workspaceId: string; externalId: string; attributes: Record<string, unknown> },
    sql: Sql = pool,
  ): Promise<Subscriber> {
    const r = await sql.query<SubscriberRow>(
      `INSERT INTO subscribers (id, workspace_id, external_id, attributes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, external_id) DO UPDATE
         SET attributes = subscribers.attributes || EXCLUDED.attributes,
             is_deleted = FALSE,
             deleted_at = NULL,
             updated_at = now()
       RETURNING id, workspace_id, external_id, attributes, is_deleted, created_at, updated_at`,
      [params.id, params.workspaceId, params.externalId, JSON.stringify(params.attributes)],
    );
    return toSubscriber(r.rows[0]!);
  },

  async upsertChannel(
    params: { id: string; subscriberId: string; channel: Channel; address: string },
    sql: Sql = pool,
  ): Promise<SubscriberChannel> {
    const r = await sql.query<ChannelRow>(
      `INSERT INTO subscriber_channels (id, subscriber_id, channel, address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (subscriber_id, channel) DO UPDATE SET address = EXCLUDED.address
       RETURNING id, subscriber_id, channel, address, verified, created_at`,
      [params.id, params.subscriberId, params.channel, params.address],
    );
    return toChannel(r.rows[0]!);
  },

  async findById(workspaceId: string, id: string): Promise<Subscriber | null> {
    const r = await pool.query<SubscriberRow>(
      `SELECT id, workspace_id, external_id, attributes, is_deleted, created_at, updated_at
         FROM subscribers WHERE workspace_id = $1 AND id = $2 AND is_deleted = FALSE`,
      [workspaceId, id],
    );
    return r.rows[0] ? toSubscriber(r.rows[0]) : null;
  },

  async findByExternalId(workspaceId: string, externalId: string): Promise<Subscriber | null> {
    const r = await pool.query<SubscriberRow>(
      `SELECT id, workspace_id, external_id, attributes, is_deleted, created_at, updated_at
         FROM subscribers WHERE workspace_id = $1 AND external_id = $2 AND is_deleted = FALSE`,
      [workspaceId, externalId],
    );
    return r.rows[0] ? toSubscriber(r.rows[0]) : null;
  },

  async listChannels(subscriberId: string): Promise<SubscriberChannel[]> {
    const r = await pool.query<ChannelRow>(
      `SELECT id, subscriber_id, channel, address, verified, created_at
         FROM subscriber_channels WHERE subscriber_id = $1 ORDER BY created_at`,
      [subscriberId],
    );
    return r.rows.map(toChannel);
  },

  async listOptOuts(subscriberId: string): Promise<Channel[]> {
    const r = await pool.query<{ channel: string }>(
      `SELECT channel FROM channel_optouts WHERE subscriber_id = $1`,
      [subscriberId],
    );
    return r.rows.map((row) => row.channel as Channel);
  },

  async listAudiences(subscriberId: string): Promise<{ id: string; name: string }[]> {
    const r = await pool.query<{ id: string; name: string }>(
      `SELECT a.id, a.name FROM audiences a
         JOIN audience_members m ON m.audience_id = a.id
        WHERE m.subscriber_id = $1 AND a.is_deleted = FALSE
        ORDER BY a.name`,
      [subscriberId],
    );
    return r.rows;
  },

  async hydrate(workspaceId: string, sub: Subscriber): Promise<SubscriberWithChannels> {
    const [channels, optouts, audiences] = await Promise.all([
      this.listChannels(sub.id),
      this.listOptOuts(sub.id),
      this.listAudiences(sub.id),
    ]);
    return { ...sub, channels, optouts, audiences };
  },

  async list(
    workspaceId: string,
    opts: { limit: number; cursor?: CursorPayload; search?: string },
  ): Promise<CursorPage<Subscriber>> {
    const params: unknown[] = [workspaceId];
    let where = `workspace_id = $1 AND is_deleted = FALSE`;

    if (opts.search) {
      params.push(`%${opts.search}%`);
      where += ` AND external_id ILIKE $${params.length}`;
    }
    if (opts.cursor) {
      params.push(opts.cursor.last_sort_key, opts.cursor.last_id);
      where += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
    }
    params.push(opts.limit + 1);

    const r = await pool.query<SubscriberRow>(
      `SELECT id, workspace_id, external_id, attributes, is_deleted, created_at, updated_at
         FROM subscribers WHERE ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );
    return buildCursorPage(r.rows.map(toSubscriber), opts.limit, (s) => ({
      last_id: s.id,
      last_sort_key: s.created_at,
    }));
  },

  async updateAttributes(
    workspaceId: string,
    id: string,
    attributes: Record<string, unknown>,
  ): Promise<Subscriber | null> {
    const r = await pool.query<SubscriberRow>(
      `UPDATE subscribers SET attributes = $3
        WHERE workspace_id = $1 AND id = $2 AND is_deleted = FALSE
        RETURNING id, workspace_id, external_id, attributes, is_deleted, created_at, updated_at`,
      [workspaceId, id, JSON.stringify(attributes)],
    );
    return r.rows[0] ? toSubscriber(r.rows[0]) : null;
  },

  async softDelete(workspaceId: string, id: string): Promise<boolean> {
    const r = await pool.query(
      `UPDATE subscribers SET is_deleted = TRUE, deleted_at = now()
        WHERE workspace_id = $1 AND id = $2 AND is_deleted = FALSE`,
      [workspaceId, id],
    );
    return r.rowCount! > 0;
  },

  async setOptOut(subscriberId: string, channel: Channel, optedOut: boolean): Promise<void> {
    if (optedOut) {
      await pool.query(
        `INSERT INTO channel_optouts (subscriber_id, channel) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [subscriberId, channel],
      );
    } else {
      await pool.query(`DELETE FROM channel_optouts WHERE subscriber_id = $1 AND channel = $2`, [
        subscriberId,
        channel,
      ]);
    }
  },

  async removeChannel(subscriberId: string, channelId: string): Promise<boolean> {
    const r = await pool.query(
      `DELETE FROM subscriber_channels WHERE subscriber_id = $1 AND id = $2`,
      [subscriberId, channelId],
    );
    return r.rowCount! > 0;
  },
};
