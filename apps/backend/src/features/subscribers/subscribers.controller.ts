import type {
  AddChannelInput,
  RegisterSubscriberInput,
  SetOptOutInput,
  UpdateSubscriberInput,
} from '@communique/core';
import type { Request, Response } from 'express';

import { clampLimit, decodeCursor } from '../../lib/cursor.js';
import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';
import { notificationLogService } from '../notification-log/notification-log.service.js';

import { subscribersService } from './subscribers.service.js';

export async function registerSubscriber(req: Request, res: Response): Promise<void> {
  const result = await subscribersService.register(
    requireWorkspaceId(),
    req.body as RegisterSubscriberInput,
  );
  ResponseUtil.created(res, unwrap(result));
}

export async function listSubscribers(req: Request, res: Response): Promise<void> {
  const { cursor, limit, search } = req.query;
  const page = unwrap(
    await subscribersService.list(requireWorkspaceId(), {
      limit: clampLimit(limit),
      ...(typeof cursor === 'string' ? { cursor: decodeCursor(cursor) } : {}),
      ...(typeof search === 'string' ? { search } : {}),
    }),
  );
  ResponseUtil.ok(res, page.items, page.meta);
}

export async function getSubscriber(req: Request, res: Response): Promise<void> {
  const result = await subscribersService.get(requireWorkspaceId(), req.params.id as string);
  ResponseUtil.ok(res, unwrap(result));
}

export async function updateSubscriber(req: Request, res: Response): Promise<void> {
  const result = await subscribersService.update(
    requireWorkspaceId(),
    req.params.id as string,
    req.body as UpdateSubscriberInput,
  );
  ResponseUtil.ok(res, unwrap(result));
}

export async function deleteSubscriber(req: Request, res: Response): Promise<void> {
  unwrap(await subscribersService.remove(requireWorkspaceId(), req.params.id as string));
  ResponseUtil.noContent(res);
}

export async function addChannel(req: Request, res: Response): Promise<void> {
  const result = await subscribersService.addChannel(
    requireWorkspaceId(),
    req.params.id as string,
    req.body as AddChannelInput,
  );
  ResponseUtil.created(res, unwrap(result));
}

export async function removeChannel(req: Request, res: Response): Promise<void> {
  unwrap(
    await subscribersService.removeChannel(
      requireWorkspaceId(),
      req.params.id as string,
      req.params.channelId as string,
    ),
  );
  ResponseUtil.noContent(res);
}

export async function setOptOut(req: Request, res: Response): Promise<void> {
  const result = await subscribersService.setOptOut(
    requireWorkspaceId(),
    req.params.id as string,
    req.body as SetOptOutInput,
  );
  ResponseUtil.ok(res, unwrap(result));
}

export async function getHistory(req: Request, res: Response): Promise<void> {
  const { cursor, limit } = req.query;
  const page = unwrap(
    await notificationLogService.listForSubscriber(requireWorkspaceId(), req.params.id as string, {
      limit: clampLimit(limit),
      ...(typeof cursor === 'string' ? { cursor: decodeCursor(cursor) } : {}),
    }),
  );
  ResponseUtil.ok(res, page.items, page.meta);
}
