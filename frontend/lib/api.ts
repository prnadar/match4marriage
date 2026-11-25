"use client";
import { clearClientState, getIdToken } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";
// Defensive: only accept known-good tenant slugs. An env var
// misconfigured to anything else (e.g. "Year") would otherwise
// cause the backend to crash trying to cast it to UUID.
const RAW_TENANT = (process.env.NEXT_PUBLIC_TENANT_ID || "").toLowerCase();
const ALLOWED_TENANTS = new Set(["match4marriage"]);
const TENANT = ALLOWED_TENANTS.has(RAW_TENANT) ? RAW_TENANT : "match4marriage";

// Surface a useful diagnostic if the API URL was never configured. Loud once
// per session, in dev only — production deploys should have this set in
// Vercel env vars.
if (typeof window !== "undefined" && !BASE && process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn(
    "[m4m/api] NEXT_PUBLIC_API_URL is not set. All API calls will fail. " +
    "Set it in .env.local for local dev, or in your Vercel project env vars."
  );
}

export type ApiResponse<T = any> = { data: T; status: number };

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Fetch with a single transparent retry on cold-start network failures.
 *
 * Vercel's Python lambdas take 5-15s on a cold boot (import FastAPI +
 * SQLAlchemy + Firebase Admin + open the Neon pool). The browser's first
 * request after the deploy has been idle often dies with Safari's "Load
 * failed" TypeError or Chrome's "Failed to fetch" before the lambda
 * finishes booting. A single retry after a short backoff is enough to
 * land the next request on the now-warm lambda.
 *
 * We only retry idempotent calls (default GET, or callers who opt in via
 * `init.method`). POST/PUT/PATCH/DELETE go through once so we don't
 * accidentally double-write.
 */
async function _fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const safeToRetry = method === "GET" || method === "HEAD" || method === "OPTIONS";
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (!safeToRetry || attempt === retries) break;
      // Backoff: 600ms → 1.4s. Just long enough for a Vercel cold boot to
      // finish; short enough that the user doesn't notice.
      await new Promise((r) => setTimeout(r, 600 + attempt * 800));
    }
  }
  throw lastErr;
}

async function request<T = any>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = await getIdToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-ID": TENANT,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await _fetchWithRetry(`${BASE}${path}`, { ...init, headers });
  } catch (err: any) {
    // Translate the browser's generic "Failed to fetch" / "Load failed" into
    // something the user (and oncall) can act on. The most common causes:
    //   1. NEXT_PUBLIC_API_URL is empty → the request goes to `/api/...`
    //      relative, which Vercel can't serve.
    //   2. The serverless lambda is cold-starting and the browser gave up
    //      before it finished booting (retry already attempted above for
    //      idempotent calls).
    //   3. The configured URL is HTTP while the page is HTTPS (mixed
    //      content), or DNS / connectivity is genuinely broken.
    if (!BASE) {
      throw new ApiError(
        0,
        "API URL is not configured. Set NEXT_PUBLIC_API_URL on the host (Vercel) and redeploy.",
      );
    }
    throw new ApiError(
      0,
      "Couldn't reach the server. Please check your connection and try again — the API may be warming up.",
    );
  }

  if (res.status === 401) {
    // Token rejected. Force a refresh and retry once.
    const fresh = await getIdToken(true);
    if (fresh && fresh !== token) {
      headers.Authorization = `Bearer ${fresh}`;
      res = await fetch(`${BASE}${path}`, { ...init, headers });
    }
    if (res.status === 401) {
      // Still bad — session is dead.
      clearClientState();
      if (typeof window !== "undefined" && !location.pathname.startsWith("/auth/")) {
        location.href = "/auth/login";
      }
      throw new ApiError(401, "Session expired. Please sign in again.");
    }
  }

  if (!res.ok) {
    let detail: unknown = res.statusText;
    let message: string = res.statusText;
    try {
      const body = await res.json();
      const d = body.detail ?? body.error;
      detail = d;
      if (Array.isArray(d)) {
        message = d
          .map((e: any) => {
            const loc = Array.isArray(e?.loc) ? e.loc.filter((x: any) => x !== "body").join(".") : "";
            return loc ? `${loc}: ${e.msg || e.type || "invalid"}` : (e.msg || e.type || JSON.stringify(e));
          })
          .join("; ");
      } else if (typeof d === "string") {
        message = d;
      } else if (d && typeof d === "object") {
        message = (d as any).message || JSON.stringify(d);
      }
    } catch {}
    throw new ApiError(res.status, `${res.status}: ${message}`, detail);
  }
  if (res.status === 204) return { data: undefined as T, status: 204 };
  const data = (await res.json()) as T;
  return { data, status: res.status };
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Authenticated CSV download. Streams to a Blob and triggers a save dialog.
 * Bypasses the JSON `request` helper because the response body is text/csv.
 */
export async function downloadCsv(path: string, filename: string): Promise<void> {
  const token = await getIdToken();
  const headers: Record<string, string> = { "X-Tenant-ID": TENANT };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status}: ${res.statusText}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const profileApi = {
  me: () => api.get("/api/v1/profile/me"),
  /** Fetch any profile by user UUID. Backend: GET /profile/{user_id}. */
  getById: (userId: string) => api.get(`/api/v1/profile/${userId}`),
  /** @deprecated alias retained for older call sites — prefer me() or getById(). */
  getProfile: (userId?: string) =>
    userId ? api.get(`/api/v1/profile/${userId}`) : api.get("/api/v1/profile/me"),
  update: (data: unknown, ifMatchVersion?: number) =>
    api.patch(
      "/api/v1/profile/me",
      data,
      ifMatchVersion !== undefined
        ? { headers: { "If-Match": String(ifMatchVersion) } }
        : undefined,
    ),
  updateProfile: (...args: unknown[]) => {
    const data = args.length === 2 ? args[1] : args[0];
    return api.patch("/api/v1/profile/me", data);
  },
  submitForReview: () => api.post("/api/v1/profile/me/submit", {}),
  /** Backend: GET /profile/me/completion → { score, sections: {...}, missing: [...] } */
  getCompletion: () => api.get("/api/v1/profile/me/completion"),
  // Photo upload happens via direct calls to `api.post` in PhotoGrid:
  //   POST /profile/photos/upload-url?content_type=...   (no body)
  //   POST /profile/me/photos { url, key }
  // We deliberately don't expose helpers for those — the misalignment between
  // the helper signatures and the real endpoints had already produced two
  // contract-mismatch bugs (helper used `{filename, content_type}` body vs
  // a query param; another sent `{key}` to an endpoint expecting `{url,key}`).
  removePhoto: (key: string) =>
    api.delete(`/api/v1/profile/me/photos?key=${encodeURIComponent(key)}`),
  reorderPhotos: (keys: string[]) =>
    api.put("/api/v1/profile/me/photos/reorder", { keys }),
  setPrimaryPhoto: (key: string) =>
    api.post("/api/v1/profile/me/photos/primary", { key }),
  // Mark / unmark a photo as Premium (visible only to Premium+ members).
  setPhotoPremium: (key: string, isPremium: boolean) =>
    api.post("/api/v1/profile/me/photos/premium", { key, is_premium: isPremium }),
};

/* ── Chat / Messaging ─────────────────────────────────────────────────
 * Backend exposes:
 *   GET   /chats                          — list threads for the current user
 *   GET   /chats/{thread_id}/messages     — paginated history
 *   WS    /ws/chat/{thread_id}?token=...  — real-time send/receive
 *
 * NOTE: There is no REST POST endpoint for sending messages. Sending happens
 * over the WebSocket (see openChatSocket below). If WS is unavailable, the
 * UI should fall back gracefully.
 */
export const chatApi = {
  listThreads: (page = 1, limit = 20) =>
    api.get(`/api/v1/chats?page=${page}&limit=${limit}`),
  getMessages: (threadId: string, page = 1, limit = 50) =>
    api.get(`/api/v1/chats/${threadId}/messages?page=${page}&limit=${limit}`),
};

/* ── Public pricing ───────────────────────────────────────────────── */
export const pricingApi = {
  /** Backend: GET /pricing-plans (public, active plans only). */
  listPlans: () => api.get("/api/v1/pricing-plans"),
};

/* ── Account self-service (Settings, forgot password) ─────────────────
 * Backend: routers/auth.py. Sensitive calls (changeEmail, requestPhoneChange,
 * deactivate, deleteAccount) need a fresh sign-in — call
 * reauthenticateWithPassword() from lib/firebase first; otherwise the API
 * answers 403 with detail.code === "reauth_required".
 */
export type NotificationPrefs = {
  email_interests: boolean;
  email_messages: boolean;
  email_matches: boolean;
  email_marketing: boolean;
};

export const accountApi = {
  /** Public. Always answers generically (never reveals if the email exists). */
  forgotPassword: (email: string) => api.post("/api/v1/auth/forgot-password", { email }),
  me: () => api.get("/api/v1/auth/me"),
  updateName: (data: { first_name?: string; last_name?: string }) => api.patch("/api/v1/auth/me", data),
  getSettings: () => api.get("/api/v1/auth/me/settings"),
  updateNotifications: (notifications: Partial<NotificationPrefs>) =>
    api.patch("/api/v1/auth/me/settings", { notifications }),
  changeEmail: (new_email: string) => api.post("/api/v1/auth/change-email", { new_email }),
  confirmEmailChange: (code: string) => api.post("/api/v1/auth/change-email/confirm", { code }),
  requestPhoneChange: (phone: string) => api.post("/api/v1/auth/change-phone/request", { phone }),
  confirmPhoneChange: () => api.post("/api/v1/auth/change-phone/confirm", {}),
  passwordChanged: () => api.post("/api/v1/auth/password-changed", {}),
  signOutEverywhere: () => api.post("/api/v1/auth/sign-out-everywhere", {}),
  exportData: () => api.get("/api/v1/auth/me/export"),
  deactivate: (reason?: string) => api.post("/api/v1/auth/deactivate", { reason: reason || null }),
  reactivate: () => api.post("/api/v1/auth/reactivate", {}),
  deleteAccount: (reason?: string) =>
    api.post("/api/v1/auth/delete-account", { confirm: "DELETE", reason: reason || null }),
};

/** Human-readable message from an ApiError (strips the "403: " status prefix). */
export function apiErrorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const err = e as { detail?: unknown; message?: string } | null;
  const d = err?.detail as any;
  if (typeof d === "string" && d) return d;
  if (d && typeof d === "object" && typeof d.message === "string") return d.message;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error,\s*/i, "");
  const m = err?.message || "";
  return m ? m.replace(/^\d{3}:\s*/, "") : fallback;
}

/** True when the API rejected a sensitive call because the sign-in is stale. */
export function isReauthRequired(e: unknown): boolean {
  const err = e as { status?: number; detail?: any } | null;
  return err?.status === 403 && err?.detail?.code === "reauth_required";
}

/* ── Success stories (public + admin) ─────────────────────────────── */
export const successStoriesApi = {
  /** Backend: GET /public/success-stories (no auth). */
  listPublic: (limit = 24) =>
    api.get(`/api/v1/public/success-stories?limit=${limit}`),

  /* Admin operations — listed here so the admin UI can use them too. */
  listAdmin:      () => api.get("/api/v1/admin/success-stories"),
  create:         (body: Record<string, unknown>) => api.post("/api/v1/admin/success-stories", body),
  update:         (id: string, body: Record<string, unknown>) => api.put(`/api/v1/admin/success-stories/${id}`, body),
  togglePublish:  (id: string) => api.post(`/api/v1/admin/success-stories/${id}/publish`),
  delete:         (id: string) => api.delete(`/api/v1/admin/success-stories/${id}`),
};

/** Open a WebSocket connection to a chat thread. Returns the WebSocket. */
export async function openChatSocket(threadId: string): Promise<WebSocket> {
  const token = await getIdToken();
  if (!token) throw new ApiError(401, "Not signed in");
  // Convert http(s) → ws(s) for the same host as BASE. The chat router is
  // mounted under the same `/api/v1` prefix as the REST API, so the WS path
  // includes it too (backend: app.include_router(chat.router, prefix="/api/v1")
  // and chat.router defines @router.websocket("/ws/chat/{thread_id}")).
  const wsBase = BASE.replace(/^http/, "ws");
  const url = `${wsBase}/api/v1/ws/chat/${threadId}?token=${encodeURIComponent(token)}`;
  return new WebSocket(url);
}

/* ── Notifications ────────────────────────────────────────────────────
 * Backend mounts this router at /api/v1/notifications.
 *   GET    /notifications              — paginated list
 *   POST   /notifications/read-all     — mark all read
 *   POST   /notifications/read/{id}    — mark single notification read
 *   DELETE /notifications/{id}         — delete a notification
 */
export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    api.get(`/api/v1/notifications?page=${page}&limit=${limit}`),
  markRead: (id: string) => api.post(`/api/v1/notifications/read/${id}`),
  markAllRead: () => api.post(`/api/v1/notifications/read-all`),
  delete: (id: string) => api.delete(`/api/v1/notifications/${id}`),
};

export const adminApi = {
  // Users
  listUsers: (params: { q?: string; status_filter?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status_filter) qs.set("status_filter", params.status_filter);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const s = qs.toString();
    return api.get(`/api/v1/admin/users${s ? "?" + s : ""}`);
  },
  getUser: (userId: string) => api.get(`/api/v1/admin/users/${userId}`),
  suspendUser: (userId: string) => api.post(`/api/v1/admin/users/${userId}/suspend`),
  activateUser: (userId: string) => api.post(`/api/v1/admin/users/${userId}/activate`),
  softDeleteUser: (userId: string) => api.post(`/api/v1/admin/users/${userId}/soft-delete`),
  restoreUser: (userId: string) => api.post(`/api/v1/admin/users/${userId}/restore`),

  // Dashboard
  getStats: () => api.get("/api/v1/admin/stats"),

  // Admins
  listAdmins: () => api.get("/api/v1/admin/admins"),
  grantAdmin: (email: string, opts: { create?: boolean; password?: string } = {}) =>
    api.post("/api/v1/admin/admins", { email, ...opts }),
  revokeAdmin: (uid: string) => api.delete(`/api/v1/admin/admins/${uid}`),

  // Reports
  listReports: (params: { status_filter?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status_filter) qs.set("status_filter", params.status_filter);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const s = qs.toString();
    return api.get(`/api/v1/admin/reports${s ? "?" + s : ""}`);
  },
  resolveReport: (reportId: string, body: { status: string; admin_notes?: string; action_taken?: string }) =>
    api.put(`/api/v1/admin/reports/${reportId}`, body),

  // Payments + Subscriptions
  listPayments: (params: { q?: string; gateway?: string; direction?: "credit" | "debit"; days?: number; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.gateway) qs.set("gateway", params.gateway);
    if (params.direction) qs.set("direction", params.direction);
    if (params.days) qs.set("days", String(params.days));
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const s = qs.toString();
    return api.get(`/api/v1/admin/payments${s ? "?" + s : ""}`);
  },
  getPaymentsSummary: () => api.get("/api/v1/admin/payments/summary"),
  listSubscriptions: (params: { q?: string; status_filter?: string; plan?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status_filter) qs.set("status_filter", params.status_filter);
    if (params.plan) qs.set("plan", params.plan);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const s = qs.toString();
    return api.get(`/api/v1/admin/subscriptions${s ? "?" + s : ""}`);
  },
  listExpiringSubscriptions: (days = 14) =>
    api.get(`/api/v1/admin/subscriptions/expiring?days=${days}`),

  // Pricing plans
  listPricingPlans: () => api.get("/api/v1/admin/pricing-plans"),
  createPricingPlan: (body: {
    key: string; name: string; tier: "silver" | "gold" | "platinum";
    price_paise: number; original_price_paise?: number | null; currency?: string;
    period: "monthly" | "quarterly" | "half_yearly" | "yearly";
    features?: string[]; is_active?: boolean; sort_order?: number;
  }) => api.post("/api/v1/admin/pricing-plans", body),
  updatePricingPlan: (planId: string, body: Partial<{
    key: string; name: string; tier: "silver" | "gold" | "platinum";
    price_paise: number; original_price_paise: number | null; currency: string;
    period: "monthly" | "quarterly" | "half_yearly" | "yearly";
    features: string[]; is_active: boolean; sort_order: number;
  }>) => api.put(`/api/v1/admin/pricing-plans/${planId}`, body),
  deletePricingPlan: (planId: string) =>
    api.delete(`/api/v1/admin/pricing-plans/${planId}`),
  reorderPricingPlans: (order: Array<{ id: string; sort_order: number }>) =>
    api.post("/api/v1/admin/pricing-plans/reorder", { order }),

  // Enquiries
  listEnquiries: (params: { q?: string; status_filter?: string; source?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status_filter) qs.set("status_filter", params.status_filter);
    if (params.source) qs.set("source", params.source);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const s = qs.toString();
    return api.get(`/api/v1/admin/enquiries${s ? "?" + s : ""}`);
  },
  enquiryCounts: () => api.get("/api/v1/admin/enquiries/counts"),
  updateEnquiry: (id: string, body: Partial<{ status: string; admin_notes: string | null; assign_to_me: boolean; assigned_admin_id: string | null }>) =>
    api.put(`/api/v1/admin/enquiries/${id}`, body),
  deleteEnquiry: (id: string) => api.delete(`/api/v1/admin/enquiries/${id}`),

  // Site settings
  getSiteSettings: () => api.get("/api/v1/admin/settings/site"),
  updateSiteSettings: (body: Partial<{
    site_name: string; tagline: string | null;
    support_email: string | null; support_phone: string | null;
    timezone: string; default_currency: string; default_locale: string;
    extras: Record<string, unknown>;
  }>) => api.put("/api/v1/admin/settings/site", body),

  // Mail templates
  listMailTemplates: () => api.get("/api/v1/admin/mail-templates"),
  upsertMailTemplate: (key: string, body: { name: string; subject: string; body_html: string; body_text?: string | null; is_active?: boolean }) =>
    api.put(`/api/v1/admin/mail-templates/${key}`, body),
  deleteMailTemplate: (key: string) =>
    api.delete(`/api/v1/admin/mail-templates/${key}`),

  // SEO
  listSeoSettings: () => api.get("/api/v1/admin/seo"),
  upsertSeoSetting: (body: { path: string; title: string; description?: string | null; og_image_url?: string | null; robots?: string }) =>
    api.put("/api/v1/admin/seo", body),
  deleteSeoSetting: (path: string) =>
    api.delete(`/api/v1/admin/seo?path=${encodeURIComponent(path)}`),

  // Appearance
  getAppearance: () => api.get("/api/v1/admin/settings/appearance"),
  updateAppearance: (body: Partial<{ logo_url: string | null; favicon_url: string | null; brand_primary: string | null; brand_accent: string | null }>) =>
    api.put("/api/v1/admin/settings/appearance", body),

  // Bulk actions + CSV exports
  bulkUserAction: (action: "suspend" | "activate", user_ids: string[]) =>
    api.post("/api/v1/admin/users/bulk", { action, user_ids }),
  exportUsersCsvUrl: (params: { q?: string; status_filter?: string } = {}) => {
    const qs = new URLSearchParams({ format: "csv" });
    if (params.q) qs.set("q", params.q);
    if (params.status_filter) qs.set("status_filter", params.status_filter);
    return `/api/v1/admin/users?${qs.toString()}`;
  },
  exportPaymentsCsvUrl: (params: { q?: string; gateway?: string; direction?: "credit" | "debit"; days?: number } = {}) => {
    const qs = new URLSearchParams({ format: "csv" });
    if (params.q) qs.set("q", params.q);
    if (params.gateway) qs.set("gateway", params.gateway);
    if (params.direction) qs.set("direction", params.direction);
    if (params.days) qs.set("days", String(params.days));
    return `/api/v1/admin/payments?${qs.toString()}`;
  },
  exportEnquiriesCsvUrl: (params: { q?: string; status_filter?: string; source?: string } = {}) => {
    const qs = new URLSearchParams({ format: "csv" });
    if (params.q) qs.set("q", params.q);
    if (params.status_filter) qs.set("status_filter", params.status_filter);
    if (params.source) qs.set("source", params.source);
    return `/api/v1/admin/enquiries?${qs.toString()}`;
  },

  // Payment gateways
  listPaymentGateways: () => api.get("/api/v1/admin/payment-gateways"),
  upsertPaymentGateway: (gateway: "razorpay" | "stripe" | "upi" | "paypal", body: Partial<{
    publishable_key: string | null;
    secret_key: string | null;
    webhook_secret: string | null;
    is_test_mode: boolean;
    is_active: boolean;
  }>) => api.put(`/api/v1/admin/payment-gateways/${gateway}`, body),
  deletePaymentGateway: (gateway: "razorpay" | "stripe" | "upi" | "paypal") =>
    api.delete(`/api/v1/admin/payment-gateways/${gateway}`),

  // Verifications (alias of existing profile admin endpoints)
  listVerifications: (status_filter: "submitted" | "approved" | "rejected" | "all") =>
    api.get(`/api/v1/profile/admin/verifications?status_filter=${status_filter}`),
  approveVerification: (userId: string) =>
    api.post(`/api/v1/profile/admin/verifications/${userId}/approve`, {}),
  requestInfo: (userId: string, note: string) =>
    api.post(`/api/v1/profile/admin/verifications/${userId}/request-info`, { note }),
  rejectVerification: (userId: string, reason: string) =>
    api.post(`/api/v1/profile/admin/verifications/${userId}/reject`, { reason }),

  // Self
  me: () => api.get("/api/v1/auth/me"),
};

/**
 * Admin console ops (backend/app/routers/admin_ops.py): global search, sidebar
 * badge counts, audit log, verification review, matchmaking.
 */
function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    s.set(k, String(v));
  }
  const out = s.toString();
  return out ? `?${out}` : "";
}

export type AuditLogParams = {
  action?: string; actor?: string; target_id?: string; q?: string; days?: number; page?: number; limit?: number;
};

export const adminOpsApi = {
  search: (q: string, limit = 8) => api.get(`/api/v1/admin/search${qs({ q, limit })}`),
  navCounts: () => api.get("/api/v1/admin/nav-counts"),

  auditLog: (params: AuditLogParams = {}) => api.get(`/api/v1/admin/audit-log${qs(params)}`),
  auditLogFacets: () => api.get("/api/v1/admin/audit-log/facets"),
  exportAuditLogCsvUrl: (params: AuditLogParams = {}) =>
    `/api/v1/admin/audit-log${qs({ ...params, page: undefined, limit: undefined, format: "csv" })}`,

  verificationReview: (userId: string) => api.get(`/api/v1/admin/verification-review/${userId}`),
  bulkApproveVerifications: (user_ids: string[]) =>
    api.post("/api/v1/admin/verifications/bulk-approve", { user_ids }),

  matchSuggestions: (userId: string, opts: { limit?: number; include_introduced?: boolean } = {}) =>
    api.get(`/api/v1/admin/matchmaking/suggestions/${userId}${qs(opts)}`),
  matchCompare: (a: string, b: string) => api.get(`/api/v1/admin/matchmaking/compare${qs({ a, b })}`),
  introduce: (user_a: string, user_b: string, note?: string) =>
    api.post("/api/v1/admin/matchmaking/introduce", { user_a, user_b, note: note || undefined }),
  introductions: (limit = 30) => api.get(`/api/v1/admin/matchmaking/introductions${qs({ limit })}`),
};

/**
 * Backend route layout — verified against app/routers/matches.py + profile.py:
 *   GET  /api/v1/matches/daily                 (matches router)
 *   GET  /api/v1/profile/browse                (profile router — NOT matches)
 *   GET  /api/v1/interests/received            (mounted under "" not /matches)
 *   GET  /api/v1/interests/sent                (idem)
 *   POST /api/v1/interests/{receiver_id}       (idem)
 *
 * No backend route exists for /matches (list), /matches/feed, or
 * /matches/{id}/accept|decline — those used to be planned but were never
 * shipped. Calling them was returning 404. They've been removed below.
 */
export const matchApi = {
  /** Browse / discover profiles — backend mounts this on the profile router. */
  browseProfiles: (params?: Record<string, string | number>) => {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return api.get(`/api/v1/profile/browse${qs}`);
  },
  getDailyMatches:      () => api.get("/api/v1/matches/daily"),
  getReceivedInterests: () => api.get("/api/v1/interests/received"),
  getSentInterests:     () => api.get("/api/v1/interests/sent"),
  sendInterest: (toUserId: string) => api.post(`/api/v1/interests/${toUserId}`),
};

// ─── Admin CRM (client contact, messaging, notes/tags) ───────────────────────
// Backend: app/routers/admin_crm.py (+ CRM filters on GET /admin/users).

export type CrmChannel = "email" | "in_app" | "call" | "whatsapp" | "sms" | "meeting" | "other";
export type CrmStatus = "sent" | "failed" | "skipped" | "logged";

export type CrmAudience =
  | { type: "users"; user_ids: string[] }
  | { type: "segment"; segment: string; value?: string };

export interface CrmMessage {
  channels: Array<"email" | "in_app">;
  subject: string;
  body: string;
  body_format?: "text" | "html";
  template_key?: string | null;
  reply_to?: string | null;
  action_url?: string | null;
  /** Promotional email — only delivered to members opted in to "News & offers". */
  is_marketing?: boolean;
}

export interface CrmUserListParams {
  q?: string;
  status_filter?: string;
  tag?: string;
  follow_up?: "due" | "upcoming" | "any";
  plan?: string;
  page?: number;
  limit?: number;
}

function _crmQs(params: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const adminCrmApi = {
  // Users list with CRM filters (tag / follow-up / plan) + contact columns.
  listUsers: (params: CrmUserListParams = {}) =>
    api.get(`/api/v1/admin/users${_crmQs({ ...params })}`),
  exportUsersCsvUrl: (params: Omit<CrmUserListParams, "page" | "limit"> = {}) =>
    `/api/v1/admin/users${_crmQs({ format: "csv", ...params })}`,

  // Per member
  getMember: (userId: string) => api.get(`/api/v1/admin/crm/users/${userId}`),
  updateMember: (userId: string, body: { tags?: string[]; follow_up_at?: string | null; follow_up_note?: string | null }) =>
    api.put(`/api/v1/admin/crm/users/${userId}/crm`, body),
  sendToMember: (userId: string, body: CrmMessage) =>
    api.post(`/api/v1/admin/crm/users/${userId}/send`, body),
  logContact: (userId: string, body: { channel: Exclude<CrmChannel, "in_app">; subject?: string; body?: string; outcome?: string }) =>
    api.post(`/api/v1/admin/crm/users/${userId}/log`, body),
  addNote: (userId: string, body: { body: string; pinned?: boolean }) =>
    api.post(`/api/v1/admin/crm/users/${userId}/notes`, body),
  updateNote: (userId: string, noteId: string, body: { body?: string; pinned?: boolean }) =>
    api.patch(`/api/v1/admin/crm/users/${userId}/notes/${noteId}`, body),
  deleteNote: (userId: string, noteId: string) =>
    api.delete(`/api/v1/admin/crm/users/${userId}/notes/${noteId}`),

  // Bulk / broadcast
  previewAudience: (audience: CrmAudience) =>
    api.post(`/api/v1/admin/crm/audience/preview`, { audience }),
  sendBroadcast: (body: CrmMessage & { audience: CrmAudience; expected_count?: number }) =>
    api.post(`/api/v1/admin/crm/broadcasts`, body),
  listBroadcasts: (params: { page?: number; limit?: number } = {}) =>
    api.get(`/api/v1/admin/crm/broadcasts${_crmQs(params)}`),

  // Console
  listCommunications: (params: { channel?: string; status?: string; q?: string; user_id?: string; broadcast_id?: string; days?: number; page?: number; limit?: number } = {}) =>
    api.get(`/api/v1/admin/crm/communications${_crmQs(params)}`),
  stats: () => api.get(`/api/v1/admin/crm/stats`),
  followUps: (scope: "due" | "upcoming" | "all" = "all", limit = 50) =>
    api.get(`/api/v1/admin/crm/follow-ups${_crmQs({ scope, limit })}`),
  meta: () => api.get(`/api/v1/admin/crm/meta`),

  // Mail templates (managed in Settings → admin_cms.py) for "start from template".
  listTemplates: () => api.get(`/api/v1/admin/mail-templates`),
};
