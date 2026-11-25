"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, CreditCard, Repeat, XCircle } from "lucide-react";
import {
  adminMembersApi, type MembershipAction, type MembershipChangeBody, type PaidPlan, type PaymentMethod,
} from "@/lib/api";
import { Button } from "@/components/admin/PageShell";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { ErrorState, Panel, Pill, Select, SkeletonRows, formatDate } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/Toast";
import { Fact, FactGrid, FormDialog, FormField, INPUT, PLAN_LABEL, REASON_MIN, ReasonField, errorMessage, humanize, money } from "./shared";

type Plan = { plan: PaidPlan; label: string; price_pence: number; currency: string; term_days: number };
type Membership = {
  tier: string; plan_label: string;
  current: { id: string; plan: string; plan_label: string; status: string; gateway: string | null; amount_pence: number; currency: string; period_start: string | null; period_end: string | null } | null;
  active_count: number; period_lapsed: boolean; days_left: number | null; warnings: string[];
  is_deleted: boolean; plans: Plan[]; payment_methods: Array<{ value: PaymentMethod; label: string }>; max_term_days: number;
};

const RANK: Record<string, number> = { free: 0, silver: 1, gold: 2, platinum: 3 };
const TITLES: Record<MembershipAction, string> = {
  grant: "Grant membership", extend: "Extend membership", change: "Change plan", end: "End membership",
};
const DONE: Record<MembershipAction, string> = {
  grant: "Membership granted", extend: "Membership extended", change: "Plan changed", end: "Membership ended",
};

type Form = {
  plan: PaidPlan | "";
  duration: string;      // "term" | "keep" | number of days | "date"
  date: string;          // YYYY-MM-DD when duration === "date"
  paid: boolean;         // extend / change: was money taken?
  method: PaymentMethod | "";
  amount: string;        // pounds, as typed
  reference: string;
  refunded: boolean;
  notify: boolean;
  reason: string;
};

function poundsToPence(v: string): number | null {
  const n = Number(v.replace(/[£,\s]/g, ""));
  if (!v.trim() || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Staff-recorded membership changes for offline payments. Every change needs a reason and is audit-logged. */
export default function MembershipPanel({ userId, memberName, refreshKey = 0, onChanged }: {
  userId: string; memberName: string; refreshKey?: number; onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState<MembershipAction | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<MembershipChangeBody | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await adminMembersApi.getMembership(userId);
      setData((res.data as any)?.data || null);
    } catch (e) { setError(errorMessage(e, "Couldn't load the membership")); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const planByKey = useMemo(() => Object.fromEntries((data?.plans || []).map((p) => [p.plan, p])) as Record<string, Plan>, [data]);
  const hasRunningTerm = !!data?.current && !data.period_lapsed;

  const open = (a: MembershipAction) => {
    if (!data) return;
    const firstOther = data.plans.find((p) => p.plan !== data.tier)?.plan || "";
    const plan: PaidPlan | "" = a === "grant" ? ((data.tier !== "free" ? (data.tier as PaidPlan) : "gold")) : a === "change" ? firstOther : "";
    setForm({
      plan,
      duration: a === "grant" ? "term" : a === "extend" ? "30" : hasRunningTerm ? "keep" : "term",
      date: "",
      paid: a === "grant",
      method: a === "grant" ? "bank_transfer" : "",
      amount: a === "grant" && plan && planByKey[plan] ? String(planByKey[plan].price_pence / 100) : "",
      reference: "", refunded: false, notify: a !== "end", reason: "",
    });
    setTouched(false); setFormError(null); setAction(a);
  };
  const close = () => { if (!busy) { setAction(null); setForm(null); setConfirm(null); } };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const isDowngrade = action === "change" && !!form?.plan && !!data && RANK[form.plan] < RANK[data.tier];
  const complimentary = form?.method === "complimentary";
  const takesMoney = !!form && (action === "grant" || ((action === "extend" || action === "change") && form.paid));

  const validate = (): { body?: MembershipChangeBody; problem?: string } => {
    if (!form || !action || !data) return { problem: "Nothing to submit" };
    if (form.reason.trim().length < REASON_MIN) return { problem: "Add a reason (at least 5 characters)." };
    const body: MembershipChangeBody = { action, reason: form.reason.trim(), notify_member: form.notify };
    if (action === "end") { body.refunded = form.refunded; return { body }; }
    if (action !== "extend") {
      if (!form.plan) return { problem: "Choose a plan." };
      body.plan = form.plan;
    }
    if (form.duration === "date") {
      if (!form.date) return { problem: "Pick the end date." };
      if (form.date <= new Date().toISOString().slice(0, 10)) return { problem: "The end date must be in the future." };
      body.period_end = form.date;
    } else if (form.duration === "term") {
      // Explicit, so "standard term" on a plan change isn't read as "keep the current end date".
      body.days = (form.plan && planByKey[form.plan]?.term_days) || 180;
    } else if (form.duration !== "keep") {
      body.days = Number(form.duration);
    }
    if (takesMoney) {
      if (!form.method) return { problem: "Choose how the member paid." };
      body.payment_method = form.method;
      if (!complimentary) {
        const pence = poundsToPence(form.amount);
        if (pence === null || pence <= 0) return { problem: "Enter the amount the member paid." };
        body.amount_pence = pence;
      }
      if (form.reference.trim()) body.payment_reference = form.reference.trim();
    }
    return { body };
  };

  const send = async (body: MembershipChangeBody) => {
    setBusy(true); setFormError(null);
    try {
      await adminMembersApi.changeMembership(userId, body);
      toast("success", `${DONE[body.action]} for ${memberName}`);
      setAction(null); setForm(null); setConfirm(null);
      await load();
      onChanged?.();
    } catch (e) {
      setConfirm(null);
      setFormError(errorMessage(e, "The change wasn't saved"));
    } finally { setBusy(false); }
  };

  const submit = () => {
    setTouched(true);
    const { body, problem } = validate();
    if (!body) { setFormError(problem || "Check the form"); return; }
    setFormError(null);
    // Anything that removes access is confirmed first (the server requires confirm=true too).
    if (body.action === "end" || isDowngrade) setConfirm(body);
    else send(body);
  };

  const cur = data?.current;
  const currentLabel = data ? data.plan_label : "";

  return (
    <Panel
      id="member-membership"
      title="Membership"
      description="Record offline payments and adjust this member's plan. Every change needs a reason and is logged."
      actions={data && <Pill tone={data.tier === "free" ? "neutral" : "brand"} dot>{currentLabel}</Pill>}
    >
      {loading && !data ? <SkeletonRows rows={2} /> : error ? (
        <ErrorState compact message={error} onRetry={load} />
      ) : !data ? null : (
        <div className="space-y-3.5">
          <FactGrid>
            <Fact label="Access level">{data.plan_label}{data.tier === "free" && <span className="text-muted2-foreground"> · no paid plan</span>}</Fact>
            <Fact label={data.period_lapsed ? "Paid period ended" : "Paid until"}>
              {cur?.period_end ? <>{formatDate(cur.period_end)}{typeof data.days_left === "number" && <span className="text-muted2-foreground"> · {data.days_left >= 0 ? `${data.days_left} days left` : `${Math.abs(data.days_left)} days ago`}</span>}</> : null}
            </Fact>
            <Fact label="Last payment">{cur ? <>{money(cur.amount_pence, cur.currency)} <span className="text-muted2-foreground">· {cur.gateway === "manual" ? "recorded by staff" : humanize(cur.gateway)}</span></> : null}</Fact>
          </FactGrid>

          {data.warnings.map((w) => (
            <div key={w} className="adm-soft-warn flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span>{w}</span>
            </div>
          ))}

          {data.is_deleted ? (
            <p className="text-[12.5px] text-muted2-foreground">This account is deleted, so its membership can't be changed.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {!hasRunningTerm && (
                <Button variant="primary" size="sm" onClick={() => open("grant")}>
                  <CreditCard className="h-3.5 w-3.5" aria-hidden /> {cur ? "Start a new term" : "Grant membership"}
                </Button>
              )}
              {cur && (
                <Button variant="secondary" size="sm" onClick={() => open("extend")}>
                  <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Extend
                </Button>
              )}
              {(cur || data.tier !== "free") && (
                <Button variant="secondary" size="sm" onClick={() => open("change")}>
                  <Repeat className="h-3.5 w-3.5" aria-hidden /> Change plan
                </Button>
              )}
              {(cur || data.tier !== "free") && (
                <Button variant="danger" size="sm" onClick={() => open("end")}>
                  <XCircle className="h-3.5 w-3.5" aria-hidden /> End membership
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {data && form && action && (
        <FormDialog
          open={!confirm}
          title={`${TITLES[action]} — ${memberName}`}
          description={
            action === "grant" ? "Use this when the member has paid offline (or you are giving a complimentary term). It unlocks the plan straight away."
            : action === "extend" ? `Currently ${cur ? `paid until ${formatDate(cur.period_end)}` : "no end date"}. The new end date must be later.`
            : action === "change" ? `Currently on ${data.plan_label}. The change takes effect immediately.`
            : `Removes ${data.plan_label} access immediately. The member drops to the free level.`
          }
          onClose={close} onSubmit={submit} busy={busy} error={formError}
          submitLabel={action === "end" ? "End membership…" : isDowngrade ? "Downgrade…" : TITLES[action]}
          submitVariant={action === "end" || isDowngrade ? "danger" : "primary"}
        >
          {(action === "grant" || action === "change") && (
            <FormField label="Plan" htmlFor="ms-plan" required>
              <Select id="ms-plan" value={form.plan} className="w-full"
                onChange={(v) => {
                  set("plan", v as PaidPlan);
                  if (action === "grant" && planByKey[v]) set("amount", String(planByKey[v].price_pence / 100));
                }}>
                {data.plans.filter((p) => action === "grant" || p.plan !== data.tier).map((p) => (
                  <option key={p.plan} value={p.plan}>{p.label} — {money(p.price_pence, p.currency)} / {Math.round(p.term_days / 30)} months</option>
                ))}
              </Select>
            </FormField>
          )}

          {action !== "end" && (
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FormField label={action === "extend" ? "Extend by" : "Runs for"} htmlFor="ms-duration" required>
                <Select id="ms-duration" value={form.duration} onChange={(v) => set("duration", v)} className="w-full">
                  {action === "change" && hasRunningTerm && <option value="keep">Keep the current end date</option>}
                  {action !== "extend" && <option value="term">Standard term ({form.plan && planByKey[form.plan] ? Math.round(planByKey[form.plan].term_days / 30) : 6} months)</option>}
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                  <option value="date">Until a specific date…</option>
                </Select>
              </FormField>
              {form.duration === "date" && (
                <FormField label="Last day of membership" htmlFor="ms-date" required>
                  <input id="ms-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={INPUT}
                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} />
                </FormField>
              )}
            </div>
          )}

          {(action === "extend" || action === "change") && (
            <label className="flex items-start gap-2 text-[13px] text-foreground">
              <input type="checkbox" checked={form.paid} onChange={(e) => set("paid", e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]" />
              <span>{action === "extend" ? "The member paid for this extension" : "The member paid a difference for this change"}
                <span className="block text-[11.5px] text-muted2-foreground">Leave unticked for a goodwill or correction change with no payment.</span></span>
            </label>
          )}

          {takesMoney && (
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FormField label="How they paid" htmlFor="ms-method" required>
                <Select id="ms-method" value={form.method} onChange={(v) => set("method", v as PaymentMethod)} className="w-full">
                  <option value="">Choose…</option>
                  {data.payment_methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Amount received (£)" htmlFor="ms-amount" required={!complimentary}
                hint={complimentary ? "No charge is recorded." : "Counts towards revenue on the dashboard."}>
                <input id="ms-amount" inputMode="decimal" value={complimentary ? "0" : form.amount} disabled={complimentary}
                  onChange={(e) => set("amount", e.target.value)} placeholder="300" className={INPUT} />
              </FormField>
              <FormField label="Payment reference" htmlFor="ms-ref" className="sm:col-span-2" hint="Receipt number, bank reference — optional.">
                <input id="ms-ref" value={form.reference} maxLength={120} onChange={(e) => set("reference", e.target.value)} className={INPUT} />
              </FormField>
            </div>
          )}

          {action === "end" && (
            <label className="flex items-start gap-2 text-[13px] text-foreground">
              <input type="checkbox" checked={form.refunded} onChange={(e) => set("refunded", e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]" />
              <span>The payment was refunded
                <span className="block text-[11.5px] text-muted2-foreground">Ticked: the payment is removed from revenue. Unticked: revenue history is kept.</span></span>
            </label>
          )}

          <ReasonField id="ms-reason" value={form.reason} onChange={(v) => set("reason", v)} showError={touched}
            placeholder={action === "grant" ? "e.g. Paid £300 by bank transfer on 24 Nov" : action === "end" ? "e.g. Member asked to cancel" : undefined} />

          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" checked={form.notify} onChange={(e) => set("notify", e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]" />
            Tell the member with an in-app notification
          </label>
        </FormDialog>
      )}

      <ConfirmModal
        open={!!confirm}
        variant="danger"
        title={confirm?.action === "end" ? `End ${memberName}'s membership?` : `Downgrade ${memberName}?`}
        message={
          confirm?.action === "end"
            ? `${memberName} will lose ${data?.plan_label || "paid"} access immediately — messaging, premium photos and advanced filters.${confirm?.refunded ? " The payment will be marked as refunded." : ""}`
            : `${memberName} will move from ${data?.plan_label} to ${PLAN_LABEL[confirm?.plan || ""] || "the new plan"} immediately and lose the features of the higher plan.`
        }
        confirmLabel={busy ? "Saving…" : confirm?.action === "end" ? "End membership" : "Downgrade"}
        onCancel={() => { if (!busy) setConfirm(null); }}
        onConfirm={() => { if (confirm && !busy) send({ ...confirm, confirm: true }); }}
      />
    </Panel>
  );
}
