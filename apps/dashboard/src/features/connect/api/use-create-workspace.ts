import type { CreateWorkspaceInput, WorkspaceWithCredential } from '@communique/core';
import { EP } from '@communique/core';
import { useMutation } from '@tanstack/react-query';

import { apiClient } from '@shared/services/api-client';

export function useCreateWorkspace() {
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) =>
      apiClient.post<WorkspaceWithCredential>(EP.WORKSPACES, input),
  });
}
