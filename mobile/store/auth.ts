import { create } from 'zustand';
import storage from '@/lib/storage';
import type { Profile, SubscriptionTier } from '@/types';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  profile: Profile | null;
  subscriptionTier: SubscriptionTier;
  isNewUser: boolean;

  setAuth: (token: string, userId: string, isNewUser: boolean) => Promise<void>;
  setProfile: (profile: Profile) => void;
  setSubscriptionTier: (tier: SubscriptionTier) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  profile: null,
  subscriptionTier: 'free',
  isNewUser: false,

  setAuth: async (token, userId, isNewUser) => {
    await storage.setItemAsync('access_token', token);
    await storage.setItemAsync('user_id', userId);
    set({ isAuthenticated: true, userId, isNewUser, isLoading: false });
  },

  setProfile: (profile) => set({ profile }),

  setSubscriptionTier: (tier) => set({ subscriptionTier: tier }),

  logout: async () => {
    await storage.deleteItemAsync('access_token');
    await storage.deleteItemAsync('user_id');
    set({
      isAuthenticated: false,
      userId: null,
      profile: null,
      subscriptionTier: 'free',
      isNewUser: false,
    });
  },

  checkAuth: async () => {
    const token = await storage.getItemAsync('access_token');
    const userId = await storage.getItemAsync('user_id');
    if (token && userId) {
      set({ isAuthenticated: true, userId, isLoading: false });
    } else {
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));
