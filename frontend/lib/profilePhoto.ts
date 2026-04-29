"use client";

import { useEffect, useState } from "react";
import { firebaseAuth } from "./firebase";
import { profileApi } from "./api";

// In-app event bus for the user's primary profile photo. The PhotoGrid
// dispatches on every change (upload, set-primary, reorder, delete) and the
// avatar surfaces — top header, sidebar, profile photo card — listen so they
// update instantly without a re-fetch.
const EVENT_NAME = "m4m:profile-photo-updated";

export function getPrimaryPhotoUrl(photos: unknown): string | null {
  if (!Array.isArray(photos)) return null;
  const primary = photos.find(
    (p): p is { url: string; is_primary?: boolean } =>
      !!p && typeof p.url === "string" && (p as { is_primary?: boolean }).is_primary === true
  );
  if (primary) return primary.url;
  // Fallback: first photo with a URL — matches the backend's "first is primary"
  // tie-breaker so the avatar still shows something even if no row has the
  // is_primary flag set yet.
  const first = photos.find(
    (p): p is { url: string } => !!p && typeof (p as { url?: string }).url === "string"
  );
  return first ? first.url : null;
}

export function notifyProfilePhotoUpdate(photos: unknown): void {
  if (typeof window === "undefined") return;
  const url = getPrimaryPhotoUrl(photos);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { url } }));
}

/**
 * Returns the current user's primary profile photo URL, or null when there is
 * no signed-in user / no photos yet. Self-fetches once on auth-in and listens
 * for in-app `m4m:profile-photo-updated` events so the avatar everywhere
 * stays in sync after a primary change.
 */
export function useProfilePhoto(): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) { if (!cancelled) setUrl(null); return; }
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data ?? res.data;
        if (!cancelled) setUrl(getPrimaryPhotoUrl(p?.photos));
      } catch {
        if (!cancelled) setUrl(null);
      }
    });

    const handler = (e: Event) => {
      if (cancelled) return;
      const detail = (e as CustomEvent<{ url: string | null }>).detail;
      setUrl(detail?.url ?? null);
    };
    window.addEventListener(EVENT_NAME, handler);

    return () => {
      cancelled = true;
      unsub();
      window.removeEventListener(EVENT_NAME, handler);
    };
  }, []);

  return url;
}
