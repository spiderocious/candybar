import type { CreateProviderInput, UpdateProviderInput } from '@communique/core';
import type { Request, Response } from 'express';

import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';

import { providersService } from './providers.service.js';

export async function createProvider(req: Request, res: Response): Promise<void> {
  const result = await providersService.create(requireWorkspaceId(), req.body as CreateProviderInput);
  ResponseUtil.created(res, unwrap(result));
}

export async function listProviders(_req: Request, res: Response): Promise<void> {
  const result = await providersService.list(requireWorkspaceId());
  ResponseUtil.ok(res, unwrap(result));
}

export async function getProviderById(req: Request, res: Response): Promise<void> {
  const result = await providersService.get(requireWorkspaceId(), req.params.id as string);
  ResponseUtil.ok(res, unwrap(result));
}

export async function updateProvider(req: Request, res: Response): Promise<void> {
  const result = await providersService.update(
    requireWorkspaceId(),
    req.params.id as string,
    req.body as UpdateProviderInput,
  );
  ResponseUtil.ok(res, unwrap(result));
}

export async function deleteProvider(req: Request, res: Response): Promise<void> {
  unwrap(await providersService.remove(requireWorkspaceId(), req.params.id as string));
  ResponseUtil.noContent(res);
}
