import type { Metrics } from '@communique/core';
import { EP } from '@communique/core';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/services/api-client';

export const metricsQueryKey = () => ['metrics'] as const;

export function useMetrics() {
  return useQuery({
    queryKey: metricsQueryKey(),
    queryFn: () => apiClient.get<Metrics>(EP.METRICS),
    refetchInterval: 10_000,
  });
}
