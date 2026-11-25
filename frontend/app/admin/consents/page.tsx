"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Download, FileCheck2, Hourglass, Megaphone, ScrollText } from "lucide-react";
import { PageShell, Button, StatCard } from "@/components/admin/PageShell";
import {
  EmptyState, ErrorState, Pagination, Pill, SearchField, Segmented, Select, SkeletonRows,
  TABLE_CARD, TABLE_HEAD, TABLE_ROW, formatDateTime, relTime,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/Toast";
import { CONSENT_STATUS } from "@/components/admin/member/ConsentPanel";
import { errorMessage, humanize } from "@/components/admin/member/shared";
import {
  adminMembersApi, downloadCsv,
  type ConsentEventParams, type ConsentMemberParams, type ConsentMemberStatus, type ConsentType,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Summary = {
  policy_version: string; members_total: number; members_capped: boolean;
  confirmed_current: number; confirmed_rate: number; not_confirmed: number;
  outdated_version: number; incomplete: number; never_recorded: number;
  marketing_opt_in: number; marketing_opt_out: number; marketing_no_answer: number; marketing_opt_in_rate: number;
  events_total: number; events_30d: number; last_event_at: string | null;
  labels: Record<string, string>; versions: Array<{ policy_version: string; events: number }>; sources: string[];
};
type Cell = { granted: boolean; policy_version: string; at: string | null; source: string } | null;
type MemberRow = {
  id: string; name: string; email: string | null; membership_number: string | null; is_active: boolean;
  status: "confirmed" | "outdated" | "incomplete" | "never";
  terms_privacy: Cell; sensitive_data: Cell; marketing_email: Cell; marketing_opt_in: boolean; last_consent_at: string | null;
};
type EventRow = {
  id: string; created_at: string | null; user_id: string; member_name: string; member_email: string | null;
  membership_number: string | null; member_deleted: boolean; consent_type: ConsentType; consent_label: string;
  granted: boolean; policy_version: string; is_current_version: boolean; source: string; ip_address: string | null; user_agent: string | null;
};
type View = "members" | "events";
type Range = "7" | "30" | "365" | "all";

const LIMIT = 50;
const TH = "px-4 py-2.5";

function ConsentCell({ cell, required, current }: { cell: Cell; required: boolean; current: string }) {
  if (!cell) return <span className="text-[12.5px] text-muted2-foreground">No record</span>;
  const old = required && cell.granted && cell.policy_version !== current;
  return (
    <div>
      <Pill tone={!cell.granted ? (required ? "bad" : "neutral") : old ? "warn" : "good"}>
        {cell.granted ? (old ? `Agreed · v${cell.policy_version}` : "Agreed") : required ? "Withdrawn" : "Opted out"}
      </Pill>
      <div className="mt-0.5 text-[11.5px] text-muted2-foreground" title={formatDateTime(cell.at)}>{relTime(cell.at)} · {humanize(cell.source)}</div>
    </div>
  );
}

export default function ConsentsPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [view, setView] = useState<View>("members");
  const [qLive, setQLive] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  // members view
  const [status, setStatus] = useState<ConsentMemberStatus | "">("");
  const [marketing, setMarketing] = useState<"in" | "out" | "none" | "">("");
  // events view
  const [ctype, setCtype] = useState<ConsentType | "">("");
  const [decision, setDecision] = useState<"" | "granted" | "withdrawn">("");
  const [version, setVersion] = useState("");
  const [source, setSource] = useState("");
  const [range, setRange] = useState<Range>("all");

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQ(qLive.trim()), 250); return () => clearTimeout(t); }, [qLive]);
  useEffect(() => { setPage(1); }, [view, q, status, marketing, ctype, decision, version, source, range]);

  const loadSummary = useCallback(async () => {
    setSummaryError(null);
    try {
      const res = await adminMembersApi.consentSummary();
      setSummary((res.data as any)?.data || null);
    } catch (e) { setSummaryError(errorMessage(e, "Couldn't load the consent summary")); }
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const memberParams: ConsentMemberParams = useMemo(() => ({ status, marketing, q: q || undefined }), [status, marketing, q]);
  const eventParams: ConsentEventParams = useMemo(() => ({
    consent_type: ctype, granted: decision === "" ? undefined : decision === "granted",
    version: version || undefined, source: source || undefined, q: q || undefined,
    days: range === "all" ? undefined : Number(range),
  }), [ctype, decision, version, source, q, range]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = view === "members"
        ? await adminMembersApi.consentMembers({ ...memberParams, page, limit: LIMIT })
        : await adminMembersApi.consentEvents({ ...eventParams, page, limit: LIMIT });
      const p = res.data as any;
      const rows = Array.isArray(p?.data) ? p.data : [];
      if (view === "members") setMembers(rows); else setEvents(rows);
      setTotal(typeof p?.total === "number" ? p.total : 0);
    } catch (e) { setError(errorMessage(e, "Couldn't load consent records")); }
    finally { setLoading(false); }
  }, [view, memberParams, eventParams, page]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    const day = new Date().toISOString().slice(0, 10);
    try {
      if (view === "members") await downloadCsv(adminMembersApi.exportConsentMembersCsvUrl(memberParams), `consent-status-${day}.csv`);
      else await downloadCsv(adminMembersApi.exportConsentEventsCsvUrl(eventParams), `consent-log-${day}.csv`);
      toast("success", "Export downloaded. Exports are recorded in the audit log.");
    } catch (e) { toast("error", errorMessage(e, "Export failed")); }
    finally { setExporting(false); }
  };

  const filtersActive = view === "members" ? !!(status || marketing || q) : !!(ctype || decision || version || source || q || range !== "all");
  const reset = () => { setStatus(""); setMarketing(""); setCtype(""); setDecision(""); setVersion(""); setSource(""); setRange("all"); setQLive(""); };
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const s = summary;
  const rowsEmpty = view === "members" ? members.length === 0 : events.length === 0;

  return (
    <PageShell
      title="Consents"
      subtitle="The bureau's record of what each member agreed to, when and where — your UK GDPR proof of consent."
      meta={s ? <Pill tone="info">Policy version {s.policy_version}</Pill> : undefined}
      actions={
        <Button size="sm" onClick={exportCsv} loading={exporting} disabled={total === 0}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export {view === "members" ? "member status" : "consent log"} CSV
        </Button>
      }
    >
      {summaryError && <ErrorState compact message={summaryError} onRetry={loadSummary} className="mb-4" />}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Confirmed the current policy" icon={BadgeCheck} tone="good"
          value={s ? s.confirmed_current : "—"}
          hint={s ? `${s.confirmed_rate}% of ${s.members_total.toLocaleString("en-GB")} members` : undefined}
          onClick={() => { setView("members"); setStatus("confirmed"); }}
        />
        <StatCard
          label="Still to confirm" icon={Hourglass} tone={s && s.not_confirmed > 0 ? "warn" : "neutral"}
          value={s ? s.not_confirmed : "—"}
          hint={s ? `${s.outdated_version} on an older version · ${s.incomplete} missing or withdrawn · ${s.never_recorded} never asked` : undefined}
          onClick={() => { setView("members"); setStatus("not_confirmed"); }}
        />
        <StatCard
          label="Marketing opt-in rate" icon={Megaphone} tone="info"
          value={s ? `${s.marketing_opt_in_rate}%` : "—"}
          hint={s ? `${s.marketing_opt_in} in · ${s.marketing_opt_out} out · ${s.marketing_no_answer} no answer` : undefined}
          onClick={() => { setView("members"); setMarketing("in"); }}
        />
        <StatCard
          label="Decisions on record" icon={ScrollText}
          value={s ? s.events_total : "—"}
          hint={s ? `${s.events_30d} in the last 30 days${s.last_event_at ? ` · latest ${relTime(s.last_event_at)}` : ""}` : undefined}
          onClick={() => setView("events")}
        />
      </div>

      {s?.members_capped && (
        <p className="adm-soft-warn mb-4 rounded-lg border px-3 py-2 text-[12.5px]">
          These figures cover the newest {s.members_total.toLocaleString("en-GB")} members only. Use the CSV exports for the full register.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented<View>
          layoutId="consent-view" ariaLabel="View" size="sm" value={view} onChange={setView}
          options={[{ value: "members", label: "By member" }, { value: "events", label: "Consent log" }]}
        />
        {view === "members" ? (
          <>
            <Select size="sm" ariaLabel="Consent status" value={status} onChange={(v) => setStatus(v as ConsentMemberStatus | "")}>
              <option value="">Any status</option>
              <option value="confirmed">Up to date</option>
              <option value="not_confirmed">Not up to date (all)</option>
              <option value="outdated">Older policy version</option>
              <option value="incomplete">Missing or withdrawn</option>
              <option value="never">Nothing on record</option>
            </Select>
            <Select size="sm" ariaLabel="Marketing emails" value={marketing} onChange={(v) => setMarketing(v as "in" | "out" | "none" | "")}>
              <option value="">Marketing: any</option>
              <option value="in">Opted in</option>
              <option value="out">Opted out</option>
              <option value="none">No answer</option>
            </Select>
          </>
        ) : (
          <>
            <Segmented<Range>
              layoutId="consent-range" ariaLabel="Time range" size="sm" value={range} onChange={setRange}
              options={[{ value: "7", label: "7d" }, { value: "30", label: "30d" }, { value: "365", label: "1y" }, { value: "all", label: "All time" }]}
            />
            <Select size="sm" ariaLabel="Consent type" value={ctype} onChange={(v) => setCtype(v as ConsentType | "")}>
              <option value="">All consent types</option>
              <option value="terms_privacy">Terms & Privacy Policy</option>
              <option value="sensitive_data">Sensitive data</option>
              <option value="marketing_email">Marketing emails</option>
            </Select>
            <Select size="sm" ariaLabel="Decision" value={decision} onChange={(v) => setDecision(v as "" | "granted" | "withdrawn")}>
              <option value="">Granted & withdrawn</option>
              <option value="granted">Granted</option>
              <option value="withdrawn">Withdrawn</option>
            </Select>
            <Select size="sm" ariaLabel="Policy version" value={version} onChange={setVersion}>
              <option value="">Any version</option>
              <option value="current">Current version</option>
              <option value="older">Older versions</option>
              {(s?.versions || []).map((v) => <option key={v.policy_version} value={v.policy_version}>v{v.policy_version} ({v.events})</option>)}
            </Select>
            <Select size="sm" ariaLabel="Where it was given" value={source} onChange={setSource}>
              <option value="">Any source</option>
              {(s?.sources || ["signup", "reconsent_prompt", "settings"]).map((x) => <option key={x} value={x}>{humanize(x)}</option>)}
            </Select>
          </>
        )}
        <SearchField value={qLive} onChange={setQLive} placeholder="Search name, email or member no.…" className="w-full sm:w-64" />
        {filtersActive && <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>}
      </div>

      <section className={TABLE_CARD}>
        {loading && rowsEmpty ? (
          <div className="p-3"><SkeletonRows rows={8} /></div>
        ) : error ? (
          <ErrorState title="Couldn't load consent records" message={error} onRetry={load} />
        ) : rowsEmpty ? (
          <EmptyState
            icon={FileCheck2}
            title={filtersActive ? "Nothing matches these filters" : view === "members" ? "No members yet" : "No consent decisions recorded yet"}
            description={filtersActive ? "Clear a filter or widen the time range." : "Decisions are recorded when members sign up, answer the re-consent prompt or change their settings."}
            action={filtersActive ? <Button size="sm" onClick={reset}>Clear filters</Button> : undefined}
          />
        ) : view === "members" ? (
          <div className="overflow-x-auto" data-admin-scroll>
            <table className={cn("w-full min-w-[860px] border-collapse", loading && "opacity-60")}>
              <thead>
                <tr className={TABLE_HEAD}>
                  <th scope="col" className={TH}>Member</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={TH}>Terms & Privacy</th>
                  <th scope="col" className={TH}>Sensitive data</th>
                  <th scope="col" className={TH}>Marketing emails</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className={cn(TABLE_ROW, "align-top")}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${m.id}#member-consents`} className="text-[13px] font-medium text-foreground underline-offset-2 hover:underline">{m.name}</Link>
                      <div className="text-[11.5px] text-muted2-foreground">{[m.membership_number, m.email].filter(Boolean).join(" · ") || "—"}{!m.is_active && " · inactive"}</div>
                    </td>
                    <td className="px-4 py-3"><Pill tone={CONSENT_STATUS[m.status].tone} dot>{CONSENT_STATUS[m.status].label}</Pill></td>
                    <td className="px-4 py-3"><ConsentCell cell={m.terms_privacy} required current={s?.policy_version || ""} /></td>
                    <td className="px-4 py-3"><ConsentCell cell={m.sensitive_data} required current={s?.policy_version || ""} /></td>
                    <td className="px-4 py-3"><ConsentCell cell={m.marketing_email} required={false} current={s?.policy_version || ""} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto" data-admin-scroll>
            <table className={cn("w-full min-w-[900px] border-collapse", loading && "opacity-60")}>
              <thead>
                <tr className={TABLE_HEAD}>
                  <th scope="col" className={TH}>When</th>
                  <th scope="col" className={TH}>Member</th>
                  <th scope="col" className={TH}>Consent</th>
                  <th scope="col" className={TH}>Decision</th>
                  <th scope="col" className={TH}>Policy version</th>
                  <th scope="col" className={TH}>Where</th>
                  <th scope="col" className={TH}>IP address</th>
                </tr>
              </thead>
              <tbody>
                {events.map((r) => (
                  <tr key={r.id} className={cn(TABLE_ROW, "align-top")}>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px]">
                      <span className="text-foreground">{relTime(r.created_at)}</span>
                      <div className="text-[11.5px] tabular-nums text-muted2-foreground">{formatDateTime(r.created_at)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.member_deleted
                        ? <span className="text-[13px] text-muted2-foreground">{r.member_name} · deleted</span>
                        : <Link href={`/admin/users/${r.user_id}#member-consents`} className="text-[13px] font-medium text-foreground underline-offset-2 hover:underline">{r.member_name}</Link>}
                      <div className="text-[11.5px] text-muted2-foreground">{[r.membership_number, r.member_email].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-foreground">{r.consent_label}</td>
                    <td className="px-4 py-3"><Pill tone={r.granted ? "good" : "bad"}>{r.granted ? "Granted" : "Withdrawn"}</Pill></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] tabular-nums text-foreground">
                      {r.policy_version}{!r.is_current_version && <span className="ml-1.5 text-muted2-foreground">older</span>}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-muted2-foreground">{humanize(r.source)}</td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-muted2-foreground" title={r.user_agent || undefined}>{r.ip_address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > LIMIT && <Pagination page={page} pageCount={pages} onPage={setPage} total={total} pageSize={LIMIT} />}
      </section>
    </PageShell>
  );
}
