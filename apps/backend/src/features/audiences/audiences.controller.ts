import type {
  AddAudienceMemberInput,
  CreateAudienceInput,
  UpdateAudienceInput,
} from '@communique/core';
import type { Request, Response } from 'express';

import { clampLimit, decodeCursor } from '../../lib/cursor.js';
import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';

import { audiencesService } from './audiences.service.js';

function listOpts(req: Request) {
  const { cursor, limit } = req.query;
  return {
    limit: clampLimit(limit),
    ...(typeof cursor === 'string' ? { cursor: decodeCursor(cursor) } : {}),
  };
}

export async function createAudience(req: Request, res: Response): Promise<void> {
  const result = await audiencesService.create(requireWorkspaceId(), req.body as CreateAudienceInput);
  ResponseUtil.created(res, unwrap(result));
}

export async function listAudiences(req: Request, res: Response): Promise<void> {
  const page = unwrap(await audiencesService.list(requireWorkspaceId(), listOpts(req)));
  ResponseUtil.ok(res, page.items, page.meta);
}

export async function getAudience(req: Request, res: Response): Promise<void> {
  const result = await audiencesService.get(requireWorkspaceId(), req.params.id as string);
  ResponseUtil.ok(res, unwrap(result));
}

export async function updateAudience(req: Request, res: Response): Promise<void> {
  const result = await audiencesService.update(
    requireWorkspaceId(),
    req.params.id as string,
    req.body as UpdateAudienceInput,
  );
  ResponseUtil.ok(res, unwrap(result));
}

export async function deleteAudience(req: Request, res: Response): Promise<void> {
  unwrap(await audiencesService.remove(requireWorkspaceId(), req.params.id as string));
  ResponseUtil.noContent(res);
}

export async function addMember(req: Request, res: Response): Promise<void> {
  const result = await audiencesService.addMember(
    requireWorkspaceId(),
    req.params.id as string,
    req.body as AddAudienceMemberInput,
  );
  ResponseUtil.ok(res, unwrap(result));
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  unwrap(
    await audiencesService.removeMember(
      requireWorkspaceId(),
      req.params.id as string,
      req.params.subscriberId as string,
    ),
  );
  ResponseUtil.noContent(res);
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  const page = unwrap(
    await audiencesService.listMembers(requireWorkspaceId(), req.params.id as string, listOpts(req)),
  );
  ResponseUtil.ok(res, page.items, page.meta);
}
