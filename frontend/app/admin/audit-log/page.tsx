"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Download, ScrollText,
} from "lucide-react";
import { PageShell, Button } from "@/components/admin/PageShell";
import {
  EmptyState, Pill, SearchField, Segmented, SkeletonRows, formatDateTime, relTime, type Tone,
} from "@/components/admin/primitives";
import { ACTION_GROUPS, describeAction } from "@/components/admin/audit-labels";
import { adminOpsApi, ApiError, downloadCsv, type AuditLogParams } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";
import { cn } from "@/lib/utils";

type Row = {
  id: string; created_at: string | null; actor_id: string | null; actor_email: string | null;
  action: string; target_type: string | null; target_id: string | null; target_label: string | null;
  summary: string | null; details: Record<string, unknown>;
};
type Range = "1" | "7" | "30" | "all";

const LIMIT = 50;

function toneFor(action: string): Tone {
  if (action.endsWith(".approve") || action.endsWith(".activate") || action.endsWith(".restore") || action === "report.resolved") return "good";
  if (action.endsWith(".reject") || action.endsWith(".suspend") || action.endsWith(".delete") || action.endsWith(".revoke") || action.startsWith("user.bulk_suspend")) return "bad";
  if (action.startsWith("match.")) return "brand";
  if (action.startsWith("pricing.") || action.startsWith("settings.") || action.startsWith("admin.")) return "info";
  return "neutral";
}

function targetHref(r: Row): string | null {
  if (!r.target_id) return null;
  if (r.target_type === "user") return `/admin/users/${r.target_id}`;
  if (r.target_type === "pricing_plan") return "/admin/pricing";
  if (r.target_type === "report") return "/admin/reports";
  if (r.target_type === "settings") return "/admin/settings";
  return null;
}

export default function AuditLogPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("30");
  const [group, setGroup] = useState("");
  const [actor, setActor] = useState("");
  const [qLive, setQLive] = useState("");
  const [q, setQ] = useState("");
  const [actors, setActors] = useState<Array<{ email: string; count: number }>>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQ(qLive.trim()), 250); return () => clearTimeout(t); }, [qLive]);
  useEffect(() => { setPage(1); }, [range, group, actor, q]);

  useEffect(() => {
    adminOpsApi.auditLogFacets()
      .then((res) => setActors(((res.data as any)?.data?.actors) || []))
      .catch(() => { /* facets are optional */ });
  }, []);

  const params: AuditLogParams = useMemo(() => ({
    action: group || undefined,
    actor: actor || undefined,
    q: q || undefined,
    days: range === "all" ? undefined : Number(range),
  }), [group, actor, q, range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminOpsApi.auditLog({ ...params, page, limit: LIMIT });
      const p = res.data as any;
      setRows(Array.isArray(p?.data) ? p.data : []);
      setTotal(typeof p?.total === "number" ? p.total : 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load the audit log");
    } finally {
      setLoading(false);
    }
  }, [params, page]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadCsv(adminOpsApi.exportAuditLogCsvUrl(params), `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Export failed");
    } finally { setExporting(false); }
  };

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const filtersActive = !!(group || actor || q || range !== "30");

  return (
    <PageShell
      title="Audit log"
      subtitle="Every consequential admin action — who did what, to whom, and when."
      meta={!loading && total > 0 ? <Pill>{total.toLocaleString("en-GB")} events</Pill> : undefined}
      actions={
        <Button size="sm" onClick={exportCsv} loading={exporting} disabled={total === 0}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Range>
            layoutId="audit-range" ariaLabel="Time range" size="sm"
            value={range} onChange={setRange}
            options={[{ value: "1", label: "24h" }, { value: "7", label: "7d" }, { value: "30", label: "30d" }, { value: "all", label: "All time" }]}
          />
          <label className="sr-only" htmlFor="audit-group">Category</label>
          <select
            id="audit-group" value={group} onChange={(e) => setGroup(e.target.value)}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="">All categories</option>
            {ACTION_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="audit-actor">Admin</label>
          <select
            id="audit-actor" value={actor} onChange={(e) => setActor(e.target.value)}
            className="h-8 max-w-[220px] rounded-lg border border-border bg-card px-2.5 text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="">All admins</option>
            {actors.map((a) => <option key={a.email} value={a.email}>{a.email} ({a.count})</option>)}
          </select>
          <SearchField value={qLive} onChange={setQLive} placeholder="Search member, plan or note…" className="w-full sm:w-64" />
          {filtersActive && (
            <Button size="sm" variant="ghost" onClick={() => { setGroup(""); setActor(""); setQLive(""); setRange("30"); }}>Reset</Button>
          )}
        </div>
      }
    >
      <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(26,10,20,0.04)]">
        {loading && rows.length === 0 ? (
          <div className="p-3"><SkeletonRows rows={8} /></div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load the audit log" description={error} action={<Button size="sm" onClick={load}>Try again</Button>} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={filtersActive ? "No events match these filters" : "No admin actions recorded yet"}
            description={filtersActive ? "Widen the time range or clear the filters." : "Approvals, suspensions, pricing and settings changes, admin grants and introductions are recorded here from now on."}
          />
        ) : (
          <div className="overflow-x-auto" data-admin-scroll>
            <table className={cn("w-full min-w-[760px] border-collapse", loading && "opacity-60")}>
              <thead>
                <tr className="border-b border-border/60 bg-secondary/40 text-left text-[11.5px] font-medium text-muted2-foreground">
                  <th scope="col" className="px-4 py-2.5 w-[150px]">When</th>
                  <th scope="col" className="px-4 py-2.5 w-[200px]">Admin</th>
                  <th scope="col" className="px-4 py-2.5">Action</th>
                  <th scope="col" className="px-4 py-2.5 w-10"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const href = targetHref(r);
                  const open = expanded === r.id;
                  const hasDetails = Object.keys(r.details || {}).length > 0 || !!r.summary;
                  return (
                    <Fragment key={r.id}>
                      <tr className={cn("border-b border-border/40 align-top transition-colors", open ? "bg-secondary/40" : "hover:bg-secondary/30")}>
                        <td className="px-4 py-3 text-[12.5px]">
                          <span className="text-foreground" title={formatDateTime(r.created_at)}>{relTime(r.created_at)}</span>
                          <div className="text-[11.5px] tabular-nums text-muted2-foreground">{formatDateTime(r.created_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-[13px]">
                          <button type="button" onClick={() => setActor(r.actor_email || "")} disabled={!r.actor_email}
                            className="max-w-[180px] truncate text-left text-foreground hover:underline disabled:no-underline" title={r.actor_email ? `Filter by ${r.actor_email}` : undefined}>
                            {r.actor_email || "Unknown admin"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 text-[13px]">
                            <Pill tone={toneFor(r.action)}>{r.action}</Pill>
                            <span className="text-muted2-foreground">{describeAction(r.action)}</span>
                            {r.target_label && (href
                              ? <Link href={href} className="font-medium text-foreground hover:underline">{r.target_label}</Link>
                              : <span className="font-medium text-foreground">{r.target_label}</span>)}
                          </div>
                          {r.summary && <p className="mt-1 line-clamp-2 text-[12.5px] text-muted2-foreground">“{r.summary}”</p>}
                        </td>
                        <td className="px-2 py-2.5">
                          {hasDetails && (
                            <button
                              type="button"
                              onClick={() => setExpanded(open ? null : r.id)}
                              aria-expanded={open}
                              aria-label={open ? "Hide details" : "Show details"}
                              className="grid h-7 w-7 place-items-center rounded-md text-muted2-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            >
                              <ChevronDown className={cn("h-4 w-4 transition-transform duration-150", open && "rotate-180")} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-border/40 bg-secondary/40">
                          <td colSpan={4} className="px-4 pb-4 pt-1">
                            <DetailGrid row={r} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > LIMIT && (
          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5 text-[12px] text-muted2-foreground">
            <span className="tabular-nums">{(page - 1) * LIMIT + 1}–{Math.min(total, page * LIMIT)} of {total.toLocaleString("en-GB")}</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="grid h-7 w-7 place-items-center rounded-md text-foreground hover:bg-secondary disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2 tabular-nums">Page {page} of {pages}</span>
              <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="grid h-7 w-7 place-items-center rounded-md text-foreground hover:bg-secondary disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function DetailGrid({ row }: { row: Row }) {
  const entries = Object.entries(row.details || {});
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
        <Item label="Event id" value={row.id} mono />
        {row.target_type && <Item label="Target type" value={row.target_type} />}
        {row.target_id && <Item label="Target id" value={row.target_id} mono />}
        {entries.map(([k, v]) => (
          <Item
            key={k}
            label={k.replace(/_/g, " ")}
            value={Array.isArray(v) ? v.join(", ") : v && typeof v === "object" ? JSON.stringify(v) : v === null || v === undefined ? "—" : String(v)}
          />
        ))}
      </dl>
      {row.summary && <p className="mt-3 border-t border-border/60 pt-2 text-[12.5px] text-foreground">{row.summary}</p>}
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="capitalize text-muted2-foreground">{label}</dt>
      <dd className={cn("break-words text-foreground", mono && "font-mono text-[11.5px]")}>{value}</dd>
    </div>
  );
}
