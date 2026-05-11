"use client";
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, signOut, onAuthStateChanged, type Auth, type User as FirebaseUser } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Surface a clear diagnostic if Firebase env vars weren't injected at build
// time (commonly: forgot to set them on Vercel). The Firebase SDK will still
// throw, but a console error pointing at the real cause helps oncall a lot
// more than the SDK's generic "Invalid API key" message.
const REQUIRED_FIREBASE_KEYS = ["apiKey", "authDomain", "projectId", "appId"] as const;
if (typeof window !== "undefined") {
  const missing = REQUIRED_FIREBASE_KEYS.filter((k) => !firebaseConfig[k]);
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(
      `[firebase] Missing required env vars: ${missing
        .map((k) => `NEXT_PUBLIC_FIREBASE_${k.replace(/[A-Z]/g, (c) => "_" + c).toUpperCase()}`)
        .join(", ")}. ` +
        "Set them in your hosting provider's env config and redeploy.",
    );
  }
}

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth: Auth = getAuth(firebaseApp);

/**
 * Resolves to the current Firebase user once auth state has hydrated.
 *
 * `firebaseAuth.currentUser` is synchronously null on every fresh page load
 * until Firebase rehydrates the session from IndexedDB (one event-loop tick).
 * Callers that fire during that window (e.g. a profile fetch in a page's
 * useEffect) used to send a request with no Authorization header and got a
 * 403 from the backend even though the user was signed in. We now wait for
 * the first onAuthStateChanged emission — that IS the hydrated state, even
 * when it's null (genuinely signed-out).
 */
let _authReadyPromise: Promise<FirebaseUser | null> | null = null;
function _whenAuthReady(): Promise<FirebaseUser | null> {
  if (firebaseAuth.currentUser) return Promise.resolve(firebaseAuth.currentUser);
  if (_authReadyPromise) return _authReadyPromise;
  _authReadyPromise = new Promise<FirebaseUser | null>((resolve) => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      unsub();
      resolve(user);
    });
    // Belt-and-braces timeout so a broken Firebase init can't hang every
    // request forever. 4s is well past any healthy hydration time.
    setTimeout(() => resolve(firebaseAuth.currentUser), 4000);
  });
  return _authReadyPromise;
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser ?? await _whenAuthReady();
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
