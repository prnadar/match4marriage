"use client";
import { useEffect, useState } from "react";
import { firebaseAuth } from "./firebase";

export type AuthState = {
  isAuthenticated: boolean;
  hasOnboarded: boolean;
  hasVerifiedId: boolean;
  hasPhotos: boolean;
};

export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false, hasOnboarded: false, hasVerifiedId: false, hasPhotos: false,
  });
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged((user) => {
      const ls = (k: string) => typeof window !== "undefined" && localStorage.getItem(k) === "true";
      setState({
        isAuthenticated: !!user,
        hasOnboarded: ls("onboarding_completed"),
        hasVerifiedId: ls("id_verified"),
        hasPhotos: ls("has_photos"),
      });
    });
    return () => unsub();
  }, []);
  return state;
}

export function getCTA(state: AuthState): { label: string; href: string } {
  if (!state.isAuthenticated) return { label: "Get Started", href: "/onboarding" };
  if (!state.hasOnboarded) return { label: "Complete Profile", href: "/onboarding" };
  return { label: "Go to Dashboard", href: "/dashboard" };
}
