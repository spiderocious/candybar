import type { DispatchAttempt } from '@communique/core';
import { EP } from '@communique/core';
import { apiClient } from '@shared/services/api-client';
import { useQuery } from '@tanstack/react-query';


export interface LogFilters {
  channel?: string;
  status?: string;
  event_type?: string;
}

export const notificationLogKey = (f: LogFilters) => ['notification-log', f] as const;

export function useNotificationLog(filters: LogFilters) {
  const params = new URLSearchParams();
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.status) params.set('status', filters.status);
  if (filters.event_type) params.set('event_type', filters.event_type);
  const qs = params.toString();

  return useQuery({
    queryKey: notificationLogKey(filters),
    queryFn: () =>
      apiClient.list<DispatchAttempt>(`${EP.NOTIFICATION_LOG}${qs ? `?${qs}` : ''}`),
  });
}
