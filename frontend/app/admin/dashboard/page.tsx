"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users, UserCheck, Clock, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, TrendingUp, RefreshCw, ChevronRight,
} from "lucide-react";
import { PageShell, StatCard, Button, GlassCard, fadeUp } from "@/components/admin/PageShell";
import { adminApi, ApiError } from "@/lib/api";

interface Stats {
  users: { total: number; active: number; suspended: number; new_today: number; new_7d: number; new_30d: number };
  profiles: { pending: number; approved: number; rejected: number };
  reports: { open: number };
  registration_trend: Array<{ date: string; count: number }>;
  religion_distribution: Array<{ religion: string; count: number }>;
  recent_activity: Array<{ user_id: string; name: string; status: string; submitted_at: string | null; reviewed_at: string | null }>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await adminApi.getStats();
      setStats((res.data as any)?.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <PageShell title="Dashboard">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="m4m-shimmer" style={{ height: 110 }} />
          ))}
        </div>
      </PageShell>
    );
  }

  if (error || !stats) {
    return (
      <PageShell title="Dashboard">
        <GlassCard>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#a0153c" }}>
            <AlertTriangle style={{ width: 16, height: 16, marginTop: 2 }} />
            <span style={{ fontSize: 13 }}>{error || "No data"}</span>
          </div>
        </GlassCard>
      </PageShell>
    );
  }

  const maxDay = Math.max(1, ...stats.registration_trend.map((d) => d.count));
  const totalRelig = stats.religion_distribution.reduce((s, x) => s + x.count, 0);

  return (
    <PageShell
      title="Dashboard"
      subtitle="What's happening on your platform right now."
      actions={
        <Button onClick={refresh} variant="secondary">
          <RefreshCw style={{ width: 13, height: 13, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </Button>
      }
    >
      {/* KPI grid */}
      <motion.div
        variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}
      >
        <StatCard label="Pending verifications" value={stats.profiles.pending} tone="warn" hint="Awaiting review" />
        <StatCard label="Open reports" value={stats.reports.open} tone={stats.reports.open > 0 ? "bad" : "neutral"} hint="Need admin attention" />
        <StatCard label="Total users" value={stats.users.total} hint={`${stats.users.active.toLocaleString()} active`} />
        <StatCard label="New today" value={stats.users.new_today} tone="info" hint={`${stats.users.new_7d} this week · ${stats.users.new_30d} this month`} />
        <StatCard label="Approved profiles" value={stats.profiles.approved} tone="good" />
        <StatCard label="Rejected" value={stats.profiles.rejected} />
        <StatCard label="Suspended" value={stats.users.suspended} tone={stats.users.suspended > 0 ? "bad" : "neutral"} />
      </motion.div>

      {/* Quick actions */}
      <motion.div
        variants={fadeUp}
        style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}
      >
        <ActionLink href="/admin/verifications" icon={ShieldCheck} label="Review verifications" count={stats.profiles.pending} highlight={stats.profiles.pending > 0} />
        <ActionLink href="/admin/reports" icon={AlertTriangle} label="Handle reports" count={stats.reports.open} highlight={stats.reports.open > 0} tone="bad" />
        <ActionLink href="/admin/users" icon={Users} label="Manage users" />
      </motion.div>

      <motion.div
        variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", gap: 16, alignItems: "start" }}
        className="dashboard-grid"
      >
        {/* Registration trend */}
        <GlassCard padding={20}>
          <SectionHead icon={TrendingUp} title="Registrations · last 14 days" />
          {stats.registration_trend.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>No data yet.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, paddingTop: 24 }}>
              {stats.registration_trend.map((d, i) => (
                <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: `${(d.count / maxDay) * 100}px`, opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.03, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      width: "100%", minHeight: 2,
                      background: "linear-gradient(to top, #a0153c, #ff7a9a)",
                      borderRadius: 4,
                      position: "relative",
                      boxShadow: "0 2px 8px rgba(220,30,60,0.18)",
                    }}
                    title={`${d.date}: ${d.count}`}
                  >
                    {d.count > 0 && (
                      <span style={{
                        position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
                        fontSize: 10, fontWeight: 700, color: "#666",
                      }}>{d.count}</span>
                    )}
                  </motion.div>
                  <span style={{ fontSize: 9, color: "#bbb", fontWeight: 500 }}>
                    {new Date(d.date).getDate()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Religion distribution */}
        <GlassCard padding={20}>
          <SectionHead icon={Users} title="Religion distribution" />
          {stats.religion_distribution.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>No data yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stats.religion_distribution.map((r, i) => {
                const pct = totalRelig > 0 ? (r.count / totalRelig) * 100 : 0;
                return (
                  <div key={r.religion}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ textTransform: "capitalize", color: "#444", fontWeight: 500 }}>{r.religion}</span>
                      <span style={{ color: "#888" }}>
                        <span style={{ fontWeight: 600, color: "#1a0a14" }}>{r.count}</span>
                        <span style={{ marginLeft: 6, fontSize: 11 }}>{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div style={{ height: 7, background: "rgba(0,0,0,0.05)", borderRadius: 4, overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.3 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                          height: "100%",
                          background: "linear-gradient(90deg, #dc1e3c, #a0153c)",
                          borderRadius: 4,
                          boxShadow: "0 2px 8px rgba(220,30,60,0.22)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Recent activity */}
      <motion.div variants={fadeUp} style={{ marginTop: 16 }}>
        <GlassCard padding={20}>
          <SectionHead icon={Clock} title="Recent verification activity" />
          {stats.recent_activity.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>No activity yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {stats.recent_activity.map((a, i) => (
                <motion.div
                  key={a.user_id + (a.reviewed_at || a.submitted_at || "")}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.03, duration: 0.3 }}
                >
                  <Link
                    href="/admin/verifications"
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 12px", borderRadius: 10, textDecoration: "none", color: "inherit",
                      transition: "background 0.15s, transform 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = "rgba(220,30,60,0.04)";
                      el.style.transform = "translateX(3px)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = "transparent";
                      el.style.transform = "translateX(0)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <ActivityIcon status={a.status} />
                      <div>
                        <div style={{ fontSize: 13, color: "#1a0a14", fontWeight: 500 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "#888", textTransform: "capitalize" }}>
                          {a.status.replace(/_/g, " ")}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaa", fontSize: 12 }}>
                      {formatRel(a.reviewed_at || a.submitted_at)}
                      <ChevronRight style={{ width: 13, height: 13 }} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          :global(.dashboard-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

function SectionHead({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8,
        background: "rgba(220,30,60,0.08)",
        display: "grid", placeItems: "center",
      }}>
        <Icon style={{ width: 13, height: 13, color: "#dc1e3c" }} />
      </div>
      <h3 style={{
        fontSize: 12, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "#555", margin: 0,
      }}>{title}</h3>
    </div>
  );
}

function ActionLink({ href, icon: Icon, label, count, highlight, tone = "default" }: {
  href: string; icon: any; label: string; count?: number; highlight?: boolean; tone?: "default" | "bad";
}) {
  const accent = tone === "bad" ? "#dc1e3c" : "#1a0a14";
  return (
    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}>
      <Link
        href={href}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 12,
          background: highlight
            ? "linear-gradient(135deg, rgba(220,30,60,0.1), rgba(220,30,60,0.04))"
            : "rgba(255,255,255,0.8)",
          border: `1px solid ${highlight ? "rgba(220,30,60,0.2)" : "rgba(220,30,60,0.1)"}`,
          color: accent, fontSize: 13, fontWeight: 600, textDecoration: "none",
          backdropFilter: "blur(6px)",
          boxShadow: highlight ? "0 4px 14px rgba(220,30,60,0.15)" : "none",
          transition: "box-shadow 0.2s",
        }}
      >
        <Icon style={{ width: 14, height: 14 }} /> {label}
        {count !== undefined && count > 0 && (
          <span style={{
            background: "#dc1e3c", color: "#fff", fontSize: 11, fontWeight: 700,
            padding: "2px 8px", borderRadius: 999, minWidth: 22, textAlign: "center",
          }}>{count}</span>
        )}
      </Link>
    </motion.div>
  );
}

function ActivityIcon({ status }: { status: string }) {
  const map: Record<string, { icon: any; color: string; bg: string }> = {
    approved:  { icon: CheckCircle2, color: "#5C7A52", bg: "rgba(92,122,82,0.12)" },
    rejected:  { icon: XCircle,      color: "#dc1e3c", bg: "rgba(220,30,60,0.08)" },
    submitted: { icon: Clock,        color: "#9A6B00", bg: "rgba(200,144,32,0.12)" },
  };
  const s = map[status] || { icon: UserCheck, color: "#999", bg: "rgba(0,0,0,0.05)" };
  const Icon = s.icon;
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 10,
      background: s.bg, display: "grid", placeItems: "center",
    }}>
      <Icon style={{ width: 14, height: 14, color: s.color }} />
    </div>
  );
}

function formatRel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
