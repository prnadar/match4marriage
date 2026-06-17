"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Shield, Search, CheckCheck, AlertCircle, MessageCircle, Loader2,
} from "lucide-react";
import { chatApi } from "@/lib/api";
import { ApprovalGate } from "@/components/ApprovalGate";
import { Portrait } from "@/components/ui/portrait";
import { useEntitlements } from "@/lib/useEntitlements";
import { UpgradePanel } from "@/components/ui/upgrade-lock";

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
  return (
    <ApprovalGate feature="message members">
      <MessagesContent />
    </ApprovalGate>
  );
}

function MessagesContent() {
  const { entitlements, isLoading: entLoading } = useEntitlements();
  const messagingLocked = !entLoading && !entitlements.canMessage;

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

  useEffect(() => {
    // Don't fetch threads for members who can't message — they hit the
    // upgrade panel, not a request. Wait until entitlements resolve.
    if (entLoading) return;
    if (messagingLocked) { setLoading(false); return; }
    load();
  }, [load, entLoading, messagingLocked]);

  const filtered = threads.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (t.other_profile?.first_name ?? "").toLowerCase();
    const preview = (t.last_message_preview ?? "").toLowerCase();
    return name.includes(q) || preview.includes(q);
  });

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)", color: "#e7dde0" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="m4m-aura m4m-aura-rose" />
        <span className="m4m-aura m4m-aura-gold" />
        <span className="m4m-aura m4m-aura-plum" />
        <span className="m4m-aura-vignette" />
      </div>
      <div className="relative mx-auto max-w-[760px] px-6 py-8 lg:px-8 lg:py-10">

        {/* Header */}
        <header className="fade-in-up mb-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#f3c9a8]">
            Conversations
          </p>
          <h1 className="font-display mt-1 text-[34px] font-semibold leading-tight text-white">
            Messages
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/70">
            <Shield className="h-3.5 w-3.5 text-[#f3c9a8]" />
            Private and secure
          </p>
        </header>

        {/* Premium gate — replaces the conversation list for Basic members */}
        {messagingLocked ? (
          <div className="fade-in-up mt-6">
            <UpgradePanel
              feature="Premium"
              title="Direct messaging is a Premium feature"
              message="Upgrade to Premium to message your matches and reply to their interests."
            />
          </div>
        ) : (
        <>
        {/* Search */}
        <div className="fade-in-up mb-5 flex items-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.05] px-4 backdrop-blur-sm focus-within:border-white/20" style={{ animationDelay: "60ms" }}>
          <Search className="h-4 w-4 text-white/45" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="h-11 flex-1 bg-transparent text-[14px] text-[#f4eef0] outline-none placeholder:text-white/35"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="h-12 w-12 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="flex-1">
                  <div className="mb-2 h-3.5 w-32 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="fade-in-up rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center backdrop-blur-sm">
            <AlertCircle className="mx-auto h-9 w-9 text-rose-300/70" />
            <h3 className="font-display mt-3 text-[18px] font-semibold text-white">
              We couldn't load conversations
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">
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
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
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
                      "fade-in-up flex items-center gap-4 rounded-2xl border bg-white/[0.04] p-4 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/[0.07] " +
                      (unread > 0
                        ? "border-[#dc1e3c]/40"
                        : "border-white/10")
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
                        <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white/15 bg-[#220c1a]">
                          <Shield className="h-[11px] w-[11px] text-[#f3c9a8]" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={
                            "truncate text-[14px] " +
                            (unread > 0 ? "font-bold text-white" : "font-medium text-white/75")
                          }
                        >
                          {op?.first_name ?? "Member"}
                          {op?.age ? `, ${op.age}` : ""}
                        </span>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          {unread === 0 && t.last_message_at && (
                            <CheckCheck className="h-3 w-3 text-[#f3c9a8]" />
                          )}
                          <span className="text-[10px] text-white/50">
                            {relativeTime(t.last_message_at)}
                          </span>
                        </div>
                      </div>
                      <p
                        className={
                          "mt-0.5 truncate text-[12.5px] " +
                          (unread > 0 ? "text-white/70" : "text-white/45")
                        }
                      >
                        {t.last_message_preview ?? "Say hello and start the conversation."}
                      </p>
                      {op?.city && (
                        <p className="mt-0.5 text-[10px] text-white/45">{op.city}</p>
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
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center backdrop-blur-sm">
                  <MessageCircle className="mx-auto h-9 w-9 text-[#ff8aa3]/50" />
                  <h3 className="font-display mt-3 text-[18px] font-semibold text-white">
                    {search ? "No conversations match your search" : "No conversations yet"}
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">
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
        </>
        )}
      </div>

      <style jsx>{`.m4m-aura{position:absolute;border-radius:50%;filter:blur(120px);pointer-events:none;}.m4m-aura-rose{width:540px;height:540px;top:-150px;right:-120px;background:radial-gradient(circle,rgba(220,30,60,0.5),transparent 60%);opacity:.5;}.m4m-aura-gold{width:560px;height:560px;bottom:-190px;left:-150px;background:radial-gradient(circle,rgba(201,149,74,0.4),transparent 60%);opacity:.42;}.m4m-aura-plum{width:380px;height:380px;top:42%;right:28%;background:radial-gradient(circle,rgba(124,58,137,0.4),transparent 60%);opacity:.26;}.m4m-aura-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.5) 100%);}`}</style>
    </div>
  );
}
