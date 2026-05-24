import type { Channel } from '@communique/core';
import type { Request, Response } from 'express';

import { requireWorkspaceId } from '../../lib/request-context.js';
import { ResponseUtil } from '../../lib/response.js';

import { metricsRepository, type MetricsFilters } from './metrics.repository.js';

export async function getMetrics(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const filters: MetricsFilters = {
    ...(typeof q.channel === 'string' ? { channel: q.channel as Channel } : {}),
    ...(typeof q.event_type === 'string' ? { eventType: q.event_type } : {}),
    ...(typeof q.from === 'string' ? { from: q.from } : {}),
    ...(typeof q.to === 'string' ? { to: q.to } : {}),
  };
  const metrics = await metricsRepository.compute(requireWorkspaceId(), filters);
  ResponseUtil.ok(res, metrics);
}
