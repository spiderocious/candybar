import type { CreateRoutingRuleInput, UpdateRoutingRuleInput } from '@communique/core';
import type { Request, Response } from 'express';

import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';

import { routingRulesService } from './routing-rules.service.js';

export async function createRule(req: Request, res: Response): Promise<void> {
  const result = await routingRulesService.create(
    requireWorkspaceId(),
    req.body as CreateRoutingRuleInput,
  );
  ResponseUtil.created(res, unwrap(result));
}

export async function listRules(_req: Request, res: Response): Promise<void> {
  const result = await routingRulesService.list(requireWorkspaceId());
  ResponseUtil.ok(res, unwrap(result));
}

export async function getRule(req: Request, res: Response): Promise<void> {
  const result = await routingRulesService.get(requireWorkspaceId(), req.params.id as string);
  ResponseUtil.ok(res, unwrap(result));
}

export async function updateRule(req: Request, res: Response): Promise<void> {
  const result = await routingRulesService.update(
    requireWorkspaceId(),
    req.params.id as string,
    req.body as UpdateRoutingRuleInput,
  );
  ResponseUtil.ok(res, unwrap(result));
}

export async function deleteRule(req: Request, res: Response): Promise<void> {
  unwrap(await routingRulesService.remove(requireWorkspaceId(), req.params.id as string));
  ResponseUtil.noContent(res);
}
