"use client";

import { useState, useEffect } from "react";
import { Bell, Heart, MessageCircle, Shield, Star, CheckCheck, Settings, Trash2, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

type NotifType = "interest" | "message" | "match" | "trust" | "system";

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  link?: string;
  initials?: string;
  grad?: string;
}

const TYPE_META: Record<NotifType, { icon: React.ReactNode; color: string }> = {
  interest: { icon: <Heart className="w-4 h-4" />,         color: "#dc1e3c" },
  message:  { icon: <MessageCircle className="w-4 h-4" />, color: "#9A6B00" },
  match:    { icon: <Star className="w-4 h-4" />,          color: "#5C7A52" },
  trust:    { icon: <Shield className="w-4 h-4" />,        color: "#0F766E" },
  system:   { icon: <Bell className="w-4 h-4" />,          color: "rgba(26,10,20,0.4)" },
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  } catch {
    return dateStr;
  }
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const GRADIENTS = [
  "linear-gradient(135deg,#dc1e3c,#a0153c)",
  "linear-gradient(135deg,#9A6B00,#C89020)",
  "linear-gradient(135deg,#5C7A52,#8DB870)",
  "linear-gradient(135deg,#0F766E,#14B8A6)",
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapNotif(n: any, idx: number): Notif {
  const name = n.sender_name || n.from_name || "";
  return {
    id: n.id || String(idx),
    type: n.type || "system",
    title: n.title || "",
    body: n.body || n.message || n.content || "",
    time: n.created_at ? timeAgo(n.created_at) : n.time || "",
    read: n.is_read ?? n.read ?? false,
    link: n.link || n.action_url || undefined,
    initials: name ? getInitials(name) : undefined,
    grad: name ? GRADIENTS[idx % GRADIENTS.length] : undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<NotifType | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/notifications");
        const data = res.data;
        const list = Array.isArray(data) ? data : data?.results ?? data?.notifications ?? data?.data ?? [];
        setNotifs(list.map(mapNotif));
      } catch {
        // API may not have notifications endpoint yet — show empty state
        setNotifs([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const markRead = (id: string) =>
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  const markAllRead = () =>
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));

  const remove = (id: string) =>
    setNotifs((prev) => prev.filter((n) => n.id !== id));

  const filtered = filter === "all" ? notifs : notifs.filter((n) => n.type === filter);
  const unreadCount = notifs.filter((n) => !n.read).length;

  const filters: { key: NotifType | "all"; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "interest", label: "Interests" },
    { key: "message",  label: "Messages" },
    { key: "match",    label: "Matches" },
    { key: "trust",    label: "Trust" },
    { key: "system",   label: "System" },
  ];

  return (
    <div style={{ background: "#fdfbf9", minHeight: "100vh" }}>
      {/* Header strip */}
      <div
        style={{
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #dc1e3c 0%, #a0153c 100%)",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 30,
              fontWeight: 300,
              color: "#fff",
              margin: 0,
            }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p
              style={{
                fontFamily: "var(--font-poppins, sans-serif)",
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
                margin: "4px 0 0",
              }}
            >
              {unreadCount} unread
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.3)",
                background: "transparent",
                color: "rgba(255,255,255,0.85)",
                fontFamily: "var(--font-poppins, sans-serif)",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}
            >
              <CheckCheck style={{ width: 14, height: 14 }} /> Mark all read
            </button>
          )}
          <Link
            href="/settings"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <Settings style={{ width: 16, height: 16 }} />
          </Link>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 672 }}>
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {filters.map((f) => {
            const count =
              f.key === "all"
                ? notifs.filter((n) => !n.read).length
                : notifs.filter((n) => n.type === f.key && !n.read).length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 999,
                  border: active ? "none" : "1px solid rgba(220,30,60,0.15)",
                  background: active ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "#fff",
                  color: active ? "#fff" : "rgba(26,10,20,0.55)",
                  fontFamily: "var(--font-poppins, sans-serif)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                {f.label}
                {count > 0 && (
                  <span
                    style={{
                      width: 16, height: 16, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700,
                      background: active ? "rgba(255,255,255,0.25)" : "rgba(220,30,60,0.1)",
                      color: active ? "#fff" : "#dc1e3c",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <Loader2 style={{ width: 32, height: 32, color: "#dc1e3c", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 14, color: "rgba(26,10,20,0.4)" }}>
              Loading notifications…
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Notifications list */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 0" }}>
                <Bell style={{ width: 48, height: 48, color: "rgba(26,10,20,0.15)", margin: "0 auto 12px" }} />
                <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 14, color: "rgba(26,10,20,0.4)" }}>
                  {notifs.length === 0
                    ? "No notifications yet. Activity on your profile will appear here."
                    : "No notifications in this category"}
                </p>
              </div>
            )}

            {filtered.map((notif) => {
              const meta = TYPE_META[notif.type] || TYPE_META.system;
              return (
                <div
                  key={notif.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12, padding: 16,
                    background: "#fff",
                    border: notif.read ? "1px solid rgba(220,30,60,0.08)" : "1px solid rgba(220,30,60,0.12)",
                    borderLeft: notif.read ? "1px solid rgba(220,30,60,0.08)" : "4px solid #dc1e3c",
                    borderRadius: 12, position: "relative",
                  }}
                >
                  {notif.initials ? (
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: notif.grad,
                        fontFamily: "var(--font-playfair, serif)",
                        fontSize: 14, fontWeight: 600, color: "#fff", flexShrink: 0,
                      }}
                    >
                      {notif.initials}
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: `${meta.color}18`, color: meta.color, flexShrink: 0,
                      }}
                    >
                      {meta.icon}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 14, fontWeight: 600, color: "#1a0a14", margin: 0 }}>
                        {notif.title}
                      </p>
                      <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 10, color: "rgba(26,10,20,0.3)", flexShrink: 0 }}>
                        {notif.time}
                      </span>
                    </div>
                    <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 12, color: "rgba(26,10,20,0.55)", margin: "2px 0 0", lineHeight: 1.5 }}>
                      {notif.body}
                    </p>

                    {notif.link && (
                      <Link
                        href={notif.link}
                        onClick={() => markRead(notif.id)}
                        style={{
                          display: "inline-block", marginTop: 8,
                          fontSize: 12, fontWeight: 600, color: "#dc1e3c",
                          textDecoration: "none",
                          fontFamily: "var(--font-poppins, sans-serif)",
                        }}
                      >
                        {notif.type === "interest" ? "View Interest →" :
                         notif.type === "message"  ? "Open Chat →" :
                         notif.type === "match"    ? "View Profile →" :
                         "View →"}
                      </Link>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    {!notif.read && (
                      <button
                        onClick={() => markRead(notif.id)}
                        title="Mark read"
                        style={{
                          width: 28, height: 28, borderRadius: "50%", border: "none",
                          background: "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", color: "rgba(26,10,20,0.25)",
                        }}
                      >
                        <Check style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                    <button
                      onClick={() => remove(notif.id)}
                      title="Dismiss"
                      style={{
                        width: 28, height: 28, borderRadius: "50%", border: "none",
                        background: "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", color: "rgba(26,10,20,0.2)",
                      }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>

                  {!notif.read && (
                    <div
                      style={{
                        position: "absolute", top: 16, right: 16,
                        width: 8, height: 8, borderRadius: "50%",
                        background: "#dc1e3c",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
