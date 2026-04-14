"use client";
import { getIdToken } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";
const TENANT = process.env.NEXT_PUBLIC_TENANT_ID || "bandhan";

export type ApiResponse<T = any> = { data: T; status: number };

async function request<T = any>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = await getIdToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-ID": TENANT,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail: string = res.statusText;
    try {
      const body = await res.json();
      const d = body.detail ?? body.error;
      if (Array.isArray(d)) {
        detail = d
          .map((e: any) => {
            const loc = Array.isArray(e?.loc) ? e.loc.filter((x: any) => x !== "body").join(".") : "";
            return loc ? `${loc}: ${e.msg || e.type || "invalid"}` : (e.msg || e.type || JSON.stringify(e));
          })
          .join("; ");
      } else if (typeof d === "string") {
        detail = d;
      } else if (d) {
        detail = JSON.stringify(d);
      }
    } catch {}
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return { data: undefined as T, status: 204 };
  const data = (await res.json()) as T;
  return { data, status: res.status };
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const profileApi = {
  me: () => api.get("/api/v1/profile/me"),
  getProfile: (_userId?: string) => api.get("/api/v1/profile/me"),
  update: (data: unknown) => api.patch("/api/v1/profile/me", data),
  updateProfile: (...args: unknown[]) => {
    const data = args.length === 2 ? args[1] : args[0];
    return api.patch("/api/v1/profile/me", data);
  },
  upsertOnboarding: (data: unknown) => api.post("/api/v1/profile/onboarding", data),
  getTrustScore: () => api.get("/api/v1/profile/trust-score"),
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
