"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, Image as ImageIcon,
  ChevronRight, Search, Heart, MessageSquare, AlertTriangle,
  User, MapPin, GraduationCap, X, Inbox,
} from "lucide-react";
import { PageShell, GlassCard, Button, fadeUp } from "@/components/admin/PageShell";
import { adminApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";

type Status = "draft" | "submitted" | "approved" | "rejected";
type Filter = "submitted" | "approved" | "rejected" | "all";

interface Profile {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  religion?: string | null;
  caste?: string | null;
  mother_tongue?: string | null;
  height_cm?: number | null;
  education_level?: string | null;
  education_field?: string | null;
  college?: string | null;
  occupation?: string | null;
  employer?: string | null;
  annual_income_inr?: number | null;
  bio?: string | null;
  about_family?: string | null;
  photos?: Array<{ url?: string | null; key?: string | null; is_primary?: boolean }> | null;
  completeness_score?: number | null;
  verification_status: string;
  rejection_reason?: string | null;
  last_rejection_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  family_details?: Record<string, unknown> | null;
  partner_prefs?: Record<string, unknown> | null;
}

const errorMessage = (e: unknown): string => {
  if (e instanceof ApiError) {
    const d = e.detail;
    if (typeof d === "string") return d;
    if (d && typeof d === "object") {
      const m = (d as any).message;
      if (typeof m === "string") return m;
      if (Array.isArray((d as any).missing)) return `Missing: ${(d as any).missing.join(", ")}`;
      return JSON.stringify(d);
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Unknown error";
};

const safeString = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const fullName = (p: Profile): string => {
  const f = safeString(p.first_name).trim();
  const l = safeString(p.last_name).trim();
  return [f, l].filter(Boolean).join(" ") || "(unnamed)";
};
const initials = (n: string): string =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "?";

const age = (dob?: string | null) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
};

const formatRelative = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const heightInFtIn = (cm?: number | null) => {
  if (!cm || cm <= 0) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}ft ${inch}in`;
};

const primaryPhoto = (p: Profile) => {
  const list = Array.isArray(p.photos) ? p.photos : [];
  const pr = list.find((x) => x?.is_primary && x.url);
  return pr?.url || list.find((x) => x?.url)?.url || null;
};

export default function AdminVerificationsPage() {
  const { toast } = useToast();

  const [filter, setFilter] = useState<Filter>("submitted");
  const [items, setItems] = useState<Profile[]>([]);
  const [counts, setCounts] = useState<Record<Filter, number>>({ submitted: 0, approved: 0, rejected: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [fRes, aRes, rRes] = await Promise.all([
        adminApi.listVerifications("submitted"),
        adminApi.listVerifications("approved"),
        adminApi.listVerifications("rejected"),
      ]);
      const sub = Array.isArray((fRes.data as any)?.data) ? (fRes.data as any).data : [];
      const app = Array.isArray((aRes.data as any)?.data) ? (aRes.data as any).data : [];
      const rej = Array.isArray((rRes.data as any)?.data) ? (rRes.data as any).data : [];
      setCounts({
        submitted: sub.length,
        approved: app.length,
        rejected: rej.length,
        all: sub.length + app.length + rej.length,
      });
      const current =
        filter === "submitted" ? sub :
        filter === "approved" ? app :
        filter === "rejected" ? rej :
        [...sub, ...app, ...rej];
      setItems(current);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const qq = search.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((p) => {
      const hay = [
        fullName(p), p.city, p.occupation, p.religion, p.country, p.education_level,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [items, search]);

  useEffect(() => {
    if (!selected) return;
    const found = items.find((p) => p.user_id === selected.user_id);
    setSelected(found || null);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (p: Profile) => {
    setBusy(true);
    try {
      await adminApi.approveVerification(p.user_id);
      toast("success", `Approved ${fullName(p)}`);
      setSelected(null);
      await load();
    } catch (e) { toast("error", errorMessage(e)); }
    finally { setBusy(false); }
  };
  const reject = async (p: Profile) => {
    const reason = note.trim();
    if (!reason) { toast("warning", "Enter a rejection reason first."); return; }
    setBusy(true);
    try {
      await adminApi.rejectVerification(p.user_id, reason);
      toast("success", `Rejected ${fullName(p)}`);
      setSelected(null); setNote("");
      await load();
    } catch (e) { toast("error", errorMessage(e)); }
    finally { setBusy(false); }
  };
  const requestInfo = async (p: Profile) => {
    const n = note.trim();
    if (!n) { toast("warning", "Enter the info you need first."); return; }
    setBusy(true);
    try {
      await adminApi.requestInfo(p.user_id, n);
      toast("success", `Requested info from ${fullName(p)}`);
      setSelected(null); setNote("");
      await load();
    } catch (e) { toast("error", errorMessage(e)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!filtered.length) return;
      const idx = selected ? filtered.findIndex((p) => p.user_id === selected.user_id) : -1;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(filtered[Math.max(0, Math.min(filtered.length - 1, idx + 1))] || null);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(filtered[Math.max(0, idx - 1)] || null);
      } else if (e.key === "Escape") {
        setSelected(null);
      } else if (selected && !busy && e.key === "a") {
        e.preventDefault();
        approve(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selected, busy]);

  return (
    <PageShell
      title="Verifications"
      subtitle="Review and approve new profiles before they go live."
    >
      {/* Tabs */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.75)", padding: 3, borderRadius: 12, border: "1px solid rgba(220,30,60,0.08)", backdropFilter: "blur(6px)" }}>
          {([
            { k: "submitted", label: "Pending",  tone: "warn" },
            { k: "approved",  label: "Approved", tone: "good" },
            { k: "rejected",  label: "Rejected", tone: "bad" },
            { k: "all",       label: "All",      tone: "neutral" },
          ] as Array<{ k: Filter; label: string; tone: string }>).map(({ k, label }) => {
            const active = filter === k;
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  position: "relative", padding: "8px 16px", borderRadius: 9,
                  border: "none", background: "transparent",
                  fontSize: 12.5, fontWeight: active ? 600 : 500,
                  color: active ? "#fff" : "#666",
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  zIndex: 1,
                }}
              >
                {active && (
                  <motion.span
                    layoutId="verif-tab-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                      borderRadius: 9,
                      boxShadow: "0 4px 12px rgba(220,30,60,0.3)",
                      zIndex: -1,
                    }}
                  />
                )}
                {label}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: "2px 7px", borderRadius: 999,
                  background: active ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.08)",
                  color: active ? "#fff" : "#999",
                  minWidth: 22, textAlign: "center",
                  position: "relative", zIndex: 1,
                }}>{counts[k]}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(220,30,60,0.12)", borderRadius: 12, padding: "9px 14px", width: 320, maxWidth: "100%", backdropFilter: "blur(6px)" }}>
          <Search style={{ width: 15, height: 15, color: "#aaa" }} />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, color: "#1a0a14", background: "transparent", fontFamily: "inherit" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#aaa", display: "flex" }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        style={{
          display: "grid",
          gridTemplateColumns: selected ? "minmax(360px, 440px) 1fr" : "1fr",
          gap: 16, alignItems: "start",
        }}
        className="verif-grid"
      >
        {/* LIST */}
        <GlassCard padding={0}>
          <div data-admin-scroll style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 10 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="m4m-shimmer" style={{ height: 72, margin: "6px 10px", borderRadius: 12 }} />
                ))}
              </div>
            ) : loadError ? (
              <div style={{ padding: 20, color: "#a0153c", fontSize: 13 }}>
                <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                {loadError}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "60px 24px", textAlign: "center" }}>
                <Inbox style={{ width: 40, height: 40, color: "#e5e5e5", margin: "0 auto 12px", display: "block" }} />
                <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
                  {search ? `No matches for "${search}"` : "No profiles in this category."}
                </p>
                {filter === "submitted" && !search && (
                  <p style={{ color: "#aaa", fontSize: 12, marginTop: 8 }}>
                    New submissions appear here when users click "Submit for verification".
                  </p>
                )}
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {filtered.map((p, i) => (
                  <VerificationRow
                    key={p.user_id}
                    profile={p}
                    index={i}
                    active={selected?.user_id === p.user_id}
                    onClick={() => { setSelected(p); setNote(""); }}
                  />
                ))}
              </ul>
            )}
          </div>
        </GlassCard>

        {/* DETAIL */}
        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.user_id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="verif-detail"
            >
              <GlassCard padding={0}>
                <DetailPanel
                  profile={selected}
                  note={note}
                  setNote={setNote}
                  busy={busy}
                  onClose={() => { setSelected(null); setNote(""); }}
                  onApprove={() => approve(selected)}
                  onReject={() => reject(selected)}
                  onRequestInfo={() => requestInfo(selected)}
                  onPhotoClick={setPhotoLightbox}
                />
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Photo lightbox */}
      <AnimatePresence>
        {photoLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPhotoLightbox(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
              zIndex: 100, display: "grid", placeItems: "center", padding: 40,
              backdropFilter: "blur(8px)",
            }}
          >
            <motion.img
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              src={photoLightbox}
              alt="Profile"
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
            />
            <button
              onClick={() => setPhotoLightbox(null)}
              style={{
                position: "fixed", top: 20, right: 20,
                background: "rgba(255,255,255,0.14)", color: "#fff", border: "none",
                borderRadius: "50%", width: 42, height: 42, cursor: "pointer",
                display: "grid", placeItems: "center",
                backdropFilter: "blur(12px)",
              }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{
          position: "fixed", bottom: 16, right: 16,
          background: "rgba(26,10,20,0.85)", color: "#fff", fontSize: 11,
          padding: "8px 12px", borderRadius: 10, fontFamily: "ui-monospace, monospace",
          zIndex: 5, letterSpacing: "0.03em",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <KBD>j</KBD> <KBD>k</KBD> navigate · <KBD>a</KBD> approve · <KBD>esc</KBD> close
      </motion.div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.verif-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

function KBD({ children }: { children: React.ReactNode }) {
  return <kbd style={{
    background: "rgba(255,255,255,0.15)", padding: "1px 6px",
    borderRadius: 4, marginRight: 2, border: "1px solid rgba(255,255,255,0.08)",
  }}>{children}</kbd>;
}

function VerificationRow({ profile, active, onClick, index }: {
  profile: Profile; active: boolean; onClick: () => void; index: number;
}) {
  const name = fullName(profile);
  const photo = primaryPhoto(profile);
  const a = age(profile.date_of_birth);
  const status = profile.verification_status as Status;
  const ring = status === "approved" ? "linear-gradient(135deg, #8DB870, #5C7A52)"
    : status === "submitted" ? "linear-gradient(135deg, #E8C04B, #C89020)"
    : status === "rejected"  ? "linear-gradient(135deg, #ff7a9a, #dc1e3c)"
    : "linear-gradient(135deg, #cccccc, #999999)";

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.6, index * 0.025), duration: 0.3 }}
    >
      <button
        onClick={onClick}
        style={{
          width: "100%", textAlign: "left",
          background: active ? "rgba(220,30,60,0.06)" : "transparent",
          border: "none",
          borderLeft: active ? "3px solid #dc1e3c" : "3px solid transparent",
          borderBottom: "1px solid rgba(220,30,60,0.05)",
          padding: "14px 18px",
          cursor: "pointer",
          display: "flex", gap: 12, alignItems: "flex-start",
          transition: "background 0.12s",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,30,60,0.03)"; }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <div style={{
          width: 46, height: 46, padding: 2, borderRadius: "50%",
          background: ring, flexShrink: 0,
        }}>
          <div style={{
            width: "100%", height: "100%", borderRadius: "50%",
            background: photo ? `center / cover no-repeat url(${photo})` : "linear-gradient(135deg,#dc1e3c,#a0153c)",
            display: "grid", placeItems: "center",
            color: "#fff", fontWeight: 700, fontSize: 13,
            border: "2px solid #fff",
          }}>
            {!photo && initials(name)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a0a14", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            {a !== null && <span style={{ fontSize: 12, color: "#888" }}>· {a}</span>}
          </div>
          <div style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[profile.city, profile.religion, profile.occupation].filter(Boolean).join(" · ") || "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <StatusBadge status={status} />
            {profile.submitted_at && (
              <span style={{ fontSize: 11, color: "#aaa" }}>{formatRelative(profile.submitted_at)}</span>
            )}
            {typeof profile.completeness_score === "number" && (
              <span style={{ fontSize: 11, color: "#aaa" }}>· {profile.completeness_score}%</span>
            )}
          </div>
        </div>
        <ChevronRight style={{ width: 14, height: 14, color: active ? "#dc1e3c" : "#ccc", flexShrink: 0, marginTop: 6 }} />
      </button>
    </motion.li>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, { bg: string; fg: string; label: string }> = {
    draft:     { bg: "rgba(0,0,0,0.06)",      fg: "#666",     label: "Draft" },
    submitted: { bg: "rgba(200,144,32,0.14)", fg: "#8A5F00",  label: "Pending" },
    approved:  { bg: "rgba(92,122,82,0.14)",  fg: "#3F5937",  label: "Approved" },
    rejected:  { bg: "rgba(220,30,60,0.10)",  fg: "#a0153c",  label: "Rejected" },
  };
  const s = styles[status] || styles.draft;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "3px 8px", borderRadius: 999, background: s.bg, color: s.fg,
    }}>
      {s.label}
    </span>
  );
}

function DetailPanel({
  profile, note, setNote, busy, onClose, onApprove, onReject, onRequestInfo, onPhotoClick,
}: {
  profile: Profile;
  note: string; setNote: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void; onReject: () => void; onRequestInfo: () => void;
  onPhotoClick: (url: string) => void;
}) {
  const name = fullName(profile);
  const a = age(profile.date_of_birth);
  const photos = (Array.isArray(profile.photos) ? profile.photos : []).filter((p) => !!p?.url);
  const status = profile.verification_status as Status;
  const canAct = status !== "approved";

  return (
    <div>
      {/* Title strip */}
      <div style={{
        padding: "20px 24px",
        borderBottom: "1px solid rgba(220,30,60,0.08)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
        position: "sticky", top: 0, zIndex: 5,
        background: "rgba(255,255,255,0.72)", backdropFilter: "blur(10px)",
      }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 22, fontWeight: 600, color: "#1a0a14", margin: 0, letterSpacing: "-0.01em" }}>
            {name}{a !== null && `, ${a}`}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <StatusBadge status={status} />
            {profile.submitted_at && (
              <span style={{ fontSize: 12, color: "#888" }}>Submitted {formatRelative(profile.submitted_at)}</span>
            )}
            {typeof profile.completeness_score === "number" && (
              <span style={{ fontSize: 12, color: "#888" }}>· {profile.completeness_score}% complete</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 10,
            width: 34, height: 34, cursor: "pointer",
            display: "grid", placeItems: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
        >
          <X style={{ width: 16, height: 16, color: "#666" }} />
        </button>
      </div>

      <div data-admin-scroll style={{ padding: 24, maxHeight: "calc(100vh - 340px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {profile.rejection_reason && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: 14, background: "rgba(220,30,60,0.06)",
              borderRadius: 12, border: "1px solid rgba(220,30,60,0.12)",
              display: "flex", gap: 10, alignItems: "flex-start",
            }}
          >
            <AlertTriangle style={{ width: 17, height: 17, color: "#dc1e3c", flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13 }}>
              <strong style={{ color: "#7B2D3A" }}>
                {status === "rejected" ? "Rejection reason" : "Outstanding request"}:
              </strong>{" "}
              <span style={{ color: "#555" }}>{profile.rejection_reason}</span>
            </div>
          </motion.div>
        )}
        {profile.last_rejection_reason && profile.rejection_reason !== profile.last_rejection_reason && (
          <div style={{ padding: 12, background: "rgba(0,0,0,0.03)", borderRadius: 10, fontSize: 12, color: "#888" }}>
            <strong>Previous rejection:</strong> {profile.last_rejection_reason}
          </div>
        )}

        <Section icon={ImageIcon} title={`Photos (${photos.length})`}>
          {photos.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>No photos uploaded.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
              {photos.map((ph, i) => ph.url ? (
                <motion.button
                  key={ph.key || i}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 420, damping: 24 }}
                  onClick={() => onPhotoClick(ph.url!)}
                  style={{
                    position: "relative", borderRadius: 12, overflow: "hidden",
                    aspectRatio: "1", border: "1px solid rgba(220,30,60,0.12)",
                    cursor: "pointer", padding: 0, background: "none",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {ph.is_primary && (
                    <span style={{
                      position: "absolute", top: 8, left: 8,
                      background: "linear-gradient(135deg, #dc1e3c, #a0153c)", color: "#fff", fontSize: 9, fontWeight: 700,
                      padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.06em",
                      boxShadow: "0 3px 10px rgba(220,30,60,0.35)",
                    }}>Primary</span>
                  )}
                </motion.button>
              ) : null)}
            </div>
          )}
        </Section>

        <Section icon={User} title="Basic">
          <DataGrid>
            <Cell label="Gender">{profile.gender}</Cell>
            <Cell label="Date of birth">{profile.date_of_birth}</Cell>
            <Cell label="Age">{a}</Cell>
            <Cell label="Height">{heightInFtIn(profile.height_cm) || (profile.height_cm ? `${profile.height_cm}cm` : null)}</Cell>
            <Cell label="Religion">{profile.religion}</Cell>
            <Cell label="Caste">{profile.caste}</Cell>
            <Cell label="Mother tongue">{profile.mother_tongue}</Cell>
          </DataGrid>
        </Section>

        <Section icon={MapPin} title="Location">
          <DataGrid>
            <Cell label="City">{profile.city}</Cell>
            <Cell label="State">{profile.state}</Cell>
            <Cell label="Country">{profile.country}</Cell>
          </DataGrid>
        </Section>

        <Section icon={GraduationCap} title="Education & Career">
          <DataGrid>
            <Cell label="Education">{profile.education_level}</Cell>
            <Cell label="Field">{profile.education_field}</Cell>
            <Cell label="College">{profile.college}</Cell>
            <Cell label="Occupation">{profile.occupation}</Cell>
            <Cell label="Employer">{profile.employer}</Cell>
            <Cell label="Annual income">{profile.annual_income_inr ? `£${profile.annual_income_inr.toLocaleString()}` : null}</Cell>
          </DataGrid>
        </Section>

        {profile.bio && (
          <Section icon={MessageSquare} title="About">
            <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{profile.bio}</p>
          </Section>
        )}

        {profile.about_family && (
          <Section icon={Heart} title="Family">
            <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{profile.about_family}</p>
          </Section>
        )}

        {profile.partner_prefs && Object.keys(profile.partner_prefs).length > 0 && (
          <Section icon={Heart} title="Partner preferences">
            <KeyValueList data={profile.partner_prefs} />
          </Section>
        )}

        {profile.family_details && Object.keys(profile.family_details).length > 0 && (
          <Section icon={User} title="Family details">
            <KeyValueList data={profile.family_details} />
          </Section>
        )}
      </div>

      {canAct && (
        <div style={{
          borderTop: "1px solid rgba(220,30,60,0.08)",
          padding: 20, background: "rgba(253,251,249,0.82)",
          position: "sticky", bottom: 0,
          backdropFilter: "blur(12px)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <textarea
            rows={2}
            placeholder="Reason (required for Reject or Request Info)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              width: "100%", padding: 12, border: "1px solid rgba(220,30,60,0.15)",
              borderRadius: 10, fontSize: 13, outline: "none", background: "#fff",
              resize: "vertical", fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={onApprove} disabled={busy} variant="success" style={{ flex: 1, justifyContent: "center" }}>
              <CheckCircle2 style={{ width: 14, height: 14 }} /> Approve
            </Button>
            <Button onClick={onRequestInfo} disabled={busy} variant="warn">
              Request info
            </Button>
            <Button onClick={onReject} disabled={busy} variant="danger">
              <XCircle style={{ width: 13, height: 13 }} /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(220,30,60,0.08)", display: "grid", placeItems: "center" }}>
          <Icon style={{ width: 12, height: 12, color: "#dc1e3c" }} />
        </div>
        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function DataGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>{children}</div>;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "" || children === 0;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 13, color: empty ? "#ccc" : "#1a0a14", marginTop: 2 }}>{empty ? "—" : String(children)}</div>
    </div>
  );
}

function KeyValueList({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "" && (Array.isArray(v) ? v.length > 0 : true));
  if (entries.length === 0) return <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>—</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
      {entries.map(([k, v]) => {
        const label = k.replace(/[_-]/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
        const value = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
        return (
          <div key={k}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 13, color: "#1a0a14", overflowWrap: "anywhere", marginTop: 2 }}>{value}</div>
          </div>
        );
      })}
    </div>
  );
}
