import type { CreateWorkspaceInput, WorkspaceWithCredential } from '@communique/core';
import { EP } from '@communique/core';
import { apiClient } from '@shared/services/api-client';
import { useMutation } from '@tanstack/react-query';


export function useCreateWorkspace() {
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) =>
      apiClient.post<WorkspaceWithCredential>(EP.WORKSPACES, input),
  });
}
