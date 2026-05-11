"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Shield, Search, CheckCheck, AlertCircle, MessageCircle, Loader2,
} from "lucide-react";
import { chatApi } from "@/lib/api";
import { Portrait } from "@/components/ui/portrait";

interface ChatThread {
  id: string;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  unread_count?: number;
  other_profile?: {
    user_id: string;
    first_name: string;
    age?: number | null;
    city?: string | null;
    primary_photo_url?: string | null;
    trust_score?: number;
    completeness_score?: number;
  } | null;
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await chatApi.listThreads(1, 50);
      const items: any[] = (res.data as any)?.data ?? [];
      setThreads(items as ChatThread[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = threads.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (t.other_profile?.first_name ?? "").toLowerCase();
    const preview = (t.last_message_preview ?? "").toLowerCase();
    return name.includes(q) || preview.includes(q);
  });

  return (
    <div className="min-h-screen" style={{ background: "#fdfbf9" }}>
      <div className="mx-auto max-w-[760px] px-6 py-8 lg:px-8 lg:py-10">

        {/* Header */}
        <header className="fade-in-up mb-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-rose-700/80">
            Conversations
          </p>
          <h1 className="font-display mt-1 text-[34px] font-semibold leading-tight text-[#1a0a14]">
            Messages
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#6a5560]">
            <Shield className="h-3.5 w-3.5 text-rose-700" />
            End-to-end encrypted · Private and secure
          </p>
        </header>

        {/* Search */}
        <div className="fade-in-up mb-5 flex items-center gap-2 rounded-2xl border border-rose-100 bg-white px-4 shadow-[0_2px_10px_rgba(220,30,60,0.04)] focus-within:border-rose-300 focus-within:shadow-[0_4px_16px_rgba(220,30,60,0.10)]" style={{ animationDelay: "60ms" }}>
          <Search className="h-4 w-4 text-rose-700/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="h-11 flex-1 bg-transparent text-[14px] text-[#1a0a14] outline-none placeholder:text-rose-700/40"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-2xl border border-rose-100/70 bg-white p-4"
              >
                <div className="m4m-skeleton h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <div className="m4m-skeleton mb-2 h-3.5 w-32" />
                  <div className="m4m-skeleton h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="fade-in-up rounded-3xl border border-rose-100/70 bg-white px-6 py-12 text-center shadow-[0_2px_14px_rgba(220,30,60,0.05)]">
            <AlertCircle className="mx-auto h-9 w-9 text-rose-700/60" />
            <h3 className="font-display mt-3 text-[18px] font-semibold text-[#1a0a14]">
              We couldn't load conversations
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#6a5560]">
              {error}
            </p>
            <button
              onClick={load}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(220,30,60,0.28)] hover:shadow-[0_10px_26px_rgba(220,30,60,0.38)]"
            >
              <Loader2 className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {/* List */}
        {!loading && !error && (
          <>
            {filtered.length > 0 && (
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-700/60">
                {filtered.length} conversation{filtered.length !== 1 ? "s" : ""}
              </p>
            )}
            <div className="space-y-2.5">
              {filtered.map((t, i) => {
                const op = t.other_profile;
                const unread = t.unread_count ?? 0;
                return (
                  <Link
                    key={t.id}
                    href={`/messages/${t.id}`}
                    className={
                      "fade-in-up flex items-center gap-4 rounded-2xl border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(220,30,60,0.10)] " +
                      (unread > 0
                        ? "border-rose-200 shadow-[0_2px_14px_rgba(220,30,60,0.10)]"
                        : "border-rose-100/70 shadow-[0_1px_4px_rgba(26,10,20,0.04)]")
                    }
                    style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                  >
                    <div className="relative flex-shrink-0">
                      <Portrait
                        src={op?.primary_photo_url}
                        name={op?.first_name}
                        seed={op?.user_id ?? t.id}
                        rounded="full"
                        showInitials
                        className="h-12 w-12"
                      />
                      {op && op.completeness_score !== undefined && op.completeness_score >= 70 && (
                        <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-rose-100 bg-white">
                          <Shield className="h-[11px] w-[11px] text-rose-700" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={
                            "truncate text-[14px] " +
                            (unread > 0 ? "font-bold text-[#1a0a14]" : "font-medium text-[#1a0a14]/75")
                          }
                        >
                          {op?.first_name ?? "Member"}
                          {op?.age ? `, ${op.age}` : ""}
                        </span>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          {unread === 0 && t.last_message_at && (
                            <CheckCheck className="h-3 w-3 text-rose-700" />
                          )}
                          <span className="text-[10px] text-[#6a5560]">
                            {relativeTime(t.last_message_at)}
                          </span>
                        </div>
                      </div>
                      <p
                        className={
                          "mt-0.5 truncate text-[12.5px] " +
                          (unread > 0 ? "text-[#1a0a14]/70" : "text-[#1a0a14]/40")
                        }
                      >
                        {t.last_message_preview ?? "Say hello — start the conversation."}
                      </p>
                      {op?.city && (
                        <p className="mt-0.5 text-[10px] text-[#6a5560]/80">{op.city}</p>
                      )}
                    </div>

                    {unread > 0 && (
                      <span className="flex h-[22px] min-w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-1.5 text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(220,30,60,0.35)]">
                        {unread}
                      </span>
                    )}
                  </Link>
                );
              })}

              {filtered.length === 0 && (
                <div className="rounded-3xl border border-rose-100/70 bg-white px-6 py-16 text-center shadow-[0_2px_14px_rgba(220,30,60,0.05)]">
                  <MessageCircle className="mx-auto h-9 w-9 text-rose-700/40" />
                  <h3 className="font-display mt-3 text-[18px] font-semibold text-[#1a0a14]">
                    {search ? "No conversations match your search" : "No conversations yet"}
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#6a5560]">
                    {search
                      ? "Try a different name or keyword."
                      : "When someone accepts your interest, your conversation will appear here."}
                  </p>
                  {!search && (
                    <Link
                      href="/matches"
                      className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(220,30,60,0.28)] hover:shadow-[0_10px_26px_rgba(220,30,60,0.38)]"
                    >
                      Browse profiles
                    </Link>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
