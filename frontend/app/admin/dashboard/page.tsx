"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, UserCheck, Clock, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, TrendingUp, Loader2, RefreshCw,
} from "lucide-react";
import { PageShell, StatCard, Button } from "@/components/admin/PageShell";
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
        <div style={{ padding: 60, textAlign: "center", color: "#999" }}>
          <Loader2 style={{ width: 22, height: 22, animation: "spin 1s linear infinite", margin: "0 auto 10px", display: "block" }} />
          Loading…
        </div>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </PageShell>
    );
  }

  if (error || !stats) {
    return (
      <PageShell title="Dashboard">
        <div style={{ padding: 20, background: "#ffe9ec", color: "#7B2D3A", borderRadius: 10, fontSize: 13 }}>
          <AlertTriangle style={{ width: 16, height: 16, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
          {error || "No data"}
        </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
        <StatCard label="Pending verifications" value={stats.profiles.pending} tone="warn" hint="Awaiting review" />
        <StatCard label="Open reports" value={stats.reports.open} tone={stats.reports.open > 0 ? "bad" : "neutral"} hint="Need admin attention" />
        <StatCard label="Total users" value={stats.users.total.toLocaleString()} hint={`${stats.users.active.toLocaleString()} active`} />
        <StatCard label="New today" value={stats.users.new_today} tone="info" hint={`${stats.users.new_7d} this week · ${stats.users.new_30d} this month`} />
        <StatCard label="Approved profiles" value={stats.profiles.approved} tone="good" />
        <StatCard label="Rejected" value={stats.profiles.rejected} />
        <StatCard label="Suspended users" value={stats.users.suspended} tone={stats.users.suspended > 0 ? "bad" : "neutral"} />
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
        <Link href="/admin/verifications" style={linkBtnStyle(stats.profiles.pending > 0)}>
          <ShieldCheck style={{ width: 14, height: 14 }} /> Review verifications
          {stats.profiles.pending > 0 && <span style={pillStyle}>{stats.profiles.pending}</span>}
        </Link>
        <Link href="/admin/reports" style={linkBtnStyle(stats.reports.open > 0, "bad")}>
          <AlertTriangle style={{ width: 14, height: 14 }} /> Handle reports
          {stats.reports.open > 0 && <span style={pillStyle}>{stats.reports.open}</span>}
        </Link>
        <Link href="/admin/users" style={linkBtnStyle(false)}>
          <Users style={{ width: 14, height: 14 }} /> Manage users
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>

        {/* Registration trend */}
        <Card title="Registrations · last 14 days" icon={TrendingUp}>
          {stats.registration_trend.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa" }}>No data yet.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, paddingTop: 10 }}>
              {stats.registration_trend.map((d) => (
                <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    height: `${(d.count / maxDay) * 100}px`,
                    width: "100%",
                    minHeight: 2,
                    background: "linear-gradient(to top, #dc1e3c, #ff7a9a)",
                    borderRadius: 3,
                    position: "relative",
                  }} title={`${d.date}: ${d.count}`}>
                    {d.count > 0 && (
                      <span style={{
                        position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                        fontSize: 10, fontWeight: 600, color: "#555",
                      }}>{d.count}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 9, color: "#bbb" }}>
                    {new Date(d.date).getDate()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Religion distribution */}
        <Card title="Religion distribution" icon={Users}>
          {stats.religion_distribution.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa" }}>No data yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stats.religion_distribution.map((r) => {
                const pct = totalRelig > 0 ? (r.count / totalRelig) * 100 : 0;
                return (
                  <div key={r.religion}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555", marginBottom: 3 }}>
                      <span style={{ textTransform: "capitalize" }}>{r.religion}</span>
                      <span style={{ color: "#888" }}>{r.count} · {pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#dc1e3c,#a0153c)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <div style={{ marginTop: 16 }}>
        <Card title="Recent verification activity" icon={Clock}>
          {stats.recent_activity.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa" }}>No activity yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {stats.recent_activity.map((a) => (
                <Link
                  key={a.user_id + (a.reviewed_at || a.submitted_at || "")}
                  href="/admin/verifications"
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px", borderRadius: 8, textDecoration: "none", color: "inherit",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.background = "rgba(220,30,60,0.04)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.background = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ActivityIcon status={a.status} />
                    <div>
                      <div style={{ fontSize: 13, color: "#1a0a14", fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "#888", textTransform: "capitalize" }}>
                        {a.status.replace(/_/g, " ")}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "#aaa" }}>{formatRel(a.reviewed_at || a.submitted_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </PageShell>
  );
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(220,30,60,0.08)", borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Icon style={{ width: 14, height: 14, color: "#dc1e3c" }} />
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function ActivityIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 style={{ width: 14, height: 14, color: "#5C7A52" }} />;
  if (status === "rejected") return <XCircle style={{ width: 14, height: 14, color: "#dc1e3c" }} />;
  if (status === "submitted") return <Clock style={{ width: 14, height: 14, color: "#9A6B00" }} />;
  return <UserCheck style={{ width: 14, height: 14, color: "#999" }} />;
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

function linkBtnStyle(highlight: boolean, tone: "default" | "bad" = "default"): React.CSSProperties {
  const color = tone === "bad" ? "#dc1e3c" : "#1a0a14";
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 14px", borderRadius: 10,
    background: highlight ? "rgba(220,30,60,0.08)" : "#fff",
    border: "1px solid rgba(220,30,60,0.15)",
    color, fontSize: 13, fontWeight: 600, textDecoration: "none",
  };
}

const pillStyle: React.CSSProperties = {
  background: "#dc1e3c", color: "#fff", fontSize: 11, fontWeight: 700,
  padding: "2px 7px", borderRadius: 999,
};
