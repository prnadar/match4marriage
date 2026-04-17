"use client";
import { clearClientState, getIdToken } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";
// Defensive: only accept known-good tenant slugs. An env var
// misconfigured to anything else (e.g. "Year") would otherwise
// cause the backend to crash trying to cast it to UUID.
const RAW_TENANT = (process.env.NEXT_PUBLIC_TENANT_ID || "").toLowerCase();
const ALLOWED_TENANTS = new Set(["bandhan", "match4marriage"]);
const TENANT = ALLOWED_TENANTS.has(RAW_TENANT) ? RAW_TENANT : "bandhan";

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
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch (err: any) {
    throw new ApiError(0, `Network error: ${err?.message || err}`);
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

export const profileApi = {
  me: () => api.get("/api/v1/profile/me"),
  getProfile: (_userId?: string) => api.get("/api/v1/profile/me"),
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
  upsertOnboarding: (data: unknown) => api.post("/api/v1/profile/onboarding", data),
  submitForReview: () => api.post("/api/v1/profile/me/submit", {}),
  getTrustScore: () => api.get("/api/v1/profile/trust-score"),
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
  trustBoost: (userId: string, delta: number) => api.post(`/api/v1/admin/users/${userId}/trust-boost`, { delta }),

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

export const matchApi = {
  list: () => api.get("/api/v1/matches"),
  feed: () => api.get("/api/v1/matches/feed"),
  browseProfiles: (params?: Record<string, string | number>) => {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return api.get(`/api/v1/matches/browse${qs}`);
  },
  getDailyMatches: () => api.get("/api/v1/matches/daily"),
  getReceivedInterests: () => api.get("/api/v1/matches/interests/received"),
  getSentInterests: () => api.get("/api/v1/matches/interests/sent"),
  sendInterest: (toUserId: string) => api.post(`/api/v1/matches/${toUserId}/interest`),
  accept: (matchId: string) => api.post(`/api/v1/matches/${matchId}/accept`),
  decline: (matchId: string) => api.post(`/api/v1/matches/${matchId}/decline`),
};
