"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlarmClock, Download, Info, PauseCircle, RotateCcw, ShieldAlert, Trash2, UserMinus } from "lucide-react";
import { PageShell, Button, StatCard } from "@/components/admin/PageShell";
import DataTable from "@/components/admin/DataTable";
import { EmptyState, ErrorState, Panel, Pill, Segmented, formatDate, formatDateTime, type Tone } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/Toast";
import { FormDialog, REASON_MIN, ReasonField, errorMessage } from "@/components/admin/member/shared";
import { adminMembersApi, downloadJson, type DataRequestKind } from "@/lib/api";

type Row = {
  id: string; name: string; membership_number: string | null; kind: DataRequestKind;
  at: string | null; days_since: number | null; reason: string | null;
  email: string | null; phone: string | null; contact_masked: boolean;
  restorable: boolean; restore_blocker: string | null;
  is_erasure_request: boolean; erasure_overdue: boolean; erasure_due_in_days: number | null;
};
type Data = {
  items: Row[]; total: number; counts: Record<DataRequestKind, number>;
  erasure_overdue: number; erasure_deadline_days: number; hard_erase_available: boolean;
};
type Filter = "all" | DataRequestKind;

const KIND: Record<DataRequestKind, { label: string; tone: Tone }> = {
  deleted_by_member: { label: "Deleted by member", tone: "bad" },
  deleted_by_admin: { label: "Deleted by staff", tone: "neutral" },
  deactivated_by_member: { label: "Deactivated by member", tone: "warn" },
};

export default function DataRequestsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [exportingId, setExportingId] = useState<string | null>(null);

  const [restore, setRestore] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await adminMembersApi.dataRequests();
      setData((res.data as any)?.data || null);
    } catch (e) { setError(errorMessage(e, "Couldn't load data requests")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (data?.items || []).filter((r) => filter === "all" || r.kind === filter), [data, filter]);

  const exportData = async (r: Row) => {
    setExportingId(r.id);
    try {
      const res = await adminMembersApi.exportMemberData(r.id);
      const payload = (res.data as any)?.data;
      if (!payload) throw new Error("The export came back empty");
      downloadJson(payload, `member-data-${r.membership_number || r.id}-${new Date().toISOString().slice(0, 10)}.json`);
      toast("success", `Data export for ${r.name} downloaded. This is recorded in the audit log.`);
    } catch (e) { toast("error", errorMessage(e, "Export failed")); }
    finally { setExportingId(null); }
  };

  const openRestore = (r: Row) => { setRestore(r); setReason(""); setTouched(false); setFormError(null); };
  const submitRestore = async () => {
    if (!restore) return;
    setTouched(true);
    if (reason.trim().length < REASON_MIN) { setFormError("Add a reason (at least 5 characters)."); return; }
    setBusy(true); setFormError(null);
    try {
      await adminMembersApi.restoreAccount(restore.id, reason.trim());
      toast("success", `${restore.name}'s account is active again`);
      setRestore(null);
      await load();
    } catch (e) { setFormError(errorMessage(e, "The account wasn't restored")); }
    finally { setBusy(false); }
  };

  const c = data?.counts;
  const deadline = data?.erasure_deadline_days ?? 30;

  return (
    <PageShell
      title="Data requests"
      subtitle="Accounts that members have deactivated or deleted. Export a member's data for a subject access request, or restore an account removed by mistake."
      meta={data ? <Pill>{data.total.toLocaleString("en-GB")}</Pill> : undefined}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Deleted by the member" value={c ? c.deleted_by_member : "—"} icon={UserMinus} hint="Erasure requests" onClick={() => setFilter("deleted_by_member")} />
        <StatCard
          label={`Waiting over ${deadline} days`} value={data ? data.erasure_overdue : "—"} icon={AlarmClock}
          tone={data && data.erasure_overdue > 0 ? "bad" : "neutral"} hint="Past the one-month deadline"
          onClick={() => setFilter("deleted_by_member")}
        />
        <StatCard label="Deactivated by the member" value={c ? c.deactivated_by_member : "—"} icon={PauseCircle} hint="Hidden; they can return by signing in" onClick={() => setFilter("deactivated_by_member")} />
        <StatCard label="Deleted by staff" value={c ? c.deleted_by_admin : "—"} icon={Trash2} hint="Restorable" onClick={() => setFilter("deleted_by_admin")} />
      </div>

      <Panel className="mb-5" title={<span className="inline-flex items-center gap-2"><ShieldAlert className="h-4 w-4 adm-fg-warn" aria-hidden /> Deleted accounts still hold personal data</span>}>
        <div className="space-y-2 text-[12.5px] leading-relaxed text-muted2-foreground">
          <p>
            When a member deletes their account their profile disappears from the site, their sign-in is removed and their email and phone are detached —
            but the record itself (profile, photos, ID documents, activity) is <strong className="font-semibold text-foreground">kept in the database</strong>.
            UK GDPR gives you one month to complete an erasure request.
          </p>
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Permanent erasure can't be done from this console yet. Until it can, agree a retention period and have your developer erase requests older than {deadline} days. Export the record first if you need it for a dispute.</span>
          </p>
        </div>
      </Panel>

      {error ? (
        <ErrorState title="Couldn't load data requests" message={error} onRetry={load} />
      ) : (
        <DataTable<Row>
          data={rows}
          loading={loading}
          rowKey={(r) => r.id}
          searchPlaceholder="Search name, member no. or email…"
          searchKeys={["name", "membership_number", "email", "reason"]}
          initialSort={{ key: "at", dir: "desc" }}
          filters={
            <Segmented<Filter>
              layoutId="data-request-kind" ariaLabel="Request type" size="sm" value={filter} onChange={setFilter}
              options={[
                { value: "all", label: "All", count: data?.total ?? null },
                { value: "deleted_by_member", label: "Deleted by member", count: c?.deleted_by_member ?? null },
                { value: "deactivated_by_member", label: "Deactivated", count: c?.deactivated_by_member ?? null },
                { value: "deleted_by_admin", label: "Deleted by staff", count: c?.deleted_by_admin ?? null },
              ]}
            />
          }
          emptyState={
            <EmptyState icon={UserMinus} title={filter === "all" ? "No deactivated or deleted accounts" : "Nothing in this group"}
              description="When a member deactivates or deletes their account it appears here." />
          }
          columns={[
            {
              key: "name", label: "Member", sortable: true,
              render: (r) => (
                <div className="min-w-0">
                  <Link href={`/admin/users/${r.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">{r.name}</Link>
                  <div className="text-[11.5px] text-muted2-foreground">
                    {[r.membership_number, r.email].filter(Boolean).join(" · ") || "No contact on record"}
                    {r.contact_masked && <span title="Contact details were detached when the member deleted their account. The export has the full record."> · masked</span>}
                  </div>
                </div>
              ),
            },
            { key: "kind", label: "What happened", sortable: true, render: (r) => <Pill tone={KIND[r.kind].tone} dot>{KIND[r.kind].label}</Pill> },
            {
              key: "at", label: "When", sortable: true, sortValue: (r) => r.at || "",
              render: (r) => (
                <div className="whitespace-nowrap">
                  <span title={formatDateTime(r.at)}>{formatDate(r.at)}</span>
                  <div className="text-[11.5px] text-muted2-foreground">{typeof r.days_since === "number" ? (r.days_since === 0 ? "today" : `${r.days_since} day${r.days_since === 1 ? "" : "s"} ago`) : ""}</div>
                </div>
              ),
            },
            {
              key: "erasure", label: "Erasure", sortable: true, sortValue: (r) => (r.is_erasure_request ? (r.erasure_due_in_days ?? 0) : 9999),
              render: (r) => !r.is_erasure_request ? <span className="text-muted2-foreground">Not requested</span>
                : r.erasure_overdue ? <Pill tone="bad">{Math.abs(r.erasure_due_in_days ?? 0)} days overdue</Pill>
                : <Pill tone="warn">Due in {r.erasure_due_in_days ?? deadline} days</Pill>,
            },
            {
              key: "reason", label: "Member's reason", className: "max-w-[260px]",
              render: (r) => r.reason ? <span className="line-clamp-2 text-[12.5px] text-muted2-foreground" title={r.reason}>“{r.reason}”</span> : <span className="text-muted2-foreground">—</span>,
            },
            {
              key: "actions", label: "Actions", align: "right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => exportData(r)} loading={exportingId === r.id} title="Download everything held about this member (JSON)">
                    <Download className="h-3.5 w-3.5" aria-hidden /> Export data
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openRestore(r)} disabled={!r.restorable} title={r.restorable ? "Make this account active again" : r.restore_blocker || undefined}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {r.kind === "deactivated_by_member" ? "Reactivate" : "Restore"}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <FormDialog
        open={!!restore}
        title={restore ? `${restore.kind === "deactivated_by_member" ? "Reactivate" : "Restore"} ${restore.name}?` : ""}
        description={
          restore?.kind === "deactivated_by_member"
            ? "The member deactivated their own account. Only reactivate it if they have asked you to — their profile becomes visible to other members again."
            : "This account was removed by staff. Restoring it makes the profile visible again and lets the member sign in as before."
        }
        onClose={() => { if (!busy) setRestore(null); }} onSubmit={submitRestore} busy={busy} error={formError}
        submitLabel={restore?.kind === "deactivated_by_member" ? "Reactivate account" : "Restore account"}
      >
        <ReasonField id="restore-reason" value={reason} onChange={setReason} showError={touched} placeholder="e.g. Member phoned on 24 Nov asking to come back" />
      </FormDialog>
    </PageShell>
  );
}
