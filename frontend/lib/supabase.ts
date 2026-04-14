/**
 * STUB — Supabase was removed at launch. Pages still importing this need to be
 * rewired to Firebase: app/auth/login/page.tsx, app/(app)/layout.tsx,
 * app/(app)/profile/me/page.tsx. The stub keeps the build green; calls fail
 * gracefully at runtime.
 */
type Result<T = unknown> = Promise<{ data: T | null; error: { message: string } | null }>;

const notImpl = (): Result => Promise.resolve({ data: null, error: { message: "Auth migrated to Firebase — please use phone sign-in at /onboarding" } });

export const supabase = {
  auth: {
    signInWithPassword: (_: { email: string; password: string }) => notImpl(),
    signUp: (_: { email: string; password: string; options?: unknown }) => notImpl(),
    signOut: () => Promise.resolve({ error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: (_: unknown) => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: (_table: string) => ({
    select: (_cols?: string) => ({
      eq: (_c: string, _v: unknown) => ({
        single: () => notImpl(),
        maybeSingle: () => notImpl(),
      }),
      single: () => notImpl(),
    }),
    insert: (_row: unknown) => ({ select: () => ({ single: () => notImpl() }) }),
    update: (_row: unknown) => ({ eq: (_c: string, _v: unknown) => notImpl() }),
    upsert: (_row: unknown) => notImpl(),
    delete: () => ({ eq: (_c: string, _v: unknown) => notImpl() }),
  }),
  storage: {
    from: (_bucket: string) => ({
      list: (_prefix?: string) => Promise.resolve({ data: [] as { name: string; id?: string }[], error: null }),
      upload: (_path: string, _file: unknown, _opts?: unknown) => notImpl(),
      remove: (_paths: string[]) => notImpl(),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: "" } }),
      createSignedUrl: (_path: string, _expiresIn: number) => Promise.resolve({ data: { signedUrl: "" }, error: null }),
    }),
  },
};
