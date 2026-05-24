import type { DeadLetter, ReplayResult } from '@communique/core';
import { EP } from '@communique/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@shared/services/api-client';

export const deadLettersKey = () => ['dead-letters'] as const;

export function useDeadLetters() {
  return useQuery({
    queryKey: deadLettersKey(),
    queryFn: () => apiClient.list<DeadLetter>(EP.DEAD_LETTERS),
  });
}

export function useReplayDeadLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<ReplayResult>(EP.DEAD_LETTER_REPLAY(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: deadLettersKey() }),
  });
}
