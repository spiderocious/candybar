import type { CreateTemplateInput, PreviewTemplateInput, PublishVersionInput } from '@communique/core';
import type { Request, Response } from 'express';

import { clampLimit, decodeCursor } from '../../lib/cursor.js';
import { ValidationError } from '../../lib/errors.js';
import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';

import { templatesService } from './templates.service.js';

export async function createTemplate(req: Request, res: Response): Promise<void> {
  const result = await templatesService.create(requireWorkspaceId(), req.body as CreateTemplateInput);
  ResponseUtil.created(res, unwrap(result));
}

export async function listTemplates(req: Request, res: Response): Promise<void> {
  const { cursor, limit } = req.query;
  const page = unwrap(
    await templatesService.list(requireWorkspaceId(), {
      limit: clampLimit(limit),
      ...(typeof cursor === 'string' ? { cursor: decodeCursor(cursor) } : {}),
    }),
  );
  ResponseUtil.ok(res, page.items, page.meta);
}

export async function getTemplate(req: Request, res: Response): Promise<void> {
  const result = await templatesService.get(requireWorkspaceId(), req.params.id as string);
  ResponseUtil.ok(res, unwrap(result));
}

export async function publishVersion(req: Request, res: Response): Promise<void> {
  const result = await templatesService.publishVersion(
    requireWorkspaceId(),
    req.params.id as string,
    req.body as PublishVersionInput,
  );
  ResponseUtil.created(res, unwrap(result));
}

export async function listVersions(req: Request, res: Response): Promise<void> {
  const result = await templatesService.listVersions(requireWorkspaceId(), req.params.id as string);
  ResponseUtil.ok(res, unwrap(result));
}

export async function getVersion(req: Request, res: Response): Promise<void> {
  const version = Number(req.params.version);
  if (!Number.isInteger(version) || version < 1) {
    throw new ValidationError('Version must be a positive integer.', 'version');
  }
  const result = await templatesService.getVersion(
    requireWorkspaceId(),
    req.params.id as string,
    version,
  );
  ResponseUtil.ok(res, unwrap(result));
}

export async function previewTemplate(req: Request, res: Response): Promise<void> {
  const result = await templatesService.preview(
    requireWorkspaceId(),
    req.params.id as string,
    req.body as PreviewTemplateInput,
  );
  ResponseUtil.ok(res, unwrap(result));
}
