import type {
  AttemptStatus,
  Channel,
  DeadLetter,
  DeadLetterReason,
  DispatchStatus,
} from '@communique/core';

import { buildCursorPage, type CursorPage, type CursorPayload } from '../lib/cursor.js';
import { pool, type Sql } from '../lib/db.js';
import { newId } from '../lib/ids.js';

interface SubscriberTarget {
  subscriber_id: string;
  external_id: string;
  address: string;
}

interface DeadLetterRow {
  id: string;
  workspace_id: string;
  event_id: string;
  event_type: string;
  reason: string;
  last_error: string | null;
  payload_snapshot: Record<string, unknown>;
  replayable: boolean;
  replayed_at: Date | null;
  created_at: Date;
}

const toDeadLetter = (r: DeadLetterRow): DeadLetter => ({
  id: r.id,
  workspace_id: r.workspace_id,
  event_id: r.event_id,
  event_type: r.event_type,
  reason: r.reason as DeadLetterReason,
  last_error: r.last_error,
  payload_snapshot: r.payload_snapshot,
  replayable: r.replayable,
  replayed_at: r.replayed_at ? r.replayed_at.toISOString() : null,
  created_at: r.created_at.toISOString(),
});

export const dispatchRepository = {
  /** Active subscribers in an audience that have an address for the channel. */
  async audienceTargets(
    workspaceId: string,
    audienceId: string,
    channel: Channel,
  ): Promise<SubscriberTarget[]> {
    const r = await pool.query<SubscriberTarget>(
      `SELECT s.id AS subscriber_id, s.external_id, c.address
         FROM audience_members m
         JOIN subscribers s ON s.id = m.subscriber_id
         JOIN subscriber_channels c ON c.subscriber_id = s.id AND c.channel = $3
        WHERE m.audience_id = $2 AND s.workspace_id = $1 AND s.is_deleted = FALSE`,
      [workspaceId, audienceId, channel],
    );
    return r.rows;
  },

  /** A single directly-targeted subscriber by external id, with channel address. */
  async directTarget(
    workspaceId: string,
    externalId: string,
    channel: Channel,
  ): Promise<SubscriberTarget | null> {
    const r = await pool.query<SubscriberTarget>(
      `SELECT s.id AS subscriber_id, s.external_id, c.address
         FROM subscribers s
         JOIN subscriber_channels c ON c.subscriber_id = s.id AND c.channel = $3
        WHERE s.workspace_id = $1 AND s.external_id = $2 AND s.is_deleted = FALSE`,
      [workspaceId, externalId, channel],
    );
    return r.rows[0] ?? null;
  },

  async isOptedOut(subscriberId: string, channel: Channel): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM channel_optouts WHERE subscriber_id = $1 AND channel = $2`,
      [subscriberId, channel],
    );
    return r.rowCount! > 0;
  },

  /** Upsert the dispatch row for (event, subscriber, channel); returns its id. */
  async upsertDispatch(params: {
    workspaceId: string;
    eventId: string;
    subscriberId: string;
    channel: Channel;
    templateVersionId: string | null;
  }): Promise<string> {
    const id = newId('dispatch');
    const r = await pool.query<{ id: string }>(
      `INSERT INTO dispatches
         (id, workspace_id, event_id, subscriber_id, channel, template_version_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (event_id, subscriber_id, channel) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [
        id,
        params.workspaceId,
        params.eventId,
        params.subscriberId,
        params.channel,
        params.templateVersionId,
      ],
    );
    return r.rows[0]!.id;
  },

  async setDispatchStatus(
    dispatchId: string,
    status: DispatchStatus,
    incrementAttempt: boolean,
  ): Promise<void> {
    await pool.query(
      `UPDATE dispatches
          SET status = $2, attempts = attempts + $3, updated_at = now()
        WHERE id = $1`,
      [dispatchId, status, incrementAttempt ? 1 : 0],
    );
  },

  async recordAttempt(params: {
    dispatchId: string;
    workspaceId: string;
    subscriberId: string;
    eventType: string;
    channel: Channel;
    providerKey: string | null;
    attemptNo: number;
    status: AttemptStatus;
    errorCode: string | null;
    errorDetail: string | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO dispatch_attempts
         (id, dispatch_id, workspace_id, subscriber_id, event_type, channel,
          provider_key, attempt_no, status, error_code, error_detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        newId('attempt'),
        params.dispatchId,
        params.workspaceId,
        params.subscriberId,
        params.eventType,
        params.channel,
        params.providerKey,
        params.attemptNo,
        params.status,
        params.errorCode,
        params.errorDetail,
      ],
    );
  },

  async deadLetter(params: {
    workspaceId: string;
    eventId: string;
    eventType: string;
    reason: DeadLetterReason;
    lastError: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO dead_letters
         (id, workspace_id, event_id, event_type, reason, last_error, payload_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        newId('deadLetter'),
        params.workspaceId,
        params.eventId,
        params.eventType,
        params.reason,
        params.lastError,
        JSON.stringify(params.payload),
      ],
    );
  },

  // ── dead-letter reads (used by the dead-letters feature) ──────────────────────
  async listDeadLetters(
    workspaceId: string,
    opts: { limit: number; cursor?: CursorPayload },
  ): Promise<CursorPage<DeadLetter>> {
    const params: unknown[] = [workspaceId];
    let where = `workspace_id = $1`;
    if (opts.cursor) {
      params.push(opts.cursor.last_sort_key, opts.cursor.last_id);
      where += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
    }
    params.push(opts.limit + 1);
    const r = await pool.query<DeadLetterRow>(
      `SELECT id, workspace_id, event_id, event_type, reason, last_error, payload_snapshot,
              replayable, replayed_at, created_at
         FROM dead_letters WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    return buildCursorPage(r.rows.map(toDeadLetter), opts.limit, (d) => ({
      last_id: d.id,
      last_sort_key: d.created_at,
    }));
  },

  async findDeadLetter(workspaceId: string, id: string): Promise<DeadLetter | null> {
    const r = await pool.query<DeadLetterRow>(
      `SELECT id, workspace_id, event_id, event_type, reason, last_error, payload_snapshot,
              replayable, replayed_at, created_at
         FROM dead_letters WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
    return r.rows[0] ? toDeadLetter(r.rows[0]) : null;
  },

  async markReplayed(workspaceId: string, id: string, sql: Sql = pool): Promise<void> {
    await sql.query(
      `UPDATE dead_letters SET replayed_at = now() WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
  },
};
