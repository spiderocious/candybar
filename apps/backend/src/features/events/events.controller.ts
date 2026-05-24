import type { PublishEventInput } from '@communique/core';
import type { Request, Response } from 'express';

import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';

import { eventsService } from './events.service.js';

export async function publishEvent(req: Request, res: Response): Promise<void> {
  const idempotencyKey = req.header('idempotency-key') ?? null;
  const result = await eventsService.publish(
    requireWorkspaceId(),
    req.body as PublishEventInput,
    idempotencyKey && idempotencyKey.length > 0 ? idempotencyKey : null,
  );
  // 202 Accepted — work is queued, not yet done.
  ResponseUtil.accepted(res, unwrap(result));
}

export async function getEvent(req: Request, res: Response): Promise<void> {
  const result = await eventsService.get(requireWorkspaceId(), req.params.id as string);
  ResponseUtil.ok(res, unwrap(result));
}
