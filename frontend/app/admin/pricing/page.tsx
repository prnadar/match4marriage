"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Tag, Plus, X, Trash2, Edit3, GripVertical, Check,
  Eye, EyeOff,
} from "lucide-react";
import { PageShell, GlassCard, Button, fadeUp } from "@/components/admin/PageShell";
import { adminApi, ApiError } from "@/lib/api";

type Tier = "silver" | "gold" | "platinum";
type Period = "monthly" | "quarterly" | "yearly";

interface Plan {
  id: string;
  key: string;
  name: string;
  tier: Tier;
  price_paise: number;
  currency: string;
  period: Period;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

const TIERS: Array<{ key: Tier; label: string; color: string }> = [
  { key: "silver",   label: "Silver",   color: "#7d8a93" },
  { key: "gold",     label: "Gold",     color: "#c9954a" },
  { key: "platinum", label: "Platinum", color: "#5d4b8a" },
];

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "monthly",   label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly",    label: "Yearly" },
];

function formatRupees(paise: number): string {
  if (!Number.isFinite(paise) || paise === 0) return "₹0";
  const rupees = paise / 100;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)} L`;
  if (rupees >= 1_000) return `₹${rupees.toLocaleString("en-IN")}`;
  return `₹${rupees.toFixed(0)}`;
}

const EMPTY_PLAN: Omit<Plan, "id" | "sort_order"> = {
  key: "",
  name: "",
  tier: "silver",
  price_paise: 0,
  currency: "INR",
  period: "monthly",
  features: [""],
  is_active: true,
};

export default function AdminPricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | (Omit<Plan, "id" | "sort_order"> & { id?: undefined; sort_order?: undefined }) | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

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

  // ── Reorder via HTML5 DnD ──────────────────────────────────────────────────
  const reorderTo = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const src = plans.findIndex((p) => p.id === sourceId);
    const tgt = plans.findIndex((p) => p.id === targetId);
    if (src < 0 || tgt < 0) return;
    const next = plans.slice();
    const [moved] = next.splice(src, 1);
    next.splice(tgt, 0, moved);
    // Renormalise sort_order in increments of 10 so future inserts have headroom.
    const renumbered = next.map((p, i) => ({ ...p, sort_order: (i + 1) * 10 }));
    setPlans(renumbered); // optimistic
    try {
      const res = await adminApi.reorderPricingPlans(
        renumbered.map((p) => ({ id: p.id, sort_order: p.sort_order }))
      );
      const list = (res.data as any)?.data;
      if (Array.isArray(list)) setPlans(list);
    } catch (e) {
      // Revert on failure
      load();
      setError(e instanceof Error ? e.message : "Reorder failed");
    }
  };

  const onDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await adminApi.deletePricingPlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageShell
      title="Pricing plans"
      subtitle="The plans your members can subscribe to. Drag to reorder."
      actions={
        <Button onClick={() => setEditing({ ...EMPTY_PLAN, features: [""] })}>
          <Plus style={{ width: 14, height: 14 }} /> New plan
        </Button>
      }
    >
      {error && (
        <div style={{
          padding: "10px 14px", marginBottom: 14,
          background: "#ffe9ec", border: "1px solid rgba(220,30,60,0.18)",
          borderRadius: 10, fontSize: 12, color: "#a0153c",
        }}>
          <AlertTriangle style={{ width: 13, height: 13, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="m4m-shimmer" style={{ height: 220, borderRadius: 16 }} />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <GlassCard>
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#999" }}>
            <Tag style={{ width: 36, height: 36, color: "#e5e5e5", margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 13, margin: "0 0 14px" }}>No plans yet. Create your first.</p>
            <Button onClick={() => setEditing({ ...EMPTY_PLAN, features: [""] })}>
              <Plus style={{ width: 14, height: 14 }} /> New plan
            </Button>
          </div>
        </GlassCard>
      ) : (
        <motion.div
          variants={fadeUp}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}
        >
          {plans.map((p, i) => {
            const meta = TIERS.find((t) => t.key === p.tier) || TIERS[0];
            const isOver = overId === p.id;
            const isDragging = dragId === p.id;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: isDragging ? 0.45 : 1, y: 0 }}
                transition={{ delay: Math.min(0.5, i * 0.04), duration: 0.28 }}
                draggable
                onDragStart={(e) => {
                  setDragId(p.id);
                  // Required for Firefox to start a drag.
                  (e as unknown as DragEvent).dataTransfer?.setData("text/plain", p.id);
                }}
                onDragOver={(e) => { e.preventDefault(); if (overId !== p.id) setOverId(p.id); }}
                onDragLeave={() => { if (overId === p.id) setOverId(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverId(null);
                  if (dragId) reorderTo(dragId, p.id);
                  setDragId(null);
                }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                style={{
                  position: "relative",
                  padding: 18,
                  borderRadius: 16,
                  background: p.is_active
                    ? `linear-gradient(160deg, #ffffff 0%, ${meta.color}10 100%)`
                    : "#f7f6f5",
                  border: `1px solid ${isOver ? meta.color : "rgba(220,30,60,0.10)"}`,
                  boxShadow: isOver
                    ? `0 8px 24px ${meta.color}38`
                    : "0 4px 16px rgba(220,30,60,0.05)",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  cursor: "grab",
                  opacity: p.is_active ? 1 : 0.72,
                }}
              >
                {/* Drag handle hint */}
                <div style={{
                  position: "absolute", top: 12, left: 12,
                  color: "#bbb", display: "flex", alignItems: "center",
                }}>
                  <GripVertical style={{ width: 14, height: 14 }} />
                </div>

                {/* Tier chip */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginLeft: 22, marginBottom: 12 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                    padding: "3px 10px", borderRadius: 999,
                    background: `${meta.color}22`, color: meta.color,
                  }}>
                    {meta.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: p.is_active ? "#3F5937" : "#999",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    {p.is_active
                      ? <><Eye style={{ width: 11, height: 11 }} /> Live</>
                      : <><EyeOff style={{ width: 11, height: 11 }} /> Hidden</>}
                  </span>
                </div>

                {/* Name + key */}
                <div style={{ marginLeft: 22, marginBottom: 6 }}>
                  <div style={{
                    fontFamily: "var(--font-playfair, serif)",
                    fontSize: 20, fontWeight: 700, color: "#1a0a14",
                  }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>{p.key}</div>
                </div>

                {/* Price */}
                <div style={{ marginLeft: 22, display: "flex", alignItems: "baseline", gap: 4, marginBottom: 12 }}>
                  <span style={{
                    fontFamily: "var(--font-playfair, serif)",
                    fontSize: 28, fontWeight: 700, color: "#1a0a14",
                  }}>
                    {formatRupees(p.price_paise)}
                  </span>
                  <span style={{ fontSize: 12, color: "#888" }}>/ {p.period.replace(/ly$/, "")}</span>
                </div>

                {/* Features */}
                <ul style={{
                  margin: "0 0 14px 22px", padding: 0, listStyle: "none",
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  {p.features.length === 0 ? (
                    <li style={{ fontSize: 12, color: "#bbb", fontStyle: "italic" }}>No features listed</li>
                  ) : (
                    p.features.slice(0, 4).map((f, j) => (
                      <li key={j} style={{
                        fontSize: 12, color: "#555", display: "flex", gap: 8, alignItems: "flex-start",
                      }}>
                        <Check style={{ width: 12, height: 12, color: meta.color, marginTop: 3, flexShrink: 0 }} />
                        <span>{f}</span>
                      </li>
                    ))
                  )}
                  {p.features.length > 4 && (
                    <li style={{ fontSize: 11, color: "#aaa", marginLeft: 20 }}>+ {p.features.length - 4} more</li>
                  )}
                </ul>

                {/* Actions */}
                <div style={{ marginLeft: 22, display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setEditing(p)}
                    style={smallBtnStyle}
                  >
                    <Edit3 style={{ width: 12, height: 12 }} /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(p.id)}
                    disabled={deletingId === p.id}
                    style={{ ...smallBtnStyle, color: "#a0153c", borderColor: "rgba(220,30,60,0.2)" }}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} /> {deletingId === p.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <PlanEditor
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </PageShell>
  );
}

// ─── Editor modal ────────────────────────────────────────────────────────────

function PlanEditor({
  plan, onClose, onSaved,
}: {
  plan: Plan | (Omit<Plan, "id" | "sort_order"> & { id?: undefined }) | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Omit<Plan, "id" | "sort_order">>({ ...EMPTY_PLAN, features: [""] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset draft each time the modal opens with a different plan
  useEffect(() => {
    if (plan) {
      setDraft({
        key: plan.key,
        name: plan.name,
        tier: plan.tier,
        price_paise: plan.price_paise,
        currency: plan.currency || "INR",
        period: plan.period,
        features: plan.features.length > 0 ? plan.features : [""],
        is_active: plan.is_active,
      });
      setErr(null);
    }
  }, [plan]);

  if (!plan) return null;
  const isNew = !("id" in plan && plan.id);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      const cleanFeatures = draft.features.map((s) => s.trim()).filter(Boolean);
      const body = { ...draft, features: cleanFeatures };
      if (isNew) {
        await adminApi.createPricingPlan(body);
      } else {
        await adminApi.updatePricingPlan((plan as Plan).id, body);
      }
      onSaved();
    } catch (e: any) {
      const detail = (e as any)?.detail ?? e?.response?.data?.detail;
      setErr(typeof detail === "string" ? detail : (e?.message || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="editor-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(26,10,20,0.55)", backdropFilter: "blur(6px)",
          display: "grid", placeItems: "center", padding: 16,
        }}
      >
        <motion.div
          key="editor-card"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative", width: "100%", maxWidth: 520,
            maxHeight: "90vh", overflowY: "auto",
            padding: "26px 28px 22px", borderRadius: 18,
            background: "#fff", border: "1px solid rgba(220,30,60,0.12)",
            boxShadow: "0 24px 60px rgba(220,30,60,0.18)",
          }}
        >
          <button onClick={onClose} aria-label="Close" style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 8,
            width: 30, height: 30, display: "grid", placeItems: "center",
            cursor: "pointer", color: "#888",
          }}>
            <X style={{ width: 14, height: 14 }} />
          </button>

          <h3 style={{
            fontFamily: "var(--font-playfair, serif)", fontSize: 20, fontWeight: 700,
            margin: "0 0 4px", color: "#1a0a14",
          }}>
            {isNew ? "New plan" : "Edit plan"}
          </h3>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 18px" }}>
            Plans control what shows on your public pricing page.
          </p>

          {err && (
            <div style={{
              padding: "10px 12px", marginBottom: 14,
              background: "#ffe9ec", border: "1px solid rgba(220,30,60,0.18)",
              borderRadius: 8, fontSize: 12, color: "#a0153c",
            }}>{err}</div>
          )}

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Display name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Gold"
                  style={inputStyle}
                />
              </Field>
              <Field label="Internal key">
                <input
                  value={draft.key}
                  onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase() })}
                  placeholder="e.g. gold-monthly"
                  disabled={!isNew}
                  style={{ ...inputStyle, fontFamily: "monospace", opacity: isNew ? 1 : 0.6 }}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Tier">
                <select
                  value={draft.tier}
                  onChange={(e) => setDraft({ ...draft, tier: e.target.value as Tier })}
                  style={inputStyle}
                >
                  {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Period">
                <select
                  value={draft.period}
                  onChange={(e) => setDraft({ ...draft, period: e.target.value as Period })}
                  style={inputStyle}
                >
                  {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={`Price (${draft.currency})`}>
                <input
                  type="number"
                  min={0}
                  value={draft.price_paise / 100}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value || "0");
                    setDraft({ ...draft, price_paise: Math.max(0, Math.round(v * 100)) });
                  }}
                  style={inputStyle}
                />
              </Field>
              <Field label="Currency">
                <input
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase().slice(0, 3) })}
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                />
              </Field>
            </div>

            <Field label="Features">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {draft.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 6 }}>
                    <input
                      value={f}
                      onChange={(e) => {
                        const next = draft.features.slice();
                        next[i] = e.target.value;
                        setDraft({ ...draft, features: next });
                      }}
                      placeholder="e.g. Unlimited interests"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, features: draft.features.filter((_, j) => j !== i) })}
                      style={{
                        background: "rgba(220,30,60,0.06)", border: "none", borderRadius: 8,
                        width: 36, display: "grid", placeItems: "center",
                        cursor: "pointer", color: "#a0153c",
                      }}
                      aria-label="Remove feature"
                    >
                      <X style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, features: [...draft.features, ""] })}
                  style={{
                    alignSelf: "flex-start",
                    background: "transparent", border: "1px dashed rgba(220,30,60,0.25)",
                    borderRadius: 8, padding: "6px 12px",
                    fontSize: 12, fontWeight: 600, color: "#a0153c",
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Plus style={{ width: 12, height: 12 }} /> Add feature
                </button>
              </div>
            </Field>

            <label style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10,
              background: draft.is_active ? "rgba(92,122,82,0.08)" : "rgba(0,0,0,0.03)",
              border: `1px solid ${draft.is_active ? "rgba(92,122,82,0.2)" : "rgba(0,0,0,0.06)"}`,
              cursor: "pointer", fontSize: 13,
            }}>
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                style={{ accentColor: "#dc1e3c" }}
              />
              <span style={{ flex: 1, color: "#1a0a14", fontWeight: 500 }}>
                {draft.is_active ? "Live — visible on public pricing page" : "Hidden — not shown to users"}
              </span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
            <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : isNew ? "Create plan" : "Save changes"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "#555",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
      }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "inherit", fontSize: 13.5, color: "#1a0a14",
  border: "1px solid rgba(220,30,60,0.18)", borderRadius: 8,
  padding: "9px 12px", outline: "none", background: "#fff",
  boxSizing: "border-box",
};

const smallBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "6px 12px", borderRadius: 8,
  background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
  fontSize: 12, fontWeight: 600, color: "#1a0a14",
  cursor: "pointer", fontFamily: "inherit",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 10,
  background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)",
  fontSize: 13, fontWeight: 600, color: "#666",
  cursor: "pointer", fontFamily: "inherit",
};
