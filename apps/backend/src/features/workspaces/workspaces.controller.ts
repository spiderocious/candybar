import type { CreateCredentialInput, CreateWorkspaceInput } from '@communique/core';
import type { Request, Response } from 'express';

import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';

import { workspacesService } from './workspaces.service.js';

export async function createWorkspace(req: Request, res: Response): Promise<void> {
  const result = await workspacesService.create(req.body as CreateWorkspaceInput);
  ResponseUtil.created(res, unwrap(result));
}

export async function getWorkspace(req: Request, res: Response): Promise<void> {
  const result = await workspacesService.get(req.params.id as string);
  ResponseUtil.ok(res, unwrap(result));
}

export async function issueCredential(req: Request, res: Response): Promise<void> {
  const workspaceId = requireWorkspaceId();
  const result = await workspacesService.issueCredential(
    workspaceId,
    req.body as CreateCredentialInput,
  );
  ResponseUtil.created(res, unwrap(result));
}

export async function listCredentials(_req: Request, res: Response): Promise<void> {
  const result = await workspacesService.listCredentials(requireWorkspaceId());
  ResponseUtil.ok(res, unwrap(result));
}

export async function rotateCredential(req: Request, res: Response): Promise<void> {
  const result = await workspacesService.rotateCredential(
    requireWorkspaceId(),
    req.params.id as string,
  );
  ResponseUtil.created(res, unwrap(result));
}

export async function revokeCredential(req: Request, res: Response): Promise<void> {
  const result = await workspacesService.revokeCredential(
    requireWorkspaceId(),
    req.params.id as string,
  );
  unwrap(result);
  ResponseUtil.noContent(res);
}
