import type {
  AddAudienceMemberInput,
  Audience,
  CreateAudienceInput,
} from '@communique/core';
import { EP } from '@communique/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@shared/services/api-client';

interface Member {
  subscriber_id: string;
  external_id: string;
  joined_at: string;
}

export const audiencesKey = () => ['audiences'] as const;
export const audienceMembersKey = (id: string) => ['audience', id, 'members'] as const;

export function useAudiences() {
  return useQuery({
    queryKey: audiencesKey(),
    queryFn: () => apiClient.list<Audience>(EP.AUDIENCES),
  });
}

export function useAudienceMembers(id: string) {
  return useQuery({
    queryKey: audienceMembersKey(id),
    queryFn: () => apiClient.list<Member>(EP.AUDIENCE_MEMBERS(id)),
  });
}

export function useCreateAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAudienceInput) => apiClient.post<Audience>(EP.AUDIENCES, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: audiencesKey() }),
  });
}

export function useAddMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddAudienceMemberInput) =>
      apiClient.post<Audience>(EP.AUDIENCE_MEMBERS(id), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: audienceMembersKey(id) }),
  });
}
