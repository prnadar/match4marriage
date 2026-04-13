"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, MessageCircle, X, CheckCircle, Clock, Star, Filter, Loader2 } from "lucide-react";
import { matchApi } from "@/lib/api";

type Tab = "received" | "sent" | "mutual";

interface InterestProfile {
  id: string;
  name: string;
  initials: string;
  grad: string;
  age: number;
  city: string;
  profession: string;
  company: string;
  compatibility: number;
  time: string;
  verified: boolean;
  status?: string;
}

const GRADIENTS = [
  "linear-gradient(135deg,#E8426A,#E8A060)",
  "linear-gradient(135deg,#9A6B00,#C89020)",
  "linear-gradient(135deg,#5C7A52,#8DB870)",
  "linear-gradient(135deg,#E8426A99,#9A6B0099)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  "linear-gradient(135deg,#0F766E,#0D9488)",
  "linear-gradient(135deg,#BE185D,#F472B6)",
  "linear-gradient(135deg,#1D4ED8,#60A5FA)",
];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

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

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapInterest(p: any, idx: number): InterestProfile {
  const firstName = p.first_name || p.firstName || "";
  const lastName = p.last_name || p.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || p.name || "Unknown";
  return {
    id: p.id || p.user_id || p.sender_id || p.receiver_id || String(idx),
    name,
    initials: getInitials(name),
    grad: GRADIENTS[idx % GRADIENTS.length],
    age: p.age ?? 0,
    city: p.city || p.location || "",
    profession: p.profession || p.occupation || "",
    company: p.company || "",
    compatibility: p.compatibility ?? p.match_score ?? 0,
    time: p.created_at ? timeAgo(p.created_at) : p.time || "",
    verified: p.is_verified ?? p.verified ?? false,
    status: p.status || "pending",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const statusBadge: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: "Pending",  bg: "rgba(200,144,32,0.12)",  color: "#9A6B00" },
  viewed:   { label: "Viewed",   bg: "rgba(26,10,20,0.08)",    color: "rgba(26,10,20,0.55)" },
  accepted: { label: "Accepted", bg: "rgba(220,30,60,0.1)",    color: "#dc1e3c" },
  declined: { label: "Declined", bg: "rgba(26,10,20,0.08)",    color: "rgba(26,10,20,0.4)" },
};

export default function InterestsPage() {
  const [tab, setTab] = useState<Tab>("received");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const [receivedList, setReceivedList] = useState<InterestProfile[]>([]);
  const [sentList, setSentList] = useState<InterestProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [recRes, sentRes] = await Promise.allSettled([
          matchApi.getReceivedInterests(),
          matchApi.getSentInterests(),
        ]);

        if (recRes.status === "fulfilled") {
          const data = recRes.value.data;
          const list = Array.isArray(data) ? data : data?.results ?? data?.interests ?? data?.data ?? [];
          setReceivedList(list.map(mapInterest));
        }

        if (sentRes.status === "fulfilled") {
          const data = sentRes.value.data;
          const list = Array.isArray(data) ? data : data?.results ?? data?.interests ?? data?.data ?? [];
          setSentList(list.map(mapInterest));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load interests";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const dismiss = (id: string) => setDismissed((prev) => new Set(Array.from(prev).concat(id)));
  const accept = (id: string) => {
    setAccepted((prev) => new Set(Array.from(prev).concat(id)));
    matchApi.sendInterest(id).catch(() => {
      setAccepted((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    });
  };

  const mutualList = receivedList.filter((r) => sentList.some((s) => s.id === r.id));

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "received", label: "Received",  count: receivedList.length },
    { key: "sent",     label: "Sent",      count: sentList.length },
    { key: "mutual",   label: "Mutual",    count: mutualList.length },
  ];

  return (
    <div style={{ background: "#fdfbf9", minHeight: "100vh", padding: "32px", maxWidth: "720px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "30px", fontWeight: 300, color: "#1a0a14", margin: 0, lineHeight: 1.2 }}>
            Interests
          </h1>
          <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", color: "#888", marginTop: "4px", marginBottom: 0 }}>
            Manage connection requests
          </p>
        </div>
        <button
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 16px", borderRadius: "10px", cursor: "pointer",
            fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", color: "rgba(26,10,20,0.55)",
            background: "#fff", border: "1px solid rgba(220,30,60,0.12)",
            transition: "all 0.2s ease",
          }}
        >
          <Filter style={{ width: "16px", height: "16px" }} />
          Filter
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid rgba(220,30,60,0.12)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 16px", cursor: "pointer",
              background: "transparent", border: "none",
              fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", fontWeight: 500,
              color: tab === t.key ? "#dc1e3c" : "rgba(26,10,20,0.45)",
              borderBottom: tab === t.key ? "2px solid #dc1e3c" : "2px solid transparent",
              marginBottom: "-1px",
              transition: "all 0.2s ease",
            }}
          >
            {t.label}
            <span
              style={{
                fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", fontWeight: 700,
                padding: "2px 6px", borderRadius: "20px",
                background: tab === t.key ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "rgba(26,10,20,0.08)",
                color: tab === t.key ? "#fff" : "rgba(26,10,20,0.4)",
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <Loader2 style={{ width: "32px", height: "32px", color: "#dc1e3c", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
          <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", color: "#888" }}>Loading interests…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <X style={{ width: "40px", height: "40px", color: "#dc1e3c", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", color: "#888" }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Received Tab ── */}
          {tab === "received" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {receivedList.filter((p) => !dismissed.has(p.id)).map((profile) => {
                const isAccepted = accepted.has(profile.id);
                return (
                  <div
                    key={profile.id}
                    style={{
                      background: "#fff", border: "1px solid rgba(220,30,60,0.08)",
                      borderRadius: "16px", padding: "16px",
                      display: "flex", alignItems: "center", gap: "16px",
                      boxShadow: "0 2px 12px rgba(220,30,60,0.05)",
                    }}
                  >
                    <div
                      style={{
                        width: "56px", height: "56px", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: profile.grad, flexShrink: 0,
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "17px", fontWeight: 600, color: "#fff" }}>
                        {profile.initials}
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "15px", fontWeight: 600, color: "#1a0a14" }}>
                          {profile.name}
                        </span>
                        {profile.verified && (
                          <CheckCircle style={{ width: "14px", height: "14px", color: "#dc1e3c", fill: "rgba(220,30,60,0.15)", flexShrink: 0 }} />
                        )}
                        {profile.compatibility > 0 && (
                          <span
                            style={{
                              fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", fontWeight: 700,
                              padding: "2px 8px", borderRadius: "20px",
                              background: "rgba(200,144,32,0.12)", color: "#9A6B00",
                            }}
                          >
                            {profile.compatibility}% match
                          </span>
                        )}
                      </div>
                      <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", color: "#888", margin: "3px 0 0" }}>
                        {[profile.age > 0 ? String(profile.age) : "", profile.city, profile.profession ? `${profile.profession}${profile.company ? ` at ${profile.company}` : ""}` : ""].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {profile.time && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                          <Clock style={{ width: "11px", height: "11px", color: "rgba(26,10,20,0.3)" }} />
                          <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "10px", color: "rgba(26,10,20,0.3)" }}>
                            {profile.time}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      {isAccepted ? (
                        <Link
                          href="/messages/1"
                          style={{
                            display: "flex", alignItems: "center", gap: "6px",
                            padding: "8px 16px", borderRadius: "10px",
                            fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", fontWeight: 600,
                            background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
                            color: "#fff", textDecoration: "none",
                            boxShadow: "0 4px 12px rgba(220,30,60,0.25)",
                          }}
                        >
                          <MessageCircle style={{ width: "13px", height: "13px" }} />
                          Message
                        </Link>
                      ) : (
                        <>
                          <button
                            onClick={() => dismiss(profile.id)}
                            style={{
                              width: "32px", height: "32px", borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "#fff", border: "1px solid rgba(26,10,20,0.1)",
                              cursor: "pointer", transition: "all 0.2s ease",
                              color: "rgba(26,10,20,0.3)",
                            }}
                          >
                            <X style={{ width: "13px", height: "13px" }} />
                          </button>
                          <button
                            onClick={() => accept(profile.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: "6px",
                              padding: "8px 16px", borderRadius: "10px", cursor: "pointer",
                              fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", fontWeight: 600,
                              background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
                              color: "#fff", border: "none",
                              boxShadow: "0 4px 12px rgba(220,30,60,0.25)",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <Heart style={{ width: "13px", height: "13px" }} />
                            Accept
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {receivedList.filter((p) => !dismissed.has(p.id)).length === 0 && (
                <div style={{ textAlign: "center", padding: "64px 0" }}>
                  <Heart style={{ width: "48px", height: "48px", color: "rgba(26,10,20,0.15)", margin: "0 auto 12px" }} />
                  <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", color: "#888" }}>
                    No received interests yet. Complete your profile to get noticed!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Sent Tab ── */}
          {tab === "sent" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {sentList.length === 0 && (
                <div style={{ textAlign: "center", padding: "64px 0" }}>
                  <Heart style={{ width: "48px", height: "48px", color: "rgba(26,10,20,0.15)", margin: "0 auto 12px" }} />
                  <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", color: "#888" }}>
                    No sent interests yet. Browse profiles to find your match!
                  </p>
                </div>
              )}
              {sentList.map((profile) => {
                const badge = statusBadge[profile.status || "pending"] || statusBadge.pending;
                return (
                  <div
                    key={profile.id}
                    style={{
                      background: "#fff", border: "1px solid rgba(220,30,60,0.08)",
                      borderRadius: "16px", padding: "16px",
                      display: "flex", alignItems: "center", gap: "16px",
                      boxShadow: "0 2px 12px rgba(220,30,60,0.05)",
                    }}
                  >
                    <div
                      style={{
                        width: "56px", height: "56px", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: profile.grad, flexShrink: 0,
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "17px", fontWeight: 600, color: "#fff" }}>
                        {profile.initials}
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "15px", fontWeight: 600, color: "#1a0a14" }}>
                          {profile.name}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", fontWeight: 600,
                            padding: "2px 8px", borderRadius: "20px",
                            background: badge.bg, color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", color: "#888", margin: "3px 0 0" }}>
                        {[profile.age > 0 ? String(profile.age) : "", profile.city, profile.profession ? `${profile.profession}${profile.company ? ` at ${profile.company}` : ""}` : ""].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {profile.time && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                          <Clock style={{ width: "11px", height: "11px", color: "rgba(26,10,20,0.3)" }} />
                          <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "10px", color: "rgba(26,10,20,0.3)" }}>
                            Sent {profile.time}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      {profile.compatibility > 0 && (
                        <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "13px", fontWeight: 700, color: "#C89020" }}>
                          {profile.compatibility}%
                        </span>
                      )}
                      <Link
                        href={`/profile/${profile.id}`}
                        style={{
                          padding: "6px 14px", borderRadius: "10px",
                          fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", fontWeight: 500,
                          color: "rgba(26,10,20,0.6)", background: "#fff",
                          border: "1px solid rgba(220,30,60,0.12)",
                          textDecoration: "none", transition: "all 0.2s ease",
                        }}
                      >
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Mutual Tab ── */}
          {tab === "mutual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {mutualList.length > 0 && (
                <div
                  style={{
                    background: "rgba(220,30,60,0.04)", border: "1px solid rgba(220,30,60,0.12)",
                    borderRadius: "16px", padding: "14px 16px", marginBottom: "4px",
                  }}
                >
                  <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", color: "#dc1e3c", fontWeight: 500, margin: 0 }}>
                    You both showed interest. Start a conversation!
                  </p>
                </div>
              )}

              {mutualList.length === 0 && (
                <div style={{ textAlign: "center", padding: "64px 0" }}>
                  <Heart style={{ width: "48px", height: "48px", color: "rgba(26,10,20,0.15)", margin: "0 auto 12px" }} />
                  <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", color: "#888" }}>
                    No mutual interests yet. Keep browsing!
                  </p>
                </div>
              )}

              {mutualList.map((profile) => (
                <div
                  key={profile.id}
                  style={{
                    background: "#fff", border: "1px solid rgba(220,30,60,0.12)",
                    borderRadius: "16px", padding: "16px",
                    display: "flex", alignItems: "center", gap: "16px",
                    boxShadow: "0 4px 16px rgba(220,30,60,0.08)",
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      style={{
                        width: "56px", height: "56px", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: profile.grad,
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "17px", fontWeight: 600, color: "#fff" }}>
                        {profile.initials}
                      </span>
                    </div>
                    <div
                      style={{
                        position: "absolute", bottom: "-4px", right: "-4px",
                        width: "20px", height: "20px", borderRadius: "50%",
                        background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                      }}
                    >
                      <Heart style={{ width: "11px", height: "11px", fill: "#dc1e3c", color: "#dc1e3c" }} />
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "15px", fontWeight: 600, color: "#1a0a14" }}>
                      {profile.name}
                    </span>
                    <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", color: "#888", margin: "3px 0 0" }}>
                      {[profile.age > 0 ? String(profile.age) : "", profile.city, profile.profession].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {profile.compatibility > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "5px" }}>
                        <Star style={{ width: "12px", height: "12px", fill: "#C89020", color: "#C89020" }} />
                        <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", fontWeight: 600, color: "#C89020" }}>
                          {profile.compatibility}% compatibility
                        </span>
                      </div>
                    )}
                  </div>

                  <Link
                    href="/messages/1"
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "10px 18px", borderRadius: "10px",
                      fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", fontWeight: 600,
                      background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
                      color: "#fff", textDecoration: "none",
                      boxShadow: "0 4px 16px rgba(220,30,60,0.25)",
                      flexShrink: 0,
                    }}
                  >
                    <MessageCircle style={{ width: "14px", height: "14px" }} />
                    Message
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
