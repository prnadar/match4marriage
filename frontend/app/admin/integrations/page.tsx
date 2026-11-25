"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, CircleDashed, Cloud, CreditCard, Database, Flame, Mail,
  RefreshCw, ServerCog, ShieldCheck, XCircle, Zap, type LucideIcon,
} from "lucide-react";
import { PageShell, Button } from "@/components/admin/PageShell";
import { ErrorState, Panel, Pill, Skeleton, formatDateTime, type Tone } from "@/components/admin/primitives";
import { errorMessage, humanize } from "@/components/admin/member/shared";
import { adminMembersApi } from "@/lib/api";

type Status = "ok" | "warning" | "error" | "not_configured" | "unchecked";
type Service = {
  key: string; name: string; purpose: string; configured: boolean; status: Status; detail: string;
  identifiers: Record<string, string | boolean | null>; live_checked: boolean; latency_ms: number | null; action: string | null;
};
type Data = {
  checked_at: string; live: boolean; overall: Status; counts: Record<Status, number>; services: Service[];
  environment: {
    environment: string; app_version: string; frontend_host: string | null; demo_mode: boolean; debug: boolean;
    boot_ddl_enabled: boolean; bootstrap_admins: number;
  };
};

const STATUS: Record<Status, { label: string; tone: Tone; icon: LucideIcon }> = {
  ok: { label: "Working", tone: "good", icon: CheckCircle2 },
  warning: { label: "Needs attention", tone: "warn", icon: AlertTriangle },
  error: { label: "Not working", tone: "bad", icon: XCircle },
  not_configured: { label: "Not set up", tone: "neutral", icon: CircleDashed },
  unchecked: { label: "Set up — not tested yet", tone: "info", icon: CircleDashed },
};
const ICON: Record<string, LucideIcon> = {
  database: Database, redis: Zap, firebase: Flame, resend: Mail, cloudinary: Cloud, paypal: CreditCard, sentry: Activity,
};

function idValue(v: string | boolean | null): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return v === null || v === "" ? "—" : String(v);
}

function ServiceCard({ s, checking }: { s: Service; checking: boolean }) {
  const st = STATUS[s.status] || STATUS.unchecked;
  const Icon = ICON[s.key] || ServerCog;
  const ids = Object.entries(s.identifiers || {}).filter(([, v]) => v !== null && v !== "");
  return (
    <Panel
      title={<span className="inline-flex items-center gap-2"><Icon className="h-4 w-4 text-muted2-foreground" aria-hidden />{s.name}</span>}
      description={s.purpose}
      actions={checking && s.status === "unchecked"
        ? <Pill tone="neutral"><span aria-hidden className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Checking…</Pill>
        : <Pill tone={st.tone}><st.icon className="h-3 w-3" aria-hidden />{st.label}</Pill>}
      className="h-full"
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-foreground">{s.detail || (s.configured ? "Configured." : "Not configured.")}</p>
        {s.action && (
          <div className={`${s.status === "error" ? "adm-soft-bad" : "adm-soft-warn"} rounded-lg border px-3 py-2 text-[12.5px]`}>
            <strong className="font-semibold">What to do:</strong> {s.action}
          </div>
        )}
        {ids.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
            {ids.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted2-foreground">{humanize(k)}</dt>
                <dd className={`min-w-0 break-all text-foreground ${typeof v === "string" && /[…•]/.test(v) ? "font-mono text-[11.5px]" : ""}`}>{idValue(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-[11.5px] text-muted2-foreground">
          {s.live_checked ? <>Live check{typeof s.latency_ms === "number" ? ` answered in ${s.latency_ms} ms` : " ran"}.</> : s.configured ? "Configuration only — no live check yet." : "Nothing to check until it is set up."}
        </p>
      </div>
    </Panel>
  );
}

export default function IntegrationsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const started = useRef(false);

  const runLive = useCallback(async () => {
    setChecking(true); setLiveError(null);
    try {
      const res = await adminMembersApi.integrations(true);
      const d = (res.data as any)?.data as Data | undefined;
      if (d) setData(d);
    } catch (e) { setLiveError(errorMessage(e, "The live checks couldn't be run")); }
    finally { setChecking(false); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Fast pass first (what is configured), then the read-only live checks.
      const res = await adminMembersApi.integrations(false);
      setData((res.data as any)?.data || null);
      setLoading(false);
      await runLive();
    } catch (e) { setError(errorMessage(e, "Couldn't load integration status")); setLoading(false); }
  }, [runLive]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load();
  }, [load]);

  const overall = data ? STATUS[data.overall] : null;
  const env = data?.environment;
  const problems = data ? data.counts.error + data.counts.warning : 0;

  return (
    <PageShell
      title="Integrations"
      subtitle="Every outside service the site depends on: whether it is set up, and whether it is answering. Checks are read-only — nothing is emailed, charged or changed."
      meta={data && overall && !checking ? <Pill tone={overall.tone} dot>{problems === 0 ? "All services working" : `${problems} need${problems === 1 ? "s" : ""} attention`}</Pill> : undefined}
      actions={
        <Button size="sm" onClick={runLive} loading={checking} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Run live checks
        </Button>
      }
    >
      {error ? (
        <ErrorState title="Couldn't load integration status" message={error} onRetry={load} />
      ) : loading || !data ? (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {liveError && <ErrorState compact message={liveError} onRetry={runLive} />}

          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {data.services.map((s) => <ServiceCard key={s.key} s={s} checking={checking} />)}
          </div>

          {env && (
            <Panel
              title={<span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted2-foreground" aria-hidden />Environment</span>}
              description={`Last checked ${formatDateTime(data.checked_at)}${data.live ? " (live checks included)" : ""}. Secrets are never shown here — only whether they are set, and masked identifiers.`}
            >
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-3 lg:grid-cols-4">
                <div><dt className="text-[11.5px] font-medium text-muted2-foreground">Environment</dt><dd className="mt-0.5"><Pill tone={env.environment === "production" ? "good" : "warn"}>{humanize(env.environment)}</Pill></dd></div>
                <div><dt className="text-[11.5px] font-medium text-muted2-foreground">API version</dt><dd className="mt-0.5 break-all text-foreground">{env.app_version}</dd></div>
                <div><dt className="text-[11.5px] font-medium text-muted2-foreground">Website address</dt><dd className="mt-0.5 break-all text-foreground">{env.frontend_host || "—"}</dd></div>
                <div><dt className="text-[11.5px] font-medium text-muted2-foreground">Demo mode</dt><dd className="mt-0.5"><Pill tone={env.demo_mode ? "bad" : "good"}>{env.demo_mode ? "ON — test codes accepted" : "Off"}</Pill></dd></div>
                <div><dt className="text-[11.5px] font-medium text-muted2-foreground">Debug logging</dt><dd className="mt-0.5"><Pill tone={env.debug && env.environment === "production" ? "warn" : "neutral"}>{env.debug ? "On" : "Off"}</Pill></dd></div>
                <div><dt className="text-[11.5px] font-medium text-muted2-foreground">Database self-updates on start</dt><dd className="mt-0.5"><Pill tone="neutral">{env.boot_ddl_enabled ? "Enabled" : "Disabled"}</Pill></dd></div>
                <div><dt className="text-[11.5px] font-medium text-muted2-foreground">Bootstrap admin emails</dt><dd className="mt-0.5 text-foreground">{env.bootstrap_admins}</dd></div>
              </dl>
            </Panel>
          )}
        </div>
      )}
    </PageShell>
  );
}
