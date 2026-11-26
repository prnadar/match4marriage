"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Shield, Send, Lock, AlertCircle, Loader2, MessageCircle, RotateCw,
} from "lucide-react";
import { chatApi, accountApi, ApiError, apiErrorMessage } from "@/lib/api";
import { Portrait } from "@/components/ui/portrait";
import { useEntitlements } from "@/lib/useEntitlements";
import { UpgradePanel } from "@/components/ui/upgrade-lock";

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  message_type: string;
  encrypted_content?: string | null;
  encryption_key_id?: string | null;
  created_at: string;
  read_at?: string | null;
  delivered_at?: string | null;
  /** Client-only: optimistic bubble while sending, or a failed send. */
  local?: "sending" | "failed";
}

const POLL_MS = 4000;
const MAX_CHARS = 2000;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

/** Server timestamps are UTC; older rows may lack an offset. */
function asUtc(iso: string): string {
  return /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
}

interface OtherProfile {
  user_id: string;
  first_name: string;
  age?: number | null;
  city?: string | null;
  primary_photo_url?: string | null;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage({ params }: { params: { id: string } }) {
  const { entitlements, isLoading: entLoading } = useEntitlements();
  const messagingLocked = !entLoading && !entitlements.canMessage;

  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  // Newest server timestamp we hold — the polling cursor.
  const cursorRef = useRef<string | null>(null);

  const advanceCursor = (items: Message[]) => {
    for (const m of items) {
      if (m.local) continue;
      if (!cursorRef.current || new Date(asUtc(m.created_at)) > new Date(asUtc(cursorRef.current))) {
        cursorRef.current = m.created_at;
      }
    }
  };

  /** Merge server messages in, de-duplicated by id, in time order. */
  const mergeMessages = useCallback((incoming: Message[]) => {
    if (!incoming.length) return;
    advanceCursor(incoming);
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const add = incoming.filter((m) => !seen.has(m.id));
      if (!add.length) return prev;
      return [...prev, ...add].sort(
        (a, b) => +new Date(asUtc(a.created_at)) - +new Date(asUtc(b.created_at)),
      );
    });
  }, []);

  /* ── Load conversation + history ──────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [threadRes, msgRes, meRes] = await Promise.all([
        chatApi.getThread(params.id),
        chatApi.getMessages(params.id, 1, 100),
        accountApi.me().catch(() => null),
      ]);
      const thread = (threadRes.data as any)?.data ?? {};
      const otherCard: OtherProfile | null = thread.other_profile ?? null;
      setOther(otherCard);

      // My account id — the id the server puts on my messages. Prefer /auth/me;
      // otherwise it's whichever participant isn't the other member.
      const fromMe = (meRes?.data as any)?.data?.user_id ?? (meRes?.data as any)?.user_id;
      const fromThread = otherCard
        ? (String(thread.user_a_id) === String(otherCard.user_id) ? thread.user_b_id : thread.user_a_id)
        : null;
      setMeId(fromMe ? String(fromMe) : fromThread ? String(fromThread) : null);

      // History arrives newest first; show oldest first.
      const items: Message[] = [...((msgRes.data as any)?.data ?? [])].reverse();
      cursorRef.current = null;
      advanceCursor(items);
      setMessages(items);
      chatApi.markRead(params.id).catch(() => {});
    } catch (err: unknown) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "This conversation isn't available. It may have been closed."
          : apiErrorMessage(err, "We couldn't load this conversation. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // Members who can't message see the upgrade panel — don't fetch.
    if (entLoading) return;
    if (messagingLocked) { setLoading(false); return; }
    load();
  }, [load, entLoading, messagingLocked]);

  /* ── Poll for new messages while the conversation is open ─────── */
  useEffect(() => {
    if (loading || error || messagingLocked || entLoading) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stopped) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        try {
          const since = cursorRef.current ?? "1970-01-01T00:00:00Z";
          const res = await chatApi.messagesSince(params.id, asUtc(since));
          const fresh: Message[] = (res.data as any)?.data ?? [];
          if (fresh.length) {
            mergeMessages(fresh);
            if (fresh.some((m) => m.sender_id !== meId)) chatApi.markRead(params.id).catch(() => {});
          }
        } catch { /* transient — try again next tick */ }
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);

    // Catch up immediately when the member returns to the tab.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [params.id, loading, error, messagingLocked, entLoading, meId, mergeMessages]);

  /* ── Auto-scroll on new message ────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* ── Send (optimistic, with retry on failure) ──────────────────── */
  const deliver = async (tempId: string, text: string) => {
    setSendError(null);
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, local: "sending" } : m)));
    try {
      const res = await chatApi.sendMessage(params.id, text);
      const saved: Message = (res.data as any)?.data;
      advanceCursor([saved]);
      setMessages((prev) => {
        // The poll may already have brought the saved message in.
        const without = prev.filter((m) => m.id !== tempId);
        return without.some((m) => m.id === saved.id) ? without : [...without, saved];
      });
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, local: "failed" } : m)));
      setSendError(
        err instanceof ApiError && err.status === 410
          ? "This member is no longer available, so your message wasn't sent."
          : apiErrorMessage(err, "Your message wasn't sent. Check your connection and tap it to retry."),
      );
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || text.length > MAX_CHARS) return;
    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId,
      thread_id: params.id,
      sender_id: meId ?? "me",
      message_type: "text",
      encrypted_content: text,
      created_at: new Date().toISOString(),
      local: "sending",
    }]);
    setInput("");
    deliver(tempId, text);
  };

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div
      className="relative flex h-[calc(100vh-60px)] flex-col overflow-hidden"
      style={{ background: "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)", color: "#e7dde0" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="m4m-aura m4m-aura-rose" />
        <span className="m4m-aura m4m-aura-gold" />
        <span className="m4m-aura m4m-aura-plum" />
        <span className="m4m-aura-vignette" />
      </div>

      {/* Header */}
      <header className="relative flex items-center gap-3 border-b border-white/10 bg-white/[0.04] px-5 py-3 backdrop-blur">
        <Link
          href="/messages"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {other && (
          <Link href={`/profile/${other.user_id}`} className="flex flex-1 items-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-white/[0.05]">
            <Portrait
              src={other.primary_photo_url}
              name={other.first_name}
              seed={other.user_id}
              rounded="full"
              showInitials
              className="h-10 w-10"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-semibold text-white">
                {other.first_name}{other.age ? `, ${other.age}` : ""}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-white/50">
                <Shield className="h-3 w-3 text-[#f3c9a8]" />
                Private conversation
              </p>
            </div>
          </Link>
        )}
        {!other && !loading && (
          <div className="flex-1">
            <p className="font-display text-[15px] font-semibold text-white">Conversation</p>
            <p className="text-[11px] text-white/50">
              {messagingLocked ? "Premium feature" : "Private conversation"}
            </p>
          </div>
        )}
      </header>

      {/* Body */}
      {messagingLocked ? (
        <div className="relative flex flex-1 items-center justify-center px-6 py-10">
          <UpgradePanel
            feature="Premium"
            title="Direct messaging is a Premium feature"
            message="Upgrade to Premium to message your matches and reply to their interests."
          />
        </div>
      ) : loading ? (
        <div className="relative flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#ff8aa3]" />
        </div>
      ) : error ? (
        <div className="relative flex flex-1 items-center justify-center px-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center backdrop-blur-sm">
            <AlertCircle className="mx-auto h-9 w-9 text-rose-300/70" />
            <h3 className="font-display mt-3 text-[18px] font-semibold text-white">Couldn't load conversation</h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">{error}</p>
            <button
              onClick={load}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(220,30,60,0.28)] hover:shadow-[0_10px_26px_rgba(220,30,60,0.38)]"
            >
              <Loader2 className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-[680px] space-y-2.5">
              {/* Encryption preamble */}
              <div className="flex justify-center">
                <div className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-center text-[11px] font-medium text-white/60 ring-1 ring-white/10">
                  <Lock className="h-3 w-3 flex-shrink-0" />
                  Only you and {other?.first_name ?? "your match"} can see this conversation. Never send money or bank details.
                </div>
              </div>

              {messages.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center backdrop-blur-sm">
                  <MessageCircle className="mx-auto h-9 w-9 text-[#ff8aa3]/50" />
                  <p className="font-display mt-3 text-[16px] font-semibold text-white">Start the conversation</p>
                  <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-white/55">
                    Say hello. A thoughtful first message goes a long way.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const mine = m.local !== undefined || (meId !== null && String(m.sender_id) === meId);
                  const prev = messages[i - 1];
                  const newDay = !prev || dayLabel(asUtc(prev.created_at)) !== dayLabel(asUtc(m.created_at));
                  return (
                    <div key={m.id}>
                      {newDay && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-white/[0.06] px-3 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/45">
                            {dayLabel(asUtc(m.created_at))}
                          </span>
                        </div>
                      )}
                      <div className={"flex " + (mine ? "justify-end" : "justify-start")}>
                        <button
                          type="button"
                          disabled={m.local !== "failed"}
                          onClick={() => m.local === "failed" && deliver(m.id, m.encrypted_content ?? "")}
                          className={
                            "max-w-[78%] rounded-[20px] px-4 py-2.5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.18)] disabled:cursor-default " +
                            (mine
                              ? "rounded-br-md bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] text-white"
                              : "rounded-bl-md border border-white/10 bg-white/[0.06] text-[#f4eef0]") +
                            (m.local === "sending" ? " opacity-70" : "") +
                            (m.local === "failed" ? " ring-2 ring-amber-300/70" : "")
                          }
                        >
                          <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.55]">
                            {m.encrypted_content ?? ""}
                          </p>
                          <p className={"mt-1 flex items-center justify-end gap-1 text-[10px] " + (mine ? "text-white/70" : "text-white/45")}>
                            {m.local === "sending" ? "Sending…"
                              : m.local === "failed" ? (<><RotateCw className="h-3 w-3" /> Not sent · tap to retry</>)
                              : fmtTime(asUtc(m.created_at))}
                          </p>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="relative border-t border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur sm:px-6">
            <div className="mx-auto max-w-[680px]">
              {sendError && (
                <p role="alert" className="mb-2 flex items-start gap-1.5 text-[12px] text-amber-200">
                  <AlertCircle className="mt-px h-3.5 w-3.5 flex-shrink-0" /> {sendError}
                </p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  value={input}
                  maxLength={MAX_CHARS}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`Message ${other?.first_name ?? ""}…`.replace(" …", "…")}
                  aria-label="Write a message"
                  className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-white/[0.12] bg-white/[0.05] px-4 py-[11px] text-[14px] leading-[1.45] text-[#f4eef0] outline-none transition-colors [field-sizing:content] placeholder:text-white/35 focus:border-white/25"
                />
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] text-white shadow-[0_4px_14px_rgba(220,30,60,0.28)] transition-all hover:shadow-[0_8px_20px_rgba(220,30,60,0.38)] disabled:opacity-40 disabled:shadow-none"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {input.length > MAX_CHARS - 200 && (
                <p className="mt-1 text-right text-[10.5px] text-white/45">{input.length} / {MAX_CHARS}</p>
              )}
            </div>
          </div>
        </>
      )}

      <style jsx>{`.m4m-aura{position:absolute;border-radius:50%;filter:blur(120px);pointer-events:none;}.m4m-aura-rose{width:540px;height:540px;top:-150px;right:-120px;background:radial-gradient(circle,rgba(220,30,60,0.5),transparent 60%);opacity:.5;}.m4m-aura-gold{width:560px;height:560px;bottom:-190px;left:-150px;background:radial-gradient(circle,rgba(201,149,74,0.4),transparent 60%);opacity:.42;}.m4m-aura-plum{width:380px;height:380px;top:42%;right:28%;background:radial-gradient(circle,rgba(124,58,137,0.4),transparent 60%);opacity:.26;}.m4m-aura-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.5) 100%);}`}</style>
    </div>
  );
}
