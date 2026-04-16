"use client";
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, signOut, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth: Auth = getAuth(firebaseApp);

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch (err: any) {
    // Refresh failed — surface as auth invalidation.
    // eslint-disable-next-line no-console
    console.warn("[firebase] getIdToken failed, signing out", err?.code || err);
    try { await signOut(firebaseAuth); } catch {}
    return null;
  }
}

/** Keys written by the app that must be purged when a user signs out or a different user signs in. */
const APP_STATE_KEYS = [
  "onboarding_completed",
  "onboarding_step",
  "user_name",
  "user_gender",
];

export function clearClientState() {
  if (typeof window === "undefined") return;
  try {
    for (const k of APP_STATE_KEYS) localStorage.removeItem(k);
    sessionStorage.removeItem("skip_password_prompt");
    sessionStorage.removeItem("m4m_session_uid");
  } catch {}
}

/**
 * Remember the currently signed-in Firebase UID so that we can detect when a
 * different user signs in on the same device and purge the previous user's
 * cached localStorage fragments.
 */
export function rememberSessionUid(uid: string) {
  if (typeof window === "undefined") return;
  const prev = sessionStorage.getItem("m4m_session_uid");
  if (prev && prev !== uid) {
    clearClientState();
  }
  sessionStorage.setItem("m4m_session_uid", uid);
}
