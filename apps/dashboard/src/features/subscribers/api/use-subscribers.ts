import type {
  DispatchAttempt,
  RegisterSubscriberInput,
  SetOptOutInput,
  Subscriber,
  SubscriberWithChannels,
} from '@communique/core';
import { EP } from '@communique/core';
import { apiClient } from '@shared/services/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


export const subscribersKey = (search?: string) => ['subscribers', search ?? ''] as const;
export const subscriberKey = (id: string) => ['subscriber', id] as const;
export const subscriberHistoryKey = (id: string) => ['subscriber', id, 'history'] as const;

export function useSubscribers(search?: string) {
  return useQuery({
    queryKey: subscribersKey(search),
    queryFn: () =>
      apiClient.list<Subscriber>(
        `${EP.SUBSCRIBERS}${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
}

export function useSubscriber(id: string) {
  return useQuery({
    queryKey: subscriberKey(id),
    queryFn: () => apiClient.get<SubscriberWithChannels>(EP.SUBSCRIBER(id)),
  });
}

export function useSubscriberHistory(id: string) {
  return useQuery({
    queryKey: subscriberHistoryKey(id),
    queryFn: () => apiClient.list<DispatchAttempt>(EP.SUBSCRIBER_HISTORY(id)),
  });
}

export function useRegisterSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterSubscriberInput) =>
      apiClient.post<SubscriberWithChannels>(EP.SUBSCRIBERS, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscribers'] }),
  });
}

export function useDeleteSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(EP.SUBSCRIBER(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscribers'] }),
  });
}

export function useSetOptOut(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetOptOutInput) =>
      apiClient.post<SubscriberWithChannels>(EP.SUBSCRIBER_OPTOUTS(id), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: subscriberKey(id) }),
  });
}
