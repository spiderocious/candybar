import type { Request, Response } from 'express';

import { clampLimit, decodeCursor } from '../../lib/cursor.js';
import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';

import { deadLettersService } from './dead-letters.service.js';

export async function listDeadLetters(req: Request, res: Response): Promise<void> {
  const { cursor, limit } = req.query;
  const page = unwrap(
    await deadLettersService.list(requireWorkspaceId(), {
      limit: clampLimit(limit),
      ...(typeof cursor === 'string' ? { cursor: decodeCursor(cursor) } : {}),
    }),
  );
  ResponseUtil.ok(res, page.items, page.meta);
}

export async function getDeadLetter(req: Request, res: Response): Promise<void> {
  const result = await deadLettersService.get(requireWorkspaceId(), req.params.id as string);
  ResponseUtil.ok(res, unwrap(result));
}

export async function replayDeadLetter(req: Request, res: Response): Promise<void> {
  const result = await deadLettersService.replay(requireWorkspaceId(), req.params.id as string);
  ResponseUtil.accepted(res, unwrap(result));
}
