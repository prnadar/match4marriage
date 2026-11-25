"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Tag, Plus, X, Trash2, Edit3, GripVertical, Check,
  Eye, EyeOff, ArrowUp, ArrowDown,
} from "lucide-react";
import { PageShell, Button, fadeUp } from "@/components/admin/PageShell";
import { Segmented, EmptyState, Skeleton, Pill } from "@/components/admin/primitives";
import { FIELD } from "@/components/admin/primitives";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import { adminApi, ApiError } from "@/lib/api";
import { formatGBP } from "@/lib/plans";
import { usePersistentState, oneOf } from "../_lib/view-state";

type Tier = "silver" | "gold" | "platinum";
type Period = "monthly" | "quarterly" | "half_yearly" | "yearly";

interface Plan {
  id: string;
  key: string;
  name: string;
  tier: Tier;
  price_paise: number;
  // Optional "was" price. When set above price_paise it renders struck through
  // (inaugural / promo offer, e.g. Basic free now, regularly £100).
  original_price_paise: number | null;
  currency: string;
  period: Period;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

// Human period label shown on cards. Quarterly/half-yearly read as months so a
// "6 months" plan never displays as "/ year".
const PERIOD_LABEL: Record<Period, string> = {
  monthly: "month",
  quarterly: "3 months",
  half_yearly: "6 months",
  yearly: "year",
};

// Tier metadata. `label` is the marketing name members see on /pricing and the
// subscription cards — surfaced everywhere here so operators don't have to
// remember the silver/gold/platinum → Basic/Premium/Elite mapping. The colour
// marks the tier on the card's top rule and check icons only; the label is
// always text.
const TIERS: Array<{ key: Tier; label: string; color: string }> = [
  { key: "silver",   label: "Basic",   color: "#7D8A93" },
  { key: "gold",     label: "Premium", color: "#B07D35" },
  { key: "platinum", label: "Elite",   color: "#5D4B8A" },
];

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "monthly",     label: "Monthly" },
  { key: "quarterly",   label: "Every 3 months" },
  { key: "half_yearly", label: "Every 6 months" },
  { key: "yearly",      label: "Yearly" },
];

const VIEW_KEYS = ["all", "live", "hidden"] as const;
type View = (typeof VIEW_KEYS)[number];

const EMPTY_PLAN: Omit<Plan, "id" | "sort_order"> = {
  key: "",
  name: "",
  tier: "silver",
  price_paise: 0,
  original_price_paise: null,
  currency: "GBP",
  period: "monthly",
  features: [""],
  is_active: true,
};

type Draftable = Plan | (Omit<Plan, "id" | "sort_order"> & { id?: undefined; sort_order?: undefined });

export default function AdminPricingPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draftable | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [view, setView] = usePersistentState<View>("pricing.view", "all", oneOf(VIEW_KEYS));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listPricingPlans();
      const list = (res.data as any)?.data;
      setPlans(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => plans.filter((p) => view === "all" || (view === "live" ? p.is_active : !p.is_active)),
    [plans, view],
  );
  const liveCount = plans.filter((p) => p.is_active).length;

  // ── Reorder (drag-and-drop, plus keyboard-accessible up/down buttons) ──────
  const commitOrder = async (next: Plan[]) => {
    // Renormalise sort_order in increments of 10 so future inserts have headroom.
    const renumbered = next.map((p, i) => ({ ...p, sort_order: (i + 1) * 10 }));
    setPlans(renumbered); // optimistic
    try {
      const res = await adminApi.reorderPricingPlans(renumbered.map((p) => ({ id: p.id, sort_order: p.sort_order })));
      const list = (res.data as any)?.data;
      if (Array.isArray(list)) setPlans(list);
    } catch (e) {
      load(); // revert
      setError(e instanceof Error ? e.message : "Reorder failed");
    }
  };

  const reorderTo = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const src = plans.findIndex((p) => p.id === sourceId);
    const tgt = plans.findIndex((p) => p.id === targetId);
    if (src < 0 || tgt < 0) return;
    const next = plans.slice();
    const [moved] = next.splice(src, 1);
    next.splice(tgt, 0, moved);
    commitOrder(next);
  };

  const move = (id: string, delta: -1 | 1) => {
    const i = plans.findIndex((p) => p.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= plans.length) return;
    const next = plans.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commitOrder(next);
  };

  const toggleLive = async (p: Plan) => {
    if (togglingId) return;
    setTogglingId(p.id);
    try {
      await adminApi.updatePricingPlan(p.id, { is_active: !p.is_active });
      setPlans((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
      toast("success", `${p.name} is now ${p.is_active ? "hidden" : "live"}`);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not update plan");
    } finally {
      setTogglingId(null);
    }
  };

  const onDelete = async (p: Plan) => {
    setConfirmDelete(null);
    if (deletingId) return;
    setDeletingId(p.id);
    try {
      await adminApi.deletePricingPlan(p.id);
      setPlans((prev) => prev.filter((x) => x.id !== p.id));
      toast("success", `Deleted ${p.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageShell
      title="Pricing plans"
      subtitle="The plans members can subscribe to. Order here is the order on the public pricing page."
      meta={!loading ? <Pill tone="good">{liveCount} live</Pill> : undefined}
      actions={
        <Button variant="primary" size="sm" onClick={() => setEditing({ ...EMPTY_PLAN, features: [""] })}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> New plan
        </Button>
      }
      toolbar={
        plans.length > 0 ? (
          <Segmented<View>
            ariaLabel="Filter plans"
            layoutId="pricing-view-pill"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All", count: plans.length },
              { value: "live", label: "Live", count: liveCount },
              { value: "hidden", label: "Hidden", count: plans.length - liveCount },
            ]}
          />
        ) : undefined
      }
    >
      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-[color:var(--adm-bad-line)] bg-[color:var(--adm-bad-bg)] px-3 py-2 text-[12.5px] adm-fg-bad">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="ml-auto rounded p-0.5 hover:bg-white/60">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[240px] rounded-xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card">
          <EmptyState
            icon={Tag}
            title="No plans yet"
            description="Create Basic, Premium and Elite plans so members can subscribe."
            action={
              <Button variant="primary" size="sm" onClick={() => setEditing({ ...EMPTY_PLAN, features: [""] })}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> New plan
              </Button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card">
          <EmptyState icon={view === "live" ? Eye : EyeOff} title={view === "live" ? "No live plans" : "No hidden plans"} description="Switch the filter to see the rest." />
        </div>
      ) : (
        <motion.div variants={fadeUp} className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {visible.map((p) => {
            const meta = TIERS.find((t) => t.key === p.tier) || TIERS[0];
            const isOver = overId === p.id;
            const isDragging = dragId === p.id;
            const idx = plans.findIndex((x) => x.id === p.id);
            return (
              <div
                key={p.id}
                draggable={view === "all"}
                onDragStart={(e) => { setDragId(p.id); e.dataTransfer?.setData("text/plain", p.id); }}
                onDragOver={(e) => { e.preventDefault(); if (overId !== p.id) setOverId(p.id); }}
                onDragLeave={() => { if (overId === p.id) setOverId(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverId(null);
                  if (dragId) reorderTo(dragId, p.id);
                  setDragId(null);
                }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                className={[
                  "relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 transition-[border-color,box-shadow,opacity] duration-150",
                  isOver ? "border-primary/50 shadow-[0_4px_16px_rgba(26,10,20,0.10)]" : "border-border/70 shadow-[var(--adm-shadow-card)]",
                  isDragging ? "opacity-50" : p.is_active ? "" : "opacity-75",
                ].join(" ")}
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: meta.color }} />

                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {view === "all" && <GripVertical className="h-4 w-4 cursor-grab text-muted2-foreground/60" aria-hidden />}
                    <span className="text-[12px] font-semibold text-foreground">{meta.label}</span>
                    <span className="text-[11px] text-muted2-foreground">· {PERIODS.find((x) => x.key === p.period)?.label ?? p.period}</span>
                  </div>
                  {p.is_active
                    ? <Pill tone="good"><Eye className="h-3 w-3" aria-hidden /> Live</Pill>
                    : <Pill tone="neutral"><EyeOff className="h-3 w-3" aria-hidden /> Hidden</Pill>}
                </div>

                <div className="mb-1">
                  <div className="text-[17px] font-semibold text-foreground">{p.name}</div>
                  <div className="font-mono text-[11px] text-muted2-foreground">{p.key}</div>
                </div>

                <div className="mb-3 flex flex-wrap items-baseline gap-1.5">
                  <span className="text-[28px] font-semibold tracking-[-0.02em] text-foreground">{formatGBP(p.price_paise)}</span>
                  {p.original_price_paise != null && p.original_price_paise > p.price_paise && (
                    <span className="text-[14px] text-muted2-foreground line-through">{formatGBP(p.original_price_paise)}</span>
                  )}
                  <span className="text-[12px] text-muted2-foreground">/ {PERIOD_LABEL[p.period] ?? p.period}</span>
                </div>

                <ul className="mb-4 flex flex-col gap-1.5">
                  {p.features.length === 0 ? (
                    <li className="text-[12px] italic text-muted2-foreground">No features listed</li>
                  ) : (
                    p.features.slice(0, 4).map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-[12.5px] text-foreground/80">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))
                  )}
                  {p.features.length > 4 && (
                    <li className="pl-5 text-[11.5px] text-muted2-foreground">+ {p.features.length - 4} more</li>
                  )}
                </ul>

                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  <Button size="sm" onClick={() => setEditing(p)}>
                    <Edit3 className="h-3.5 w-3.5" aria-hidden /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleLive(p)} loading={togglingId === p.id}>
                    {p.is_active ? <><EyeOff className="h-3.5 w-3.5" aria-hidden /> Hide</> : <><Eye className="h-3.5 w-3.5" aria-hidden /> Publish</>}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(p)} loading={deletingId === p.id}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                  </Button>
                  {view === "all" && (
                    <div className="ml-auto flex items-center">
                      <button
                        type="button"
                        aria-label={`Move ${p.name} earlier`}
                        disabled={idx <= 0}
                        onClick={() => move(p.id, -1)}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted2-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${p.name} later`}
                        disabled={idx >= plans.length - 1}
                        onClick={() => move(p.id, 1)}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted2-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      <PlanEditor
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={(name, isNew) => { setEditing(null); toast("success", isNew ? `Created ${name}` : `Saved ${name}`); load(); }}
      />

      <ConfirmModal
        open={!!confirmDelete}
        title={`Delete ${confirmDelete?.name ?? "plan"}?`}
        message="It disappears from the public pricing page. Members already on it keep their subscription."
        confirmLabel="Delete plan"
        onConfirm={() => confirmDelete && onDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </PageShell>
  );
}

// ─── Editor dialog ───────────────────────────────────────────────────────────

const inputCls = `h-9 ${FIELD}`;

function PlanEditor({
  plan, onClose, onSaved,
}: {
  plan: Draftable | null;
  onClose: () => void;
  onSaved: (name: string, isNew: boolean) => void;
}) {
  const [draft, setDraft] = useState<Omit<Plan, "id" | "sort_order">>({ ...EMPTY_PLAN, features: [""] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset draft each time the dialog opens with a different plan
  useEffect(() => {
    if (plan) {
      setDraft({
        key: plan.key,
        name: plan.name,
        tier: plan.tier,
        price_paise: plan.price_paise,
        original_price_paise: plan.original_price_paise ?? null,
        currency: plan.currency || "GBP",
        period: plan.period,
        features: plan.features.length > 0 ? plan.features : [""],
        is_active: plan.is_active,
      });
      setErr(null);
    }
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plan, onClose]);

  const isNew = !!plan && !("id" in plan && plan.id);

  const save = async () => {
    if (saving || !plan) return;
    if (!draft.name.trim()) { setErr("Give the plan a display name."); return; }
    if (isNew && !draft.key.trim()) { setErr("Give the plan an internal key, e.g. elite-6m."); return; }
    setSaving(true);
    setErr(null);
    try {
      const cleanFeatures = draft.features.map((s) => s.trim()).filter(Boolean);
      const body = { ...draft, features: cleanFeatures };
      if (isNew) await adminApi.createPricingPlan(body);
      else await adminApi.updatePricingPlan((plan as Plan).id, body);
      onSaved(draft.name, isNew);
    } catch (e: any) {
      const detail = (e as any)?.detail ?? e?.response?.data?.detail;
      setErr(typeof detail === "string" ? detail : (e?.message || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {plan && (
        <motion.div
          key="editor-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-[1000] grid place-items-center bg-[rgba(26,10,20,0.45)] p-4"
        >
          <motion.div
            key="editor-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-editor-title"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-[540px] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-[0_24px_60px_rgba(26,10,20,0.22)]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-muted2-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 id="plan-editor-title" className="mb-1 text-[18px] font-semibold text-foreground">
              {isNew ? "New plan" : `Edit ${plan.name}`}
            </h3>
            <p className="mb-5 text-[12.5px] text-muted2-foreground">Plans control what shows on your public pricing page.</p>

            {err && (
              <div role="alert" className="mb-4 rounded-lg border border-[color:var(--adm-bad-line)] bg-[color:var(--adm-bad-bg)] px-3 py-2 text-[12.5px] adm-fg-bad">{err}</div>
            )}

            <div className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Display name" htmlFor="pe-name">
                  <input id="pe-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Elite" className={inputCls} />
                </Field>
                <Field label="Internal key" htmlFor="pe-key" hint={isNew ? undefined : "Fixed after creation"}>
                  <input
                    id="pe-key"
                    value={draft.key}
                    onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase() })}
                    placeholder="e.g. elite-6m"
                    disabled={!isNew}
                    className={`${inputCls} font-mono`}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Tier" htmlFor="pe-tier">
                  <select id="pe-tier" value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value as Tier })} className={inputCls}>
                    {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Billing period" htmlFor="pe-period">
                  <select id="pe-period" value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value as Period })} className={inputCls}>
                    {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={`Price (${draft.currency})`} htmlFor="pe-price">
                  <input
                    id="pe-price"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={draft.price_paise / 100}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value || "0");
                      setDraft({ ...draft, price_paise: Math.max(0, Math.round(v * 100)) });
                    }}
                    className={`${inputCls} tabular-nums`}
                  />
                </Field>
                <Field label="Currency" htmlFor="pe-currency">
                  <input
                    id="pe-currency"
                    value={draft.currency}
                    onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase().slice(0, 3) })}
                    className={`${inputCls} font-mono`}
                  />
                </Field>
              </div>

              <Field
                label={`Regular price (${draft.currency}), optional`}
                htmlFor="pe-original"
                hint="Shown struck through next to the live price, e.g. a free inaugural offer that's regularly £100."
              >
                <input
                  id="pe-original"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Leave blank for none"
                  value={draft.original_price_paise != null ? draft.original_price_paise / 100 : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") { setDraft({ ...draft, original_price_paise: null }); return; }
                    const v = parseFloat(raw);
                    setDraft({ ...draft, original_price_paise: Number.isFinite(v) ? Math.max(0, Math.round(v * 100)) : null });
                  }}
                  className={`${inputCls} tabular-nums sm:max-w-[50%]`}
                />
              </Field>

              <Field label="Features">
                <div className="flex flex-col gap-1.5">
                  {draft.features.map((f, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input
                        value={f}
                        aria-label={`Feature ${i + 1}`}
                        onChange={(e) => {
                          const next = draft.features.slice();
                          next[i] = e.target.value;
                          setDraft({ ...draft, features: next });
                        }}
                        placeholder="e.g. Unlimited interests"
                        className={`${inputCls} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, features: draft.features.filter((_, j) => j !== i) })}
                        aria-label={`Remove feature ${i + 1}`}
                        className="grid w-9 shrink-0 place-items-center rounded-lg border border-border text-muted2-foreground hover:bg-[color:var(--adm-bad-bg)] hover:text-[color:var(--adm-bad)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, features: [...draft.features, ""] })}
                    className="inline-flex h-8 items-center gap-1 self-start rounded-lg border border-dashed border-border px-3 text-[12px] font-medium text-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Add feature
                  </button>
                </div>
              </Field>

              <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] ${draft.is_active ? "border-[color:var(--adm-good-line)] bg-[color:var(--adm-good-bg)]" : "border-border bg-secondary/40"}`}>
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                <span className="font-medium text-foreground">
                  {draft.is_active ? "Live, visible on the public pricing page" : "Hidden, not shown to members"}
                </span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={save} loading={saving}>
                {isNew ? "Create plan" : "Save changes"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-medium text-muted2-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] leading-snug text-muted2-foreground">{hint}</p>}
    </div>
  );
}
