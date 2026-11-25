"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleSlash, FileCheck2, MinusCircle } from "lucide-react";
import { adminMembersApi, type ConsentType } from "@/lib/api";
import {
  EmptyState, ErrorState, Panel, Pill, SkeletonRows, TABLE_HEAD, TABLE_ROW, formatDateTime, relTime, type Tone,
} from "@/components/admin/primitives";
import { errorMessage, humanize } from "./shared";

type Current = {
  label: string; required: boolean; granted: boolean | null; policy_version: string | null;
  is_current_version: boolean; at: string | null; source: string | null;
};
type HistoryRow = {
  id: string; created_at: string | null; consent_type: ConsentType; consent_label: string; granted: boolean;
  policy_version: string; is_current_version: boolean; source: string; ip_address: string | null; user_agent: string | null;
};
type Data = {
  policy_version: string; status: "confirmed" | "outdated" | "incomplete" | "never"; needs_consent: boolean;
  current: Record<ConsentType, Current>; history: HistoryRow[];
};

export const CONSENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  confirmed: { label: "Up to date", tone: "good" },
  outdated: { label: "Older policy version", tone: "warn" },
  incomplete: { label: "Missing or withdrawn", tone: "bad" },
  never: { label: "Nothing on record", tone: "neutral" },
};

const ORDER: ConsentType[] = ["terms_privacy", "sensitive_data", "marketing_email"];
const PREVIEW = 6;

/** Consent history for one member — the bureau's UK GDPR proof of consent. */
export default function ConsentPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await adminMembersApi.memberConsents(userId);
      setData((res.data as any)?.data || null);
    } catch (e) { setError(errorMessage(e, "Couldn't load consent records")); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const status = data ? CONSENT_STATUS[data.status] : null;
  const rows = data ? (showAll ? data.history : data.history.slice(0, PREVIEW)) : [];

  return (
    <Panel
      id="member-consents"
      title="Consent records"
      description={data ? `Current policy version ${data.policy_version}. Every decision is kept — nothing is overwritten.` : "Proof of what this member agreed to, and when."}
      actions={<>
        {status && <Pill tone={status.tone} dot>{status.label}</Pill>}
        <Link href="/admin/consents" className="text-[12px] font-medium text-muted2-foreground underline-offset-2 hover:text-foreground hover:underline">All consents</Link>
      </>}
    >
      {loading && !data ? <SkeletonRows rows={3} /> : error ? (
        <ErrorState compact message={error} onRetry={load} />
      ) : !data ? null : (
        <div className="space-y-4">
          <ul className="grid gap-2 sm:grid-cols-3">
            {ORDER.map((t) => {
              const c = data.current[t];
              if (!c) return null;
              const Icon = c.granted === null ? MinusCircle : c.granted ? CheckCircle2 : CircleSlash;
              const tone: Tone = c.granted === null ? "neutral" : !c.granted ? (c.required ? "bad" : "neutral") : c.is_current_version || !c.required ? "good" : "warn";
              const text = c.granted === null ? "No answer recorded" : c.granted ? (c.required && !c.is_current_version ? "Agreed (older version)" : "Agreed") : (c.required ? "Withdrawn" : "Opted out");
              return (
                <li key={t} className="rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5">
                  <div className="text-[12px] font-medium text-foreground">{c.label}{!c.required && <span className="font-normal text-muted2-foreground"> · optional</span>}</div>
                  <div className="mt-1.5"><Pill tone={tone}><Icon className="h-3 w-3" aria-hidden />{text}</Pill></div>
                  <div className="mt-1.5 text-[11.5px] text-muted2-foreground">
                    {c.at ? <>{formatDateTime(c.at)} · v{c.policy_version} · {humanize(c.source)}</> : "—"}
                  </div>
                </li>
              );
            })}
          </ul>

          {data.history.length === 0 ? (
            <EmptyState compact icon={FileCheck2} title="No consent decisions recorded"
              description="This member joined before consent logging began. They'll be asked to confirm the next time they sign in." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/70">
              <div className="overflow-x-auto" data-admin-scroll>
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className={TABLE_HEAD}>
                      <th scope="col" className="px-3 py-2">When</th>
                      <th scope="col" className="px-3 py-2">Consent</th>
                      <th scope="col" className="px-3 py-2">Decision</th>
                      <th scope="col" className="px-3 py-2">Version</th>
                      <th scope="col" className="px-3 py-2">Where</th>
                      <th scope="col" className="px-3 py-2">IP address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={TABLE_ROW}>
                        <td className="whitespace-nowrap px-3 py-2 text-[12.5px] text-foreground" title={relTime(r.created_at)}>{formatDateTime(r.created_at)}</td>
                        <td className="px-3 py-2 text-[12.5px] text-foreground">{r.consent_label}</td>
                        <td className="px-3 py-2"><Pill tone={r.granted ? "good" : "bad"}>{r.granted ? "Granted" : "Withdrawn"}</Pill></td>
                        <td className="whitespace-nowrap px-3 py-2 text-[12.5px] tabular-nums text-muted2-foreground">{r.policy_version}</td>
                        <td className="px-3 py-2 text-[12.5px] text-muted2-foreground">{humanize(r.source)}</td>
                        <td className="px-3 py-2 font-mono text-[11.5px] text-muted2-foreground" title={r.user_agent || undefined}>{r.ip_address || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.history.length > PREVIEW && (
                <button type="button" onClick={() => setShowAll((v) => !v)}
                  className="w-full border-t border-border/70 px-3 py-2 text-left text-[12px] font-medium text-muted2-foreground hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                  {showAll ? "Show fewer" : `Show all ${data.history.length} decisions`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
