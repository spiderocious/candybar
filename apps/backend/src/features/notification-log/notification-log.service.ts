import type { DispatchAttempt } from '@communique/core';

import type { CursorPage, CursorPayload } from '../../lib/cursor.js';
import { ok, type ServiceResult } from '../../lib/service-result.js';

import { notificationLogRepository, type LogFilters } from './notification-log.repository.js';

export const notificationLogService = {
  async list(
    workspaceId: string,
    filters: LogFilters,
  ): Promise<ServiceResult<CursorPage<DispatchAttempt>>> {
    return ok(await notificationLogRepository.list(workspaceId, filters));
  },

  async listForSubscriber(
    workspaceId: string,
    subscriberId: string,
    opts: { limit: number; cursor?: CursorPayload },
  ): Promise<ServiceResult<CursorPage<DispatchAttempt>>> {
    return ok(
      await notificationLogRepository.list(workspaceId, {
        ...opts,
        subscriberId,
      }),
    );
  },
};
