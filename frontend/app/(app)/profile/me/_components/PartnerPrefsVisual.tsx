"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, Heart } from "lucide-react";
import { api } from "@/lib/api";

// ─── Choice constants — keep aligned with the legacy PartnerTab ───────────────

const RELIGIONS = ["Hindu", "Christian", "Sikh", "Jain", "Buddhist", "Muslim"];
const DIETS     = ["Vegetarian", "Non-Vegetarian", "Eggetarian", "Vegan"];
const COUNTRIES = ["UK", "India", "UAE", "USA", "Canada", "Australia", "Singapore", "Other"];
const MARITAL   = ["Never Married", "Divorced", "Widowed"];
const TONGUES   = ["Malayalam", "Tamil", "Telugu", "Kannada", "Hindi", "English", "Other"];
const EDUCATION = ["High School", "Diploma", "Graduate / Bachelor's", "Post Graduate / Master's", "Doctorate / PhD", "Professional Degree (MBBS / LLB / CA)", "Trade / Vocational"];
const RES_STATUS = ["Citizen", "Permanent Resident", "Work Permit", "Student Visa"];

// Height range (cm); we display in ft/in but slide on cm internally so the
// arithmetic is correct.
const MIN_H_CM = 137;  // 4ft 6in
const MAX_H_CM = 213;  // 7ft 0in

const MIN_AGE = 18;
const MAX_AGE = 70;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cmToFtIn(cm: number): string {
  const totalIn = Math.round(cm / 2.54);
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn % 12;
  return `${ft}ft ${inch}in`;
}
function ftInToCm(label: string): number | null {
  // Accept "5ft 8in" or just "5ft".
  const m = label.match(/(\d+)\s*ft(?:\s*(\d+)\s*in)?/i);
  if (!m) return null;
  const ft = parseInt(m[1], 10);
  const inch = m[2] ? parseInt(m[2], 10) : 0;
  return Math.round(ft * 30.48 + inch * 2.54);
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function parseInt0(v: string, fallback: number): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Toggle a value in a comma-separated string (the legacy `update("country", v)`
// API takes a string, so multi-select state is encoded as "A, B, C").
function toggleCsv(csv: string, value: string): string {
  const parts = csv.split(",").map((s) => s.trim()).filter(Boolean);
  const idx = parts.indexOf(value);
  if (idx >= 0) parts.splice(idx, 1);
  else parts.push(value);
  return parts.join(", ");
}
function csvSet(csv: string): Set<string> {
  return new Set(csv.split(",").map((s) => s.trim()).filter(Boolean));
}

// ─── Public component ────────────────────────────────────────────────────────

interface Props {
  form: Record<string, string>;
  update: (field: string, value: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function PartnerPrefsVisual({ form, update, onSave, saving }: Props) {
  const reduce = useReducedMotion();

  // Range sliders — derive from form, but keep local tuning state for smooth drags.
  const ageFrom = clamp(parseInt0(form.ageFrom, MIN_AGE), MIN_AGE, MAX_AGE);
  const ageTo   = clamp(parseInt0(form.ageTo,   MAX_AGE), MIN_AGE, MAX_AGE);
  const hFrom   = clamp(ftInToCm(form.heightFrom) ?? MIN_H_CM, MIN_H_CM, MAX_H_CM);
  const hTo     = clamp(ftInToCm(form.heightTo)   ?? MAX_H_CM, MIN_H_CM, MAX_H_CM);

  const setAgeFrom = (v: number) => update("ageFrom", String(clamp(v, MIN_AGE, ageTo)));
  const setAgeTo   = (v: number) => update("ageTo",   String(clamp(v, ageFrom, MAX_AGE)));
  const setHFrom   = (cm: number) => update("heightFrom", cmToFtIn(clamp(cm, MIN_H_CM, hTo)));
  const setHTo     = (cm: number) => update("heightTo",   cmToFtIn(clamp(cm, hFrom, MAX_H_CM)));

  // Multi-select state lives in the existing string fields as comma-separated.
  const religionSel = csvSet(form.religionPref || "");
  const dietSel     = csvSet(form.diet         || "");
  const countrySel  = csvSet(form.country      || "");
  const maritalSel  = csvSet(form.maritalStatus || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Hero count={[ageFrom, ageTo, hFrom, hTo].filter(Boolean).length + religionSel.size + dietSel.size + countrySel.size + maritalSel.size} />

      <Card title="Age & height">
        <Row label="Age" value={`${ageFrom}–${ageTo} yrs`}>
          <DualRange
            min={MIN_AGE} max={MAX_AGE} step={1}
            from={ageFrom} to={ageTo}
            onFrom={setAgeFrom} onTo={setAgeTo}
            formatValue={(v) => `${v}`}
            reduce={!!reduce}
          />
        </Row>
        <Row label="Height" value={`${cmToFtIn(hFrom)} – ${cmToFtIn(hTo)}`}>
          <DualRange
            min={MIN_H_CM} max={MAX_H_CM} step={1}
            from={hFrom} to={hTo}
            onFrom={setHFrom} onTo={setHTo}
            formatValue={(v) => cmToFtIn(v)}
            reduce={!!reduce}
          />
        </Row>
      </Card>

      <Card title="Background — pick any that fit">
        <PillGroup
          label="Marital status"
          options={MARITAL}
          selected={maritalSel}
          onToggle={(v) => update("maritalStatus", toggleCsv(form.maritalStatus || "", v))}
          reduce={!!reduce}
        />
        <PillGroup
          label="Religion"
          options={RELIGIONS}
          selected={religionSel}
          onToggle={(v) => update("religionPref", toggleCsv(form.religionPref || "", v))}
          reduce={!!reduce}
        />
        <PillGroup
          label="Diet"
          options={DIETS}
          selected={dietSel}
          onToggle={(v) => update("diet", toggleCsv(form.diet || "", v))}
          reduce={!!reduce}
        />
        <PillGroup
          label="Country"
          options={COUNTRIES}
          selected={countrySel}
          onToggle={(v) => update("country", toggleCsv(form.country || "", v))}
          reduce={!!reduce}
        />
      </Card>

      <Card title="Education, occupation & language">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <SimpleField label="Mother tongue">
            <select
              value={form.motherTongue || ""}
              onChange={(e) => update("motherTongue", e.target.value)}
              style={selectStyle}
            >
              <option value="">Any</option>
              {TONGUES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </SimpleField>
          <SimpleField label="Education">
            <select
              value={form.education || ""}
              onChange={(e) => update("education", e.target.value)}
              style={selectStyle}
            >
              <option value="">Any</option>
              {EDUCATION.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </SimpleField>
          <SimpleField label="Occupation">
            <input
              value={form.occupation || ""}
              onChange={(e) => update("occupation", e.target.value)}
              placeholder="e.g. Software, Doctor, Business"
              style={selectStyle}
            />
          </SimpleField>
          <SimpleField label="Residential status">
            <select
              value={form.residentialStatus || ""}
              onChange={(e) => update("residentialStatus", e.target.value)}
              style={selectStyle}
            >
              <option value="">Any</option>
              {RES_STATUS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </SimpleField>
          <SimpleField label="Caste / denomination">
            <input
              value={form.denomination || ""}
              onChange={(e) => update("denomination", e.target.value)}
              placeholder="Any or specify (e.g. Nair)"
              style={selectStyle}
            />
          </SimpleField>
        </div>
      </Card>

      <Card title="In your own words">
        <textarea
          value={form.aboutPartner || ""}
          onChange={(e) => update("aboutPartner", e.target.value)}
          placeholder="Describe the kind of person you're looking for, their values, personality, and what matters most to you in a life partner…"
          rows={4}
          style={{ ...selectStyle, lineHeight: 1.6, resize: "vertical" }}
        />
      </Card>

      {/* Live match teaser */}
      <MatchPreview
        ageFrom={ageFrom} ageTo={ageTo}
        religions={Array.from(religionSel)}
        countries={Array.from(countrySel)}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 6 }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "12px 24px", borderRadius: 10, border: "none",
            background: saving
              ? "rgba(123,45,58,0.5)"
              : "linear-gradient(135deg, #dc1e3c, #7B2D3A)",
            color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
            boxShadow: saving ? "none" : "0 6px 18px rgba(220,30,60,0.28)",
            fontFamily: "inherit",
          }}
        >
          {saving ? "Saving…" : "Save partner preferences"}
        </button>
      </div>
    </div>
  );
}

// ─── Hero strip ──────────────────────────────────────────────────────────────

function Hero({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: "relative",
        padding: "16px 18px",
        borderRadius: 14,
        background: "linear-gradient(135deg, #fff8ec 0%, #fff1f3 100%)",
        border: "1px solid rgba(201,149,74,0.22)",
        boxShadow: "0 6px 20px rgba(220,30,60,0.06)",
        overflow: "hidden",
      }}
    >
      <div aria-hidden style={{
        position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(240,201,135,0.35), transparent 70%)",
        filter: "blur(28px)", pointerEvents: "none",
      }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: "linear-gradient(135deg, #f0c987, #c9954a)",
          display: "grid", placeItems: "center",
          boxShadow: "0 6px 16px rgba(201,149,74,0.35)",
        }}>
          <Sparkles style={{ width: 18, height: 18, color: "#fff" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: 17, fontWeight: 700, color: "#1a0a14",
            letterSpacing: "-0.01em",
          }}>
            Tell us who you&apos;re looking for
          </div>
          <div style={{ fontSize: 12.5, color: "#888", marginTop: 2 }}>
            We&apos;ll match you against people who fit. Drag the ranges, tap the chips.
            {count > 0 && <span style={{ marginLeft: 6, color: "#7a5a1d", fontWeight: 600 }}>· {count} preferences set</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Card / row primitives ───────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 18, borderRadius: 14,
      background: "#fff", border: "1px solid rgba(220,30,60,0.08)",
      boxShadow: "0 2px 14px rgba(220,30,60,0.04)",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "#777", marginBottom: 14,
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a0a14" }}>{label}</span>
        <span style={{ fontSize: 13, color: "#a0153c", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      {children}
    </div>
  );
}

function SimpleField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "#555",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
      }}>{label}</div>
      {children}
    </label>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "9px 12px", border: "1px solid rgba(220,30,60,0.18)", borderRadius: 8,
  fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "#fff",
  color: "#1a0a14",
};

// ─── Pill multi-select group ────────────────────────────────────────────────

function PillGroup({
  label, options, selected, onToggle, reduce,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  reduce: boolean;
}) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "#555",
        textTransform: "uppercase", letterSpacing: "0.06em",
        display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
      }}>
        <span>{label}</span>
        {selected.size > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            padding: "1px 6px", borderRadius: 999,
            background: "rgba(220,30,60,0.10)", color: "#a0153c",
          }}>{selected.size} selected</span>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = selected.has(opt);
          return (
            <motion.button
              key={opt}
              type="button"
              whileTap={reduce ? undefined : { scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              onClick={() => onToggle(opt)}
              style={{
                padding: "7px 13px", borderRadius: 999,
                border: `1px solid ${active ? "rgba(220,30,60,0.4)" : "rgba(0,0,0,0.08)"}`,
                background: active
                  ? "linear-gradient(135deg, rgba(220,30,60,0.10), rgba(160,21,60,0.06))"
                  : "#fdfbf9",
                color: active ? "#a0153c" : "#555",
                fontSize: 12.5, fontWeight: active ? 600 : 500,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: active ? "0 2px 8px rgba(220,30,60,0.14)" : "none",
                transition: "background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s",
              }}
            >
              {opt}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dual-handle range slider ───────────────────────────────────────────────

function DualRange({
  min, max, step,
  from, to,
  onFrom, onTo,
  formatValue,
  reduce,
}: {
  min: number; max: number; step: number;
  from: number; to: number;
  onFrom: (v: number) => void;
  onTo: (v: number) => void;
  formatValue: (v: number) => string;
  reduce: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"from" | "to" | null>(null);
  const [hover, setHover] = useState<"from" | "to" | null>(null);

  const span = max - min || 1;
  const fromPct = ((from - min) / span) * 100;
  const toPct   = ((to   - min) / span) * 100;

  // Map a clientX on the track to a snapped value.
  const valueAtX = (clientX: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const ratio = clamp((clientX - r.left) / r.width, 0, 1);
    const raw = min + ratio * span;
    return Math.round(raw / step) * step;
  };

  const beginDrag = (handle: "from" | "to") => (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(handle);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Global pointer listeners while dragging
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const v = valueAtX(e.clientX);
      if (v == null) return;
      if (dragging === "from") onFrom(v);
      else onTo(v);
    };
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // valueAtX is stable enough — depends only on min/max/step which are stable on a single render of DualRange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, onFrom, onTo]);

  // Click on track — move the nearest handle.
  const onTrackClick = (e: React.PointerEvent) => {
    if (dragging) return;
    const v = valueAtX(e.clientX);
    if (v == null) return;
    const distFrom = Math.abs(v - from);
    const distTo   = Math.abs(v - to);
    if (distFrom <= distTo) onFrom(v);
    else onTo(v);
  };

  return (
    <div style={{ position: "relative", padding: "16px 14px 30px" }}>
      <div
        ref={trackRef}
        onPointerDown={onTrackClick}
        style={{
          position: "relative",
          height: 6, borderRadius: 4,
          background: "rgba(0,0,0,0.06)",
          cursor: "pointer",
          touchAction: "none",
        }}
      >
        {/* Selected range highlight */}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${fromPct}%`, right: `${100 - toPct}%`,
          background: "linear-gradient(90deg, #dc1e3c, #a0153c)",
          borderRadius: 4,
          boxShadow: "0 2px 8px rgba(220,30,60,0.25)",
        }} />

        {/* Handles */}
        <Handle
          pct={fromPct}
          active={dragging === "from" || hover === "from"}
          onPointerDown={beginDrag("from")}
          onMouseEnter={() => setHover("from")}
          onMouseLeave={() => setHover(null)}
          tooltip={formatValue(from)}
          reduce={reduce}
        />
        <Handle
          pct={toPct}
          active={dragging === "to" || hover === "to"}
          onPointerDown={beginDrag("to")}
          onMouseEnter={() => setHover("to")}
          onMouseLeave={() => setHover(null)}
          tooltip={formatValue(to)}
          reduce={reduce}
        />
      </div>
    </div>
  );
}

function Handle({
  pct, active, onPointerDown, onMouseEnter, onMouseLeave, tooltip, reduce,
}: {
  pct: number;
  active: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  tooltip: string;
  reduce: boolean;
}) {
  return (
    <motion.div
      animate={reduce ? {} : { scale: active ? 1.15 : 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      onPointerDown={onPointerDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "absolute", top: "50%",
        left: `${pct}%`, transform: "translate(-50%, -50%)",
        width: 22, height: 22, borderRadius: "50%",
        background: "#fff",
        border: "2px solid #dc1e3c",
        boxShadow: active
          ? "0 4px 14px rgba(220,30,60,0.42), 0 0 0 6px rgba(220,30,60,0.10)"
          : "0 2px 8px rgba(220,30,60,0.25)",
        cursor: "grab",
        touchAction: "none",
      }}
    >
      <AnimatePresence>
        {active && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", left: "50%", bottom: "calc(100% + 8px)",
              transform: "translateX(-50%)",
              padding: "3px 8px", borderRadius: 6,
              background: "#1a0a14", color: "#fff",
              fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              fontFamily: "inherit",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {tooltip}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Live match preview ─────────────────────────────────────────────────────

interface PreviewCard {
  user_id: string;
  first_name: string;
  age: number | null;
  city: string | null;
  primary_photo_url?: string | null;
}

function MatchPreview({
  ageFrom, ageTo, religions, countries,
}: {
  ageFrom: number; ageTo: number;
  religions: string[];
  countries: string[];
}) {
  const [cards, setCards] = useState<PreviewCard[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  // Religion enum on the backend accepts a single value, so we send the first.
  const religion = religions[0]?.toLowerCase();
  // Browse takes one location string; pick the first country if any.
  const location = countries[0];

  // Debounce all dependents into a single key so the effect runs once per "settled" change.
  const key = useMemo(
    () => `${ageFrom}|${ageTo}|${religion ?? ""}|${location ?? ""}`,
    [ageFrom, ageTo, religion, location]
  );

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("min_age", String(ageFrom));
        params.set("max_age", String(ageTo));
        params.set("limit", "3");
        params.set("has_photo", "true");
        if (religion) params.set("religion", religion);
        if (location) params.set("location", location);
        const res = await api.get<{ data: PreviewCard[]; total: number }>(
          `/api/v1/profile/browse?${params.toString()}`
        );
        if (cancelled) return;
        const payload = res.data as any;
        const list: PreviewCard[] = Array.isArray(payload?.data) ? payload.data : [];
        setCards(list);
        setTotal(typeof payload?.total === "number" ? payload.total : list.length);
      } catch {
        // Silent — preview is a nice-to-have, never blocks the form.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isEmpty = !loading && cards.length === 0;

  return (
    <div style={{
      padding: 18, borderRadius: 14,
      background: "linear-gradient(160deg, #fffaf6 0%, #fff1f3 100%)",
      border: "1px solid rgba(220,30,60,0.10)",
      boxShadow: "0 4px 18px rgba(220,30,60,0.05)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Heart style={{ width: 14, height: 14, color: "#dc1e3c" }} fill="#dc1e3c" />
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#777",
          }}>Sample matches</span>
        </div>
        <span style={{ fontSize: 11, color: "#888" }}>
          {loading ? "Searching…" : total != null && total > cards.length
            ? `+${total - cards.length} more match these filters`
            : null}
        </span>
      </div>

      {isEmpty ? (
        <div style={{ textAlign: "center", padding: "16px 0", color: "#aaa", fontSize: 12 }}>
          No matches yet — try widening your range or removing a filter.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          <AnimatePresence mode="popLayout">
            {(loading && cards.length === 0
              ? Array.from({ length: 3 }).map((_, i) => ({ user_id: `s-${i}`, first_name: "", age: null, city: null, primary_photo_url: null }))
              : cards
            ).map((c, i) => (
              <motion.div
                key={c.user_id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                style={{
                  position: "relative",
                  padding: 12, borderRadius: 12,
                  background: "#fff",
                  border: "1px solid rgba(220,30,60,0.08)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  minHeight: 120,
                }}
              >
                {/* Avatar — initial only; we deliberately don't show the photo to keep the preview anonymized. */}
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                  display: "grid", placeItems: "center",
                  color: "#fff", fontFamily: "var(--font-playfair, serif)",
                  fontSize: 20, fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(220,30,60,0.28)",
                }}>
                  {(c.first_name?.[0] || "?").toUpperCase()}
                </div>
                <div style={{ textAlign: "center", minWidth: 0, width: "100%" }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: "#1a0a14",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {c.first_name ? `${c.first_name[0]}.` : "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {[c.age ? `${c.age}` : null, c.city].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
