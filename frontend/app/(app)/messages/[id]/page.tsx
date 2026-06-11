"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Shield, Send, Lock, AlertCircle, Loader2, MessageCircle,
} from "lucide-react";
import { chatApi, openChatSocket, ApiError } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
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
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  /* ── Identify self ─────────────────────────────────────────────── */
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged((user) => {
      setMeId(user?.uid ?? null);
    });
    return unsub;
  }, []);

  /* ── Load thread + history ─────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Pull all threads to find the matching one (cheap, list page just did this).
      // If you have a getThread(id) endpoint later, swap this for that.
      // Backend returns PaginatedResponse{success, data: T[], total, page, limit, has_next}
      // — `res.data` here is the whole envelope, so the items live at `res.data.data`.
      const threadsRes = await chatApi.listThreads(1, 50);
      const allThreads: any[] = (threadsRes.data as any)?.data ?? [];
      const matched = allThreads.find((t: any) => String(t.id) === params.id);
      if (matched?.other_profile) setOther(matched.other_profile);

      const msgRes = await chatApi.getMessages(params.id, 1, 100);
      const items: any[] = (msgRes.data as any)?.data ?? [];
      // Backend returns newest first; reverse for chronological display.
      setMessages([...items].reverse());
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.status === 404 ? "Conversation not found" : err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not load conversation");
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // Members who can't message hit the upgrade panel — don't fetch the
    // thread/history. Wait until entitlements resolve before deciding.
    if (entLoading) return;
    if (messagingLocked) { setLoading(false); return; }
    load();
  }, [load, entLoading, messagingLocked]);

  /* ── Connect WebSocket for live updates + sending ──────────────── */
  useEffect(() => {
    if (!params.id || !meId) return;
    // Never open the chat socket for a member who can't message.
    if (entLoading || messagingLocked) return;
    let cancelled = false;
    let socket: WebSocket | null = null;

    (async () => {
      try {
        socket = await openChatSocket(params.id);
        if (cancelled) { socket.close(); return; }
        socketRef.current = socket;
        socket.onopen = () => setWsConnected(true);
        socket.onclose = () => setWsConnected(false);
        socket.onerror = () => setWsConnected(false);
        socket.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === "message") {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;
                return [...prev, {
                  id: data.id,
                  thread_id: params.id,
                  sender_id: data.sender_id,
                  message_type: data.message_type ?? "text",
                  encrypted_content: data.encrypted_content,
                  encryption_key_id: data.encryption_key_id,
                  created_at: data.created_at,
                }];
              });
            }
          } catch { /* ignore malformed */ }
        };
      } catch {
        setWsConnected(false);
      }
    })();

    return () => {
      cancelled = true;
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
      socketRef.current = null;
    };
  }, [params.id, meId, entLoading, messagingLocked]);

  /* ── Auto-scroll on new message ────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Send message via WS ──────────────────────────────────────── */
  const send = () => {
    const text = input.trim();
    if (!text || sending) return;
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // No live connection — surface an error rather than silently fail.
      setError("Live chat connection lost. Please refresh to reconnect.");
      return;
    }
    setSending(true);
    try {
      ws.send(JSON.stringify({
        type: "message",
        content: text,
        message_type: "text",
      }));
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
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
                {wsConnected ? "Connected · End-to-end encrypted" : "Connecting…"}
              </p>
            </div>
          </Link>
        )}
        {!other && !loading && (
          <div className="flex-1">
            <p className="font-display text-[15px] font-semibold text-white">Conversation</p>
            <p className="text-[11px] text-white/50">
              {messagingLocked ? "Premium feature" : wsConnected ? "Connected" : "Connecting…"}
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
              <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/12 px-3 py-1 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-400/25">
                <Lock className="h-3 w-3" />
                Messages in this conversation are end-to-end encrypted.
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
                messages.map((m) => {
                  const mine = meId !== null && m.sender_id === meId;
                  return (
                    <div
                      key={m.id}
                      className={"flex " + (mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={
                          "max-w-[78%] rounded-[20px] px-4 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.18)] " +
                          (mine
                            ? "rounded-br-md bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] text-white"
                            : "rounded-bl-md border border-white/10 bg-white/[0.06] text-[#f4eef0]")
                        }
                      >
                        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.55]">
                          {m.encrypted_content ?? "[encrypted message]"}
                        </p>
                        <p
                          className={
                            "mt-1 text-right text-[10px] " +
                            (mine ? "text-white/70" : "text-white/45")
                          }
                        >
                          {fmtTime(m.created_at)}
                        </p>
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
            <div className="mx-auto flex max-w-[680px] items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={wsConnected ? "Write a message…" : "Connecting…"}
                disabled={!wsConnected}
                className="h-11 flex-1 rounded-2xl border border-white/[0.12] bg-white/[0.05] px-4 text-[14px] text-[#f4eef0] outline-none transition-colors placeholder:text-white/35 focus:border-white/25 disabled:opacity-60"
              />
              <button
                onClick={send}
                disabled={!input.trim() || !wsConnected || sending}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] text-white shadow-[0_4px_14px_rgba(220,30,60,0.28)] transition-all hover:shadow-[0_8px_20px_rgba(220,30,60,0.38)] disabled:opacity-40 disabled:shadow-none"
                aria-label="Send"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`.m4m-aura{position:absolute;border-radius:50%;filter:blur(120px);pointer-events:none;}.m4m-aura-rose{width:540px;height:540px;top:-150px;right:-120px;background:radial-gradient(circle,rgba(220,30,60,0.5),transparent 60%);opacity:.5;}.m4m-aura-gold{width:560px;height:560px;bottom:-190px;left:-150px;background:radial-gradient(circle,rgba(201,149,74,0.4),transparent 60%);opacity:.42;}.m4m-aura-plum{width:380px;height:380px;top:42%;right:28%;background:radial-gradient(circle,rgba(124,58,137,0.4),transparent 60%);opacity:.26;}.m4m-aura-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.5) 100%);}`}</style>
    </div>
  );
}
