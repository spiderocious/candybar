import { env } from '../env.js';
import { pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';

import { enqueueDispatch } from './queue.js';

interface OutboxRow {
  id: string;
  event_id: string;
  workspace_id: string;
}

/**
 * Transactional-outbox relay. Polls for events committed but not yet enqueued and
 * pushes them to the BullMQ dispatch queue. `FOR UPDATE SKIP LOCKED` lets N nodes
 * run this concurrently without double-enqueuing the same row.
 */
export class OutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;

  start(): void {
    this.stopped = false;
    this.schedule();
    logger.info('outbox relay started', { intervalMs: env.OUTBOX_POLL_INTERVAL_MS });
  }

  private schedule(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.tick().finally(() => this.schedule());
    }, env.OUTBOX_POLL_INTERVAL_MS);
  }

  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rows = await client.query<OutboxRow>(
        `SELECT o.id, o.event_id, e.workspace_id
           FROM outbox o JOIN events e ON e.id = o.event_id
          WHERE o.enqueued_at IS NULL
          ORDER BY o.created_at
          FOR UPDATE OF o SKIP LOCKED
          LIMIT $1`,
        [env.OUTBOX_BATCH_SIZE],
      );

      for (const row of rows.rows) {
        await enqueueDispatch({ eventId: row.event_id, workspaceId: row.workspace_id });
        await client.query(
          `UPDATE outbox SET enqueued_at = now(), attempts = attempts + 1 WHERE id = $1`,
          [row.id],
        );
      }
      await client.query('COMMIT');
      if (rows.rows.length > 0) {
        logger.debug('outbox relay enqueued batch', { count: rows.rows.length });
      }
      return rows.rows.length;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('outbox relay tick failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      return 0;
    } finally {
      client.release();
      this.running = false;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    // Let an in-flight tick finish.
    while (this.running) {
      await new Promise((r) => setTimeout(r, 50));
    }
    logger.info('outbox relay stopped');
  }
}

export const outboxRelay = new OutboxRelay();
