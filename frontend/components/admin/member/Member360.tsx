"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Download, Heart, Inbox, Lock, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { adminMembersApi, downloadJson } from "@/lib/api";
import { Button } from "@/components/admin/PageShell";
import {
  EmptyState, ErrorState, Panel, Pill, Segmented, SkeletonRows, TABLE_HEAD, TABLE_ROW,
  formatDate, formatDateTime, relTime,
} from "@/components/admin/primitives";
import { describeAction } from "@/components/admin/audit-labels";
import { useToast } from "@/components/admin/Toast";
import { Count, Fact, FactGrid, errorMessage, humanize, money, statusTone } from "./shared";

type Person = { id: string; name: string; membership_number: string | null; is_deleted: boolean };
type InterestRow = { id: string; member: Person; status: string; is_super_interest: boolean; created_at: string | null; responded_at: string | null };
type Side = { total: number; by_status: Record<string, number>; items: InterestRow[] };
type SubRow = {
  id: string; plan: string; plan_label: string; status: string; gateway: string | null; reference: string | null;
  amount_pence: number; currency: string; period_start: string | null; period_end: string | null; created_at: string | null;
  recorded_by: string | null; payment_method: string | null; payment_reference: string | null; reason: string | null;
};
export type Overview = {
  user_id: string; name: string;
  account: {
    state: "active" | "suspended" | "deactivated" | "deleted"; created_at: string | null; last_active_at: string | null;
    is_email_verified: boolean; is_phone_verified: boolean; is_profile_complete: boolean; deleted_at: string | null;
    membership_number: string | null; sign_in_methods: number; profile_updated_at: string | null; completeness_score: number;
    deactivation: { at: string | null; by: string | null; reason: string | null } | null;
    deletion: { at: string | null; by: string | null; reason: string | null; email_masked: string | null; phone_masked: string | null } | null;
    last_seen: { label: string; at: string } | null;
  };
  interests: { sent: Side; received: Side };
  matches: {
    total: number; by_status: Record<string, number>;
    items: Array<{ id: string; member: Person; status: string; score: number; match_date: string | null; mutual_at: string | null; created_at: string | null }>;
    introductions: Array<{ id: string; member: Person; score: number | null; seen: boolean; created_at: string | null }>;
  };
  chat: {
    threads: number; active_threads: number; messages_sent: number; messages_received: number;
    last_message_sent_at: string | null; last_message_received_at: string | null; last_thread_activity_at: string | null;
  };
  billing: { subscriptions: SubRow[]; total_paid_pence: number; currency: string; credit_transactions: Array<{ id: string; amount: number; description: string; gateway: string | null; created_at: string | null }> };
  verification: {
    status: string; submitted_at: string | null; reviewed_at: string | null; rejection_reason: string | null; last_rejection_reason: string | null;
    checks: Array<{ id: string; type: string; status: string; doc_type: string | null; doc_country: string | null; submitted_at: string | null; verified_at: string | null }>;
    history: Array<{ id: string; action: string; actor_email: string | null; summary: string | null; created_at: string | null }>;
  };
  safety: { reports_against: number; reports_filed: number };
  admin_activity: Array<{ id: string; action: string; actor_email: string | null; summary: string | null; created_at: string | null }>;
  sections_failed: string[];
};

type Tab = "account" | "interests" | "matches" | "chat" | "billing" | "verification";

const ACCOUNT_STATE: Record<string, string> = {
  active: "Active", suspended: "Suspended by staff", deactivated: "Deactivated by member", deleted: "Deleted",
};

function PersonLink({ p }: { p: Person }) {
  if (p.is_deleted) return <span className="text-muted2-foreground">{p.name}</span>;
  return (
    <Link href={`/admin/users/${p.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
      {p.name}{p.membership_number && <span className="ml-1.5 font-normal text-muted2-foreground">{p.membership_number}</span>}
    </Link>
  );
}

function StatusCounts({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([s, n]) => <Pill key={s} tone={statusTone(s)}>{humanize(s)} · {n}</Pill>)}
    </div>
  );
}

function MiniTable({ head, children, minWidth = 480 }: { head: string[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="overflow-x-auto" data-admin-scroll>
        <table className="w-full border-collapse" style={{ minWidth }}>
          <thead><tr className={TABLE_HEAD}>{head.map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

const TD = "px-3 py-2 text-[12.5px] text-foreground";
const TD_MUTED = "px-3 py-2 text-[12.5px] text-muted2-foreground whitespace-nowrap";

function InterestList({ title, side, empty }: { title: string; side: Side; empty: string }) {
  return (
    <section className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold text-foreground">{title} <span className="font-normal tabular-nums text-muted2-foreground">· {side.total}</span></h3>
        <StatusCounts counts={side.by_status} />
      </div>
      {side.items.length === 0 ? <EmptyState compact icon={Heart} title={empty} /> : (
        <MiniTable head={["Member", "Status", "Sent", "Answered"]}>
          {side.items.map((r) => (
            <tr key={r.id} className={TABLE_ROW}>
              <td className={TD}><PersonLink p={r.member} /></td>
              <td className="px-3 py-2"><Pill tone={statusTone(r.status)}>{humanize(r.status)}</Pill></td>
              <td className={TD_MUTED} title={formatDateTime(r.created_at)}>{relTime(r.created_at)}</td>
              <td className={TD_MUTED}>{r.responded_at ? relTime(r.responded_at) : "—"}</td>
            </tr>
          ))}
        </MiniTable>
      )}
      {side.total > side.items.length && <p className="text-[11.5px] text-muted2-foreground">Showing the latest {side.items.length} of {side.total}.</p>}
    </section>
  );
}

/** Read-only Member 360: activity, interests, matches, chat counts, billing, verification. */
export default function Member360({ userId, refreshKey = 0 }: { userId: string; refreshKey?: number }) {
  const { toast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("account");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await adminMembersApi.overview(userId);
      setData((res.data as any)?.data || null);
    } catch (e) { setError(errorMessage(e, "Couldn't load this member's activity")); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await adminMembersApi.exportMemberData(userId);
      const payload = (res.data as any)?.data;
      if (!payload) throw new Error("The export came back empty");
      downloadJson(payload, `member-data-${data?.account.membership_number || userId}-${new Date().toISOString().slice(0, 10)}.json`);
      toast("success", "Data export downloaded. This export is recorded in the audit log.");
    } catch (e) { toast("error", errorMessage(e, "Export failed")); }
    finally { setExporting(false); }
  };

  const a = data?.account;
  return (
    <Panel
      id="member-360"
      title="Member 360"
      description="Read-only. Chat is shown as counts and dates only — message content is never visible to staff."
      actions={
        <Button size="sm" variant="secondary" onClick={exportData} loading={exporting} title="Download everything held about this member (subject access request)">
          <Download className="h-3.5 w-3.5" aria-hidden /> Export data
        </Button>
      }
    >
      {loading && !data ? <SkeletonRows rows={4} /> : error ? (
        <ErrorState compact message={error} onRetry={load} />
      ) : !data || !a ? null : (
        <div className="space-y-4">
          <div className="overflow-x-auto" data-admin-scroll>
            <Segmented<Tab>
              layoutId={`m360-${userId}`} ariaLabel="Member 360 sections" size="sm" value={tab} onChange={setTab}
              options={[
                { value: "account", label: "Account" },
                { value: "interests", label: "Interests", count: data.interests.sent.total + data.interests.received.total },
                { value: "matches", label: "Matches", count: data.matches.total + data.matches.introductions.length },
                { value: "chat", label: "Chat", count: data.chat.threads },
                { value: "billing", label: "Billing", count: data.billing.subscriptions.length },
                { value: "verification", label: "Verification" },
              ]}
            />
          </div>

          {data.sections_failed.length > 0 && (
            <ErrorState compact message={`Some sections couldn't be loaded (${data.sections_failed.join(", ")}). The rest is accurate.`} onRetry={load} />
          )}

          {tab === "account" && (
            <div className="space-y-4">
              <FactGrid>
                <Fact label="Account status"><Pill tone={statusTone(a.state)} dot>{ACCOUNT_STATE[a.state] || a.state}</Pill></Fact>
                <Fact label="Joined">{formatDate(a.created_at)}</Fact>
                <Fact label="Last seen">
                  {a.last_seen ? <span title={formatDateTime(a.last_seen.at)}>{relTime(a.last_seen.at)} <span className="text-muted2-foreground">· {a.last_seen.label.toLowerCase()}</span></span> : null}
                </Fact>
                <Fact label="Email"><Pill tone={a.is_email_verified ? "good" : "warn"}>{a.is_email_verified ? "Verified" : "Not verified"}</Pill></Fact>
                <Fact label="Phone"><Pill tone={a.is_phone_verified ? "good" : "neutral"}>{a.is_phone_verified ? "Verified" : "Not verified"}</Pill></Fact>
                <Fact label="Sign-in methods">{a.sign_in_methods > 0 ? a.sign_in_methods : "None linked"}</Fact>
                <Fact label="Profile">{a.completeness_score}% complete</Fact>
                <Fact label="Profile last edited">{a.profile_updated_at ? relTime(a.profile_updated_at) : null}</Fact>
                <Fact label="Reports">{data.safety.reports_against} against · {data.safety.reports_filed} filed</Fact>
              </FactGrid>

              {a.deactivation && (
                <div className="adm-soft-warn rounded-lg border px-3 py-2 text-[12.5px]">
                  <strong className="font-semibold">Deactivated {a.deactivation.by === "self" ? "by the member" : "by staff"}</strong> on {formatDateTime(a.deactivation.at)}.
                  {a.deactivation.reason && <> Reason given: “{a.deactivation.reason}”</>}
                </div>
              )}
              {(a.deletion || a.deleted_at) && (
                <div className="adm-soft-bad rounded-lg border px-3 py-2 text-[12.5px]">
                  <strong className="font-semibold">Deleted {a.deletion?.by === "self" ? "by the member" : "by staff"}</strong> on {formatDateTime(a.deletion?.at || a.deleted_at)}.
                  {a.deletion?.reason && <> Reason given: “{a.deletion.reason}”.</>}
                  {a.deletion?.email_masked && <> Contact at deletion: {a.deletion.email_masked}{a.deletion.phone_masked ? `, ${a.deletion.phone_masked}` : ""}.</>}
                  {" "}<Link href="/admin/data-requests" className="font-semibold underline underline-offset-2">Data requests</Link>
                </div>
              )}

              <section className="space-y-2">
                <h3 className="text-[12.5px] font-semibold text-foreground">Recent staff activity on this member</h3>
                {data.admin_activity.length === 0 ? <EmptyState compact icon={Activity} title="No staff actions recorded yet" /> : (
                  <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                    {data.admin_activity.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-[12.5px]">
                        <span className="font-medium text-foreground">{h.actor_email || "Unknown admin"}</span>
                        <span className="text-muted2-foreground">{describeAction(h.action)}</span>
                        {h.summary && <span className="min-w-0 truncate text-muted2-foreground">— “{h.summary}”</span>}
                        <span className="ml-auto whitespace-nowrap text-[11.5px] text-muted2-foreground" title={formatDateTime(h.created_at)}>{relTime(h.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === "interests" && (
            <div className="grid gap-5 xl:grid-cols-2">
              <InterestList title="Sent" side={data.interests.sent} empty="Hasn't sent any interests yet" />
              <InterestList title="Received" side={data.interests.received} empty="No interests received yet" />
            </div>
          )}

          {tab === "matches" && (
            <div className="space-y-5">
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[12.5px] font-semibold text-foreground">Matches <span className="font-normal tabular-nums text-muted2-foreground">· {data.matches.total}</span></h3>
                  <StatusCounts counts={data.matches.by_status} />
                </div>
                {data.matches.items.length === 0 ? <EmptyState compact icon={Sparkles} title="No matches yet" /> : (
                  <MiniTable head={["Member", "Status", "Compatibility", "Matched"]}>
                    {data.matches.items.map((m) => (
                      <tr key={m.id} className={TABLE_ROW}>
                        <td className={TD}><PersonLink p={m.member} /></td>
                        <td className="px-3 py-2"><Pill tone={statusTone(m.status)}>{humanize(m.status)}</Pill></td>
                        <td className={`${TD} tabular-nums`}>{m.score}%</td>
                        <td className={TD_MUTED}>{formatDate(m.mutual_at || m.created_at)}</td>
                      </tr>
                    ))}
                  </MiniTable>
                )}
              </section>
              <section className="space-y-2">
                <h3 className="text-[12.5px] font-semibold text-foreground">Introductions from the bureau <span className="font-normal tabular-nums text-muted2-foreground">· {data.matches.introductions.length}</span></h3>
                {data.matches.introductions.length === 0 ? (
                  <EmptyState compact icon={Inbox} title="No introductions made yet"
                    action={<Link href="/admin/matchmaking" className="text-[12.5px] font-medium text-foreground underline underline-offset-2">Open matchmaking</Link>} />
                ) : (
                  <MiniTable head={["Introduced to", "Compatibility", "Seen by member", "When"]}>
                    {data.matches.introductions.map((n) => (
                      <tr key={n.id} className={TABLE_ROW}>
                        <td className={TD}><PersonLink p={n.member} /></td>
                        <td className={`${TD} tabular-nums`}>{typeof n.score === "number" ? `${n.score}%` : "—"}</td>
                        <td className="px-3 py-2"><Pill tone={n.seen ? "good" : "neutral"}>{n.seen ? "Seen" : "Not yet"}</Pill></td>
                        <td className={TD_MUTED} title={formatDateTime(n.created_at)}>{relTime(n.created_at)}</td>
                      </tr>
                    ))}
                  </MiniTable>
                )}
              </section>
            </div>
          )}

          {tab === "chat" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Count label="Conversations" value={data.chat.threads} hint={`${data.chat.active_threads} open`} />
                <Count label="Messages sent" value={data.chat.messages_sent} hint={data.chat.last_message_sent_at ? `Last ${relTime(data.chat.last_message_sent_at)}` : "None yet"} />
                <Count label="Messages received" value={data.chat.messages_received} hint={data.chat.last_message_received_at ? `Last ${relTime(data.chat.last_message_received_at)}` : "None yet"} />
                <Count label="Last conversation activity" value={data.chat.last_thread_activity_at ? relTime(data.chat.last_thread_activity_at) : "—"} hint={data.chat.last_thread_activity_at ? formatDate(data.chat.last_thread_activity_at) : undefined} />
              </div>
              <p className="flex items-start gap-2 text-[12px] text-muted2-foreground">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Conversations are private. Staff see how active a member is, never who said what. If a member reports a message, review it under Reports.
              </p>
              {data.chat.threads === 0 && <EmptyState compact icon={MessageSquare} title="No conversations yet" />}
            </div>
          )}

          {tab === "billing" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                <Count label="Total paid" value={money(data.billing.total_paid_pence, data.billing.currency)} hint="Excludes refunded / cancelled" />
                <Count label="Membership terms" value={data.billing.subscriptions.length} />
                <Count label="Credit transactions" value={data.billing.credit_transactions.length} />
              </div>
              {data.billing.subscriptions.length === 0 ? <EmptyState compact icon={Inbox} title="No payments or memberships on record" /> : (
                <MiniTable head={["Plan", "Status", "Paid", "How", "Period", "Recorded"]} minWidth={680}>
                  {data.billing.subscriptions.map((s) => (
                    <tr key={s.id} className={TABLE_ROW}>
                      <td className={TD}><span className="font-medium">{s.plan_label}</span></td>
                      <td className="px-3 py-2"><Pill tone={statusTone(s.status)}>{humanize(s.status)}</Pill></td>
                      <td className={`${TD} tabular-nums`}>{money(s.amount_pence, s.currency)}</td>
                      <td className={TD}>
                        {s.gateway === "manual"
                          ? <span title={s.reason || undefined}>{humanize(s.payment_method || "offline")}{s.payment_reference ? ` · ${s.payment_reference}` : ""}<span className="block text-[11.5px] text-muted2-foreground">by {s.recorded_by || "staff"}</span></span>
                          : <span>{humanize(s.gateway)}<span className="block max-w-[160px] truncate font-mono text-[11px] text-muted2-foreground" title={s.reference || undefined}>{s.reference}</span></span>}
                      </td>
                      <td className={TD_MUTED}>{formatDate(s.period_start)} → {formatDate(s.period_end)}</td>
                      <td className={TD_MUTED} title={formatDateTime(s.created_at)}>{relTime(s.created_at)}</td>
                    </tr>
                  ))}
                </MiniTable>
              )}
            </div>
          )}

          {tab === "verification" && (
            <div className="space-y-4">
              <FactGrid>
                <Fact label="Profile review"><Pill tone={statusTone(data.verification.status)} dot>{humanize(data.verification.status === "submitted" ? "Pending review" : data.verification.status === "draft" ? "Not submitted" : data.verification.status)}</Pill></Fact>
                <Fact label="Submitted">{data.verification.submitted_at ? formatDateTime(data.verification.submitted_at) : null}</Fact>
                <Fact label="Reviewed">{data.verification.reviewed_at ? formatDateTime(data.verification.reviewed_at) : null}</Fact>
              </FactGrid>
              {(data.verification.rejection_reason || data.verification.last_rejection_reason) && (
                <div className="adm-soft-warn rounded-lg border px-3 py-2 text-[12.5px]">
                  <strong className="font-semibold">{data.verification.rejection_reason ? "Current note to member" : "Previous rejection"}:</strong>{" "}
                  {data.verification.rejection_reason || data.verification.last_rejection_reason}
                </div>
              )}
              {data.verification.checks.length > 0 && (
                <MiniTable head={["Check", "Document", "Status", "Submitted", "Verified"]} minWidth={560}>
                  {data.verification.checks.map((v) => (
                    <tr key={v.id} className={TABLE_ROW}>
                      <td className={TD}>{humanize(v.type)}</td>
                      <td className={TD}>{[humanize(v.doc_type), v.doc_country].filter((x) => x && x !== "—").join(" · ") || "—"}</td>
                      <td className="px-3 py-2"><Pill tone={statusTone(v.status)}>{humanize(v.status)}</Pill></td>
                      <td className={TD_MUTED}>{formatDate(v.submitted_at)}</td>
                      <td className={TD_MUTED}>{v.verified_at ? formatDate(v.verified_at) : "—"}</td>
                    </tr>
                  ))}
                </MiniTable>
              )}
              <section className="space-y-2">
                <h3 className="text-[12.5px] font-semibold text-foreground">Review history</h3>
                {data.verification.history.length === 0 ? <EmptyState compact icon={ShieldCheck} title="No review decisions recorded yet" /> : (
                  <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                    {data.verification.history.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-[12.5px]">
                        <span className="font-medium text-foreground">{h.actor_email || "Unknown admin"}</span>
                        <span className="text-muted2-foreground">{describeAction(h.action)} this profile</span>
                        {h.summary && <span className="min-w-0 text-muted2-foreground">— “{h.summary}”</span>}
                        <span className="ml-auto whitespace-nowrap text-[11.5px] text-muted2-foreground">{formatDateTime(h.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <p className="text-[12px] text-muted2-foreground">
                Document images are only shown on the <Link href="/admin/verifications" className="font-medium text-foreground underline underline-offset-2">verification review</Link> screen, and opening them there is recorded in the audit log.
              </p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
