import type { CreateProviderInput, Provider, UpdateProviderInput } from '@communique/core';
import { EP } from '@communique/core';
import { apiClient } from '@shared/services/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


export const providersKey = () => ['providers'] as const;

export function useProviders() {
  return useQuery({
    queryKey: providersKey(),
    queryFn: () => apiClient.get<Provider[]>(EP.PROVIDERS),
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProviderInput) => apiClient.post<Provider>(EP.PROVIDERS, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: providersKey() }),
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProviderInput }) =>
      apiClient.patch<Provider>(EP.PROVIDER(id), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: providersKey() }),
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(EP.PROVIDER(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: providersKey() }),
  });
}
