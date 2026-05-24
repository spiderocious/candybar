import type { Event, EventStatus, EventTargetKind } from '@communique/core';

import { pool, withTransaction, type Sql } from '../../lib/db.js';
import { newId } from '../../lib/ids.js';

interface EventRow {
  id: string;
  workspace_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  target_kind: string;
  target_ref: string;
  status: string;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
}

const toEvent = (r: EventRow): Event => ({
  id: r.id,
  workspace_id: r.workspace_id,
  event_type: r.event_type,
  payload: r.payload,
  target_kind: r.target_kind as EventTargetKind,
  target_ref: r.target_ref,
  status: r.status as EventStatus,
  idempotency_key: r.idempotency_key,
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
});

export const eventsRepository = {
  /**
   * Inserts the event AND its outbox row in a single transaction (the
   * transactional-outbox pattern). If an idempotency key collides, returns the
   * existing event and does NOT create a second outbox row.
   */
  async ingest(params: {
    workspaceId: string;
    eventType: string;
    payload: Record<string, unknown>;
    targetKind: EventTargetKind;
    targetRef: string;
    idempotencyKey: string | null;
  }): Promise<{ event: Event; created: boolean }> {
    return withTransaction(async (trx) => {
      if (params.idempotencyKey) {
        const existing = await trx.query<EventRow>(
          `SELECT id, workspace_id, event_type, payload, target_kind, target_ref, status,
                  idempotency_key, created_at, updated_at
             FROM events WHERE workspace_id = $1 AND idempotency_key = $2`,
          [params.workspaceId, params.idempotencyKey],
        );
        if (existing.rows[0]) {
          return { event: toEvent(existing.rows[0]), created: false };
        }
      }

      const eventId = newId('event');
      const inserted = await trx.query<EventRow>(
        `INSERT INTO events
           (id, workspace_id, event_type, payload, target_kind, target_ref, status, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, 'received', $7)
         RETURNING id, workspace_id, event_type, payload, target_kind, target_ref, status,
                   idempotency_key, created_at, updated_at`,
        [
          eventId,
          params.workspaceId,
          params.eventType,
          JSON.stringify(params.payload),
          params.targetKind,
          params.targetRef,
          params.idempotencyKey,
        ],
      );

      await trx.query(`INSERT INTO outbox (id, event_id) VALUES ($1, $2)`, [
        newId('outbox'),
        eventId,
      ]);

      return { event: toEvent(inserted.rows[0]!), created: true };
    });
  },

  async findById(workspaceId: string, id: string): Promise<Event | null> {
    const r = await pool.query<EventRow>(
      `SELECT id, workspace_id, event_type, payload, target_kind, target_ref, status,
              idempotency_key, created_at, updated_at
         FROM events WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
    return r.rows[0] ? toEvent(r.rows[0]) : null;
  },

  async setStatus(eventId: string, status: EventStatus, sql: Sql = pool): Promise<void> {
    await sql.query(`UPDATE events SET status = $2 WHERE id = $1`, [eventId, status]);
  },

  /** Re-create an outbox row for an event (used by dead-letter replay). */
  async requeue(eventId: string): Promise<void> {
    await withTransaction(async (trx) => {
      await trx.query(`UPDATE events SET status = 'received' WHERE id = $1`, [eventId]);
      await trx.query(`INSERT INTO outbox (id, event_id) VALUES ($1, $2)`, [
        newId('outbox'),
        eventId,
      ]);
    });
  },
};
