import type { Channel, Metrics } from '@communique/core';

import { queueDepth } from '../../dispatch/queue.js';
import { pool } from '../../lib/db.js';

export interface MetricsFilters {
  channel?: Channel;
  eventType?: string;
  from?: string;
  to?: string;
}

interface CountRow {
  key: string;
  count: string;
}

export const metricsRepository = {
  async compute(workspaceId: string, f: MetricsFilters): Promise<Metrics> {
    // Build the shared WHERE for dispatch_attempts.
    const aParams: unknown[] = [workspaceId];
    let aWhere = `workspace_id = $1`;
    const addA = (clause: string, value: unknown) => {
      aParams.push(value);
      aWhere += ` AND ${clause.replace('$$', `$${aParams.length}`)}`;
    };
    if (f.channel) addA('channel = $$', f.channel);
    if (f.eventType) addA('event_type = $$', f.eventType);
    if (f.from) addA('created_at >= $$', f.from);
    if (f.to) addA('created_at <= $$', f.to);

    // Build the shared WHERE for events.
    const eParams: unknown[] = [workspaceId];
    let eWhere = `workspace_id = $1`;
    const addE = (clause: string, value: unknown) => {
      eParams.push(value);
      eWhere += ` AND ${clause.replace('$$', `$${eParams.length}`)}`;
    };
    if (f.eventType) addE('event_type = $$', f.eventType);
    if (f.from) addE('created_at >= $$', f.from);
    if (f.to) addE('created_at <= $$', f.to);

    const [
      eventCounts,
      attemptAgg,
      byChannel,
      byEventType,
      byStatus,
      deadCount,
      depth,
    ] = await Promise.all([
      pool.query<{ status: string; count: string }>(
        `SELECT status, count(*)::text AS count FROM events WHERE ${eWhere} GROUP BY status`,
        eParams,
      ),
      pool.query<{
        success: string;
        failure: string;
        retries: string;
      }>(
        `SELECT
           count(*) FILTER (WHERE status = 'success')::text AS success,
           count(*) FILTER (WHERE status IN ('transport_failure','hard_failure'))::text AS failure,
           count(*) FILTER (WHERE attempt_no > 1)::text AS retries
         FROM dispatch_attempts WHERE ${aWhere}`,
        aParams,
      ),
      pool.query<CountRow>(
        `SELECT channel AS key, count(*)::text AS count FROM dispatch_attempts
          WHERE ${aWhere} GROUP BY channel ORDER BY channel`,
        aParams,
      ),
      pool.query<CountRow>(
        `SELECT event_type AS key, count(*)::text AS count FROM dispatch_attempts
          WHERE ${aWhere} GROUP BY event_type ORDER BY count DESC LIMIT 20`,
        aParams,
      ),
      pool.query<CountRow>(
        `SELECT status AS key, count(*)::text AS count FROM dispatch_attempts
          WHERE ${aWhere} GROUP BY status ORDER BY status`,
        aParams,
      ),
      pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM dead_letters WHERE workspace_id = $1`,
        [workspaceId],
      ),
      queueDepth(),
    ]);

    const eventsByStatus = new Map(eventCounts.rows.map((r) => [r.status, Number(r.count)]));
    const eventsReceived = [...eventsByStatus.values()].reduce((a, b) => a + b, 0);
    const eventsProcessed = eventsByStatus.get('dispatched') ?? 0;
    const eventsDead = (eventsByStatus.get('dead') ?? 0) + (eventsByStatus.get('failed') ?? 0);

    const success = Number(attemptAgg.rows[0]?.success ?? 0);
    const failure = Number(attemptAgg.rows[0]?.failure ?? 0);
    const retries = Number(attemptAgg.rows[0]?.retries ?? 0);
    const total = success + failure;

    return {
      events_received: eventsReceived,
      events_processed: eventsProcessed,
      events_dead: eventsDead,
      dispatch_success: success,
      dispatch_failure: failure,
      dispatch_success_rate: total === 0 ? 0 : Number((success / total).toFixed(4)),
      retry_count: retries,
      dead_letter_count: Number(deadCount.rows[0]?.count ?? 0),
      queue_depth: depth,
      by_channel: byChannel.rows.map((r) => ({ key: r.key, count: Number(r.count) })),
      by_event_type: byEventType.rows.map((r) => ({ key: r.key, count: Number(r.count) })),
      by_status: byStatus.rows.map((r) => ({ key: r.key, count: Number(r.count) })),
    };
  },
};
