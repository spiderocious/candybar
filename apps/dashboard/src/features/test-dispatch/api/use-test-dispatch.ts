import type { TestDispatchInput, TestDispatchResult } from '@communique/core';
import { EP } from '@communique/core';
import { apiClient } from '@shared/services/api-client';
import { useMutation } from '@tanstack/react-query';


export function useTestDispatch() {
  return useMutation({
    mutationFn: (input: TestDispatchInput) =>
      apiClient.post<TestDispatchResult>(EP.TEST_DISPATCH, input),
  });
}
