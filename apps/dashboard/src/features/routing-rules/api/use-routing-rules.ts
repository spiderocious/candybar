import type { CreateRoutingRuleInput, RoutingRule } from '@communique/core';
import { EP } from '@communique/core';
import { apiClient } from '@shared/services/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


export const routingRulesKey = () => ['routing-rules'] as const;

export function useRoutingRules() {
  return useQuery({
    queryKey: routingRulesKey(),
    queryFn: () => apiClient.get<RoutingRule[]>(EP.ROUTING_RULES),
  });
}

export function useCreateRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoutingRuleInput) =>
      apiClient.post<RoutingRule>(EP.ROUTING_RULES, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: routingRulesKey() }),
  });
}

export function useDeleteRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(EP.ROUTING_RULE(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: routingRulesKey() }),
  });
}
