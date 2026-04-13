import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { matchApi, profileApi, chatApi, subscriptionApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export function useDailyMatches() {
  return useQuery({
    queryKey: ['dailyMatches'],
    queryFn: async () => {
      const res = await matchApi.getDailyMatches();
      return res.data.data;
    },
  });
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await profileApi.getProfile(userId);
      return res.data.data;
    },
    enabled: !!userId,
  });
}

export function useMyProfile() {
  const userId = useAuthStore((s) => s.userId);
  return useProfile(userId);
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (!userId) throw new Error('Not authenticated');
      return profileApi.updateProfile(userId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}

export function useReceivedInterests(page = 1) {
  return useQuery({
    queryKey: ['interests', 'received', page],
    queryFn: async () => {
      const res = await matchApi.getReceivedInterests(page);
      return res.data;
    },
  });
}

export function useSentInterests(page = 1) {
  return useQuery({
    queryKey: ['interests', 'sent', page],
    queryFn: async () => {
      try {
        const res = await matchApi.getSentInterests(page);
        return res.data;
      } catch {
        // Backend may not have /interests/sent yet — return empty list
        return { data: [], total: 0, page, limit: 20, has_next: false, success: true };
      }
    },
  });
}

export function useSendInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      receiverId,
      isSuperInterest,
      message,
    }: {
      receiverId: string;
      isSuperInterest?: boolean;
      message?: string;
    }) => matchApi.sendInterest(receiverId, isSuperInterest, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interests'] });
      queryClient.invalidateQueries({ queryKey: ['dailyMatches'] });
    },
  });
}

export function useChatThreads(page = 1) {
  return useQuery({
    queryKey: ['chatThreads', page],
    queryFn: async () => {
      const res = await chatApi.listThreads(page);
      return res.data;
    },
  });
}

export function useChatMessages(threadId: string, page = 1) {
  return useQuery({
    queryKey: ['chatMessages', threadId, page],
    queryFn: async () => {
      const res = await chatApi.getMessages(threadId, page);
      return res.data;
    },
    enabled: !!threadId,
  });
}

export function useSubscriptionLimits() {
  return useQuery({
    queryKey: ['subscriptionLimits'],
    queryFn: async () => {
      const res = await subscriptionApi.getLimits();
      return res.data.data;
    },
  });
}
