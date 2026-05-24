import type { AttemptStatus, Channel } from '@communique/core';
import type { Request, Response } from 'express';

import { clampLimit, decodeCursor } from '../../lib/cursor.js';
import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';

import type { LogFilters } from './notification-log.repository.js';
import { notificationLogService } from './notification-log.service.js';

export async function listLog(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const filters: LogFilters = {
    limit: clampLimit(q.limit),
    ...(typeof q.cursor === 'string' ? { cursor: decodeCursor(q.cursor) } : {}),
    ...(typeof q.subscriber_id === 'string' ? { subscriberId: q.subscriber_id } : {}),
    ...(typeof q.event_type === 'string' ? { eventType: q.event_type } : {}),
    ...(typeof q.channel === 'string' ? { channel: q.channel as Channel } : {}),
    ...(typeof q.status === 'string' ? { status: q.status as AttemptStatus } : {}),
    ...(typeof q.from === 'string' ? { from: q.from } : {}),
    ...(typeof q.to === 'string' ? { to: q.to } : {}),
  };
  const page = unwrap(await notificationLogService.list(requireWorkspaceId(), filters));
  ResponseUtil.ok(res, page.items, page.meta);
}
