import type { TestDispatchInput } from '@communique/core';
import type { Request, Response } from 'express';

import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';
import { unwrap } from '../../lib/unwrap.js';

import { testDispatchService } from './test-dispatch.service.js';

export async function runTestDispatch(req: Request, res: Response): Promise<void> {
  const result = await testDispatchService.run(requireWorkspaceId(), req.body as TestDispatchInput);
  ResponseUtil.ok(res, unwrap(result));
}
