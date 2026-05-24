import type { AttemptStatus, Channel, DispatchAttempt } from '@communique/core';

import { buildCursorPage, type CursorPage, type CursorPayload } from '../../lib/cursor.js';
import { pool } from '../../lib/db.js';

interface AttemptRow {
  id: string;
  dispatch_id: string;
  workspace_id: string;
  subscriber_id: string;
  event_type: string;
  channel: string;
  provider_key: string | null;
  attempt_no: number;
  status: string;
  error_code: string | null;
  error_detail: string | null;
  created_at: Date;
}

const toAttempt = (r: AttemptRow): DispatchAttempt => ({
  id: r.id,
  dispatch_id: r.dispatch_id,
  workspace_id: r.workspace_id,
  subscriber_id: r.subscriber_id,
  event_type: r.event_type,
  channel: r.channel as Channel,
  provider_key: r.provider_key,
  attempt_no: r.attempt_no,
  status: r.status as AttemptStatus,
  error_code: r.error_code,
  error_detail: r.error_detail,
  created_at: r.created_at.toISOString(),
});

export interface LogFilters {
  limit: number;
  cursor?: CursorPayload;
  subscriberId?: string;
  eventType?: string;
  channel?: Channel;
  status?: AttemptStatus;
  from?: string;
  to?: string;
}

export const notificationLogRepository = {
  async list(workspaceId: string, f: LogFilters): Promise<CursorPage<DispatchAttempt>> {
    const params: unknown[] = [workspaceId];
    let where = `workspace_id = $1`;

    const add = (clause: string, value: unknown) => {
      params.push(value);
      where += ` AND ${clause.replace('$$', `$${params.length}`)}`;
    };

    if (f.subscriberId) add('subscriber_id = $$', f.subscriberId);
    if (f.eventType) add('event_type = $$', f.eventType);
    if (f.channel) add('channel = $$', f.channel);
    if (f.status) add('status = $$', f.status);
    if (f.from) add('created_at >= $$', f.from);
    if (f.to) add('created_at <= $$', f.to);

    if (f.cursor) {
      params.push(f.cursor.last_sort_key, f.cursor.last_id);
      where += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
    }
    params.push(f.limit + 1);

    const r = await pool.query<AttemptRow>(
      `SELECT id, dispatch_id, workspace_id, subscriber_id, event_type, channel,
              provider_key, attempt_no, status, error_code, error_detail, created_at
         FROM dispatch_attempts WHERE ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );
    return buildCursorPage(r.rows.map(toAttempt), f.limit, (a) => ({
      last_id: a.id,
      last_sort_key: a.created_at,
    }));
  },
};
