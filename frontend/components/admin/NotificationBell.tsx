"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell, ShieldCheck, Flag, CreditCard, UserPlus, CheckCircle2,
  Loader2, ArrowRight,
} from "lucide-react";
import { adminApi } from "@/lib/api";

/**
 * Admin notification bell. There's no dedicated admin-notifications table, so we
 * synthesise an actionable feed from the same /admin/stats payload the dashboard
 * already uses: profiles awaiting verification, open reports, and upcoming
 * renewals. Each item deep-links to the page where the admin acts on it.
 *
 * The badge count = number of things genuinely needing attention. When nothing
 * needs attention the dot disappears and the panel reads "All caught up".
 */

type AdminNotif = {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
  href: string;
  cta: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function deriveNotifs(stats: any): AdminNotif[] {
  const items: AdminNotif[] = [];

  const pending = stats?.profiles?.pending ?? 0;
  if (pending > 0) {
    items.push({
      id: "pending-verifications",
      icon: <ShieldCheck className="w-4 h-4" />,
      iconBg: "bg-amber-50", iconFg: "text-amber-600",
      title: `${pending} profile${pending === 1 ? "" : "s"} awaiting verification`,
      body: "Review and approve members so they appear in Browse.",
      href: "/admin/verifications",
      cta: "Review queue",
    });
  }

  const openReports = stats?.reports?.open ?? 0;
  if (openReports > 0) {
    items.push({
      id: "open-reports",
      icon: <Flag className="w-4 h-4" />,
      iconBg: "bg-rose-50", iconFg: "text-rose-600",
      title: `${openReports} open report${openReports === 1 ? "" : "s"} need attention`,
      body: "Members have flagged content or behaviour for review.",
      href: "/admin/reports",
      cta: "Open reports",
    });
  }

  const renewals: any[] = Array.isArray(stats?.renewals_due) ? stats.renewals_due : [];
  if (renewals.length > 0) {
    items.push({
      id: "renewals-due",
      icon: <CreditCard className="w-4 h-4" />,
      iconBg: "bg-emerald-50", iconFg: "text-emerald-600",
      title: `${renewals.length} subscription${renewals.length === 1 ? "" : "s"} renewing soon`,
      body: "Renewals due within 14 days — follow up to reduce churn.",
      href: "/admin/subscriptions",
      cta: "View renewals",
    });
  }

  // Recently submitted profiles (last few) — a lightweight activity feed so the
  // panel still has signal even when the queue count is small.
  const recent: any[] = Array.isArray(stats?.recent_activity) ? stats.recent_activity : [];
  recent
    .filter((a) => a?.status === "submitted")
    .slice(0, 4)
    .forEach((a, i) => {
      items.push({
        id: `recent-${a.user_id ?? i}`,
        icon: <UserPlus className="w-4 h-4" />,
        iconBg: "bg-sky-50", iconFg: "text-sky-600",
        title: `${a.name || "A member"} submitted their profile`,
        body: a.submitted_at ? `Submitted ${timeAgo(a.submitted_at)}.` : "Awaiting your review.",
        href: "/admin/verifications",
        cta: "Review",
      });
    });

  return items;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // The badge count drives whether the dot shows — derived from the same data,
  // but the verification/report/renewal summary rows are what counts as "needs
  // attention" (recent-activity rows are informational, not a backlog).
  const attentionCount = useMemo(
    () => notifs.filter((n) => n.id === "pending-verifications" || n.id === "open-reports" || n.id === "renewals-due").length,
    [notifs],
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getStats();
      const stats = (res.data as any)?.data ?? res.data;
      setNotifs(deriveNotifs(stats));
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  // Fetch once on mount so the badge is accurate before the panel is opened.
  useEffect(() => { load(); }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load(); // refresh on open so counts are live
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-md hover:bg-secondary grid place-items-center text-foreground/70 hover:text-foreground transition-colors relative"
        title="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {attentionCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center leading-none">
            {attentionCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover shadow-xl overflow-hidden z-50"
          role="menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">Notifications</span>
              {attentionCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  {attentionCount} need attention
                </span>
              )}
            </div>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted2-foreground" />}
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto">
            {!loaded && loading && (
              <div className="px-4 py-10 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted2-foreground mx-auto" />
              </div>
            )}

            {loaded && notifs.length === 0 && (
              <div className="px-4 py-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/70 mx-auto mb-2" />
                <p className="text-[13px] font-medium text-foreground">You're all caught up</p>
                <p className="text-[12px] text-muted2-foreground mt-0.5">
                  No verifications, reports, or renewals need attention.
                </p>
              </div>
            )}

            {notifs.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors border-b border-border/60 last:border-b-0"
                role="menuitem"
              >
                <span className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center ${n.iconBg} ${n.iconFg}`}>
                  {n.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground leading-snug">{n.title}</p>
                  <p className="text-[12px] text-muted2-foreground mt-0.5 leading-snug">{n.body}</p>
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-primary">
                    {n.cta} <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-secondary/30">
            <Link
              href="/admin/dashboard"
              onClick={() => setOpen(false)}
              className="text-[12px] font-medium text-muted2-foreground hover:text-foreground transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
