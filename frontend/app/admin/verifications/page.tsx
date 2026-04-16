"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  CheckCircle2, XCircle, Clock, Shield, Image as ImageIcon,
  ChevronRight, Search, Heart, MessageSquare, AlertTriangle,
  User, MapPin, Briefcase, GraduationCap, Calendar, X,
  Loader2, Inbox, Eye,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "draft" | "submitted" | "approved" | "rejected";

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
  kundali_data?: Record<string, unknown> | null;
}

type Filter = "submitted" | "approved" | "rejected" | "all";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeString = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

const fullName = (p: Profile): string => {
  const f = safeString(p.first_name).trim();
  const l = safeString(p.last_name).trim();
  return [f, l].filter(Boolean).join(" ") || "(unnamed)";
};

const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "?";

const age = (dob?: string | null): number | null => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
};

const formatRelative = (iso?: string | null): string => {
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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const errorMessage = (e: unknown): string => {
  if (e instanceof ApiError) {
    const d = e.detail;
    if (typeof d === "string") return d;
    if (d && typeof d === "object") {
      const m = (d as any).message;
      if (typeof m === "string") return m;
      if (Array.isArray((d as any).missing)) {
        return `Missing: ${(d as any).missing.join(", ")}`;
      }
      return JSON.stringify(d);
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Unknown error";
};

const heightInFtIn = (cm?: number | null): string | null => {
  if (!cm || cm <= 0) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}ft ${inch}in`;
};

const primaryPhoto = (p: Profile): string | null => {
  const list = Array.isArray(p.photos) ? p.photos : [];
  const primary = list.find((x) => x?.is_primary && x.url);
  return primary?.url || list.find((x) => x?.url)?.url || null;
};

// ─── Component ────────────────────────────────────────────────────────────────

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
        api.get(`/api/v1/profile/admin/verifications?status_filter=submitted`),
        api.get(`/api/v1/profile/admin/verifications?status_filter=approved`),
        api.get(`/api/v1/profile/admin/verifications?status_filter=rejected`),
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
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const hay = [
        fullName(p),
        p.city,
        p.occupation,
        p.religion,
        p.country,
        p.education_level,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  // Keep the selected profile fresh when list reloads.
  useEffect(() => {
    if (!selected) return;
    const found = items.find((p) => p.user_id === selected.user_id);
    if (found) setSelected(found);
    else setSelected(null);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (p: Profile) => {
    setBusy(true);
    try {
      await api.post(`/api/v1/profile/admin/verifications/${p.user_id}/approve`, {});
      toast("success", `Approved ${fullName(p)}`);
      setSelected(null);
      await load();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reject = async (p: Profile) => {
    const reason = note.trim();
    if (!reason) {
      toast("warning", "Enter a rejection reason first.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/v1/profile/admin/verifications/${p.user_id}/reject`, { reason });
      toast("success", `Rejected ${fullName(p)}`);
      setSelected(null);
      setNote("");
      await load();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const requestInfo = async (p: Profile) => {
    const n = note.trim();
    if (!n) {
      toast("warning", "Enter the info you need first.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/v1/profile/admin/verifications/${p.user_id}/request-info`, { note: n });
      toast("success", `Requested info from ${fullName(p)}`);
      setSelected(null);
      setNote("");
      await load();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Keyboard navigation
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!filtered.length) return;
      const currentIdx = selected ? filtered.findIndex((p) => p.user_id === selected.user_id) : -1;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(filtered.length - 1, currentIdx + 1);
        setSelected(filtered[Math.max(0, next)] || null);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, currentIdx - 1);
        setSelected(filtered[next] || null);
      } else if (e.key === "Escape") {
        setSelected(null);
      } else if (selected && !busy) {
        if (e.key === "a") { e.preventDefault(); approve(selected); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selected, busy]);

  return (
    <div className="min-h-screen" style={{ background: "#fdfbf9" }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(220,30,60,0.08)",
        background: "rgba(253,251,249,0.92)",
        backdropFilter: "blur(12px)",
        padding: "18px 28px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 26, fontWeight: 600, color: "#1a0a14", margin: 0 }}>
              Verifications
            </h1>
            <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>
              Review and approve new profiles before they go live.
            </p>
          </div>

          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fff", border: "1px solid rgba(220,30,60,0.15)",
            borderRadius: 10, padding: "8px 12px", width: 320, maxWidth: "100%",
          }}>
            <Search style={{ width: 16, height: 16, color: "#aaa" }} />
            <input
              type="text"
              placeholder="Search name, city, occupation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#1a0a14", background: "transparent" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#aaa" }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
          {([
            { k: "submitted", label: "Pending",  icon: Clock,        color: "#C89020" },
            { k: "approved",  label: "Approved", icon: CheckCircle2, color: "#5C7A52" },
            { k: "rejected",  label: "Rejected", icon: XCircle,      color: "#dc1e3c" },
            { k: "all",       label: "All",      icon: Inbox,        color: "#666"    },
          ] as Array<{ k: Filter; label: string; icon: any; color: string }>).map(({ k, label, icon: Icon, color }) => {
            const active = filter === k;
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px",
                  border: "none",
                  borderRadius: 8,
                  background: active ? "rgba(220,30,60,0.08)" : "transparent",
                  color: active ? "#dc1e3c" : "#666",
                  fontWeight: active ? 600 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Icon style={{ width: 14, height: 14, color: active ? "#dc1e3c" : color }} />
                {label}
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 999,
                  background: active ? "#dc1e3c" : "rgba(0,0,0,0.06)",
                  color: active ? "#fff" : "#999",
                  minWidth: 20, textAlign: "center",
                }}>
                  {counts[k]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body: list + detail panel */}
      <div style={{
        display: "grid",
        gridTemplateColumns: selected ? "minmax(360px, 440px) 1fr" : "1fr",
        minHeight: "calc(100vh - 160px)",
      }}>

        {/* List */}
        <div ref={listRef} style={{
          borderRight: selected ? "1px solid rgba(220,30,60,0.08)" : "none",
          overflowY: "auto", maxHeight: "calc(100vh - 160px)",
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
              <Loader2 style={{ width: 22, height: 22, animation: "spin 1s linear infinite", margin: "0 auto 10px", display: "block" }} />
              Loading…
            </div>
          ) : loadError ? (
            <div style={{ padding: 20, margin: 20, background: "#ffe9ec", color: "#7B2D3A", borderRadius: 10, fontSize: 13 }}>
              <AlertTriangle style={{ width: 16, height: 16, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
              {loadError}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <Inbox style={{ width: 40, height: 40, color: "#ddd", margin: "0 auto 12px", display: "block" }} />
              <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
                {search ? `No matches for "${search}"` : "No profiles in this category."}
              </p>
              {filter === "submitted" && !search && (
                <p style={{ color: "#aaa", fontSize: 12, marginTop: 8 }}>
                  New submissions will appear here when users click "Submit for verification".
                </p>
              )}
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {filtered.map((p) => (
                <VerificationRow
                  key={p.user_id}
                  profile={p}
                  active={selected?.user_id === p.user_id}
                  onClick={() => { setSelected(p); setNote(""); }}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        {selected && (
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
        )}
      </div>

      {/* Photo lightbox */}
      {photoLightbox && (
        <div
          onClick={() => setPhotoLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 40,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoLightbox}
            alt="Profile"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
          />
          <button
            onClick={() => setPhotoLightbox(null)}
            style={{
              position: "fixed", top: 20, right: 20,
              background: "rgba(255,255,255,0.12)", color: "#fff", border: "none",
              borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div style={{
        position: "fixed", bottom: 16, right: 16,
        background: "rgba(26,10,20,0.88)", color: "#fff", fontSize: 11,
        padding: "8px 12px", borderRadius: 8, fontFamily: "ui-monospace, monospace",
        zIndex: 5, letterSpacing: "0.03em",
      }}>
        <kbd style={kbd}>j</kbd> <kbd style={kbd}>k</kbd> navigate · <kbd style={kbd}>a</kbd> approve · <kbd style={kbd}>esc</kbd> close
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const kbd: React.CSSProperties = {
  background: "rgba(255,255,255,0.14)", padding: "1px 5px", borderRadius: 4, marginRight: 2,
};

// ─── Row ─────────────────────────────────────────────────────────────────────

function VerificationRow({
  profile, active, onClick,
}: {
  profile: Profile;
  active: boolean;
  onClick: () => void;
}) {
  const name = fullName(profile);
  const photo = primaryPhoto(profile);
  const a = age(profile.date_of_birth);
  const status = profile.verification_status as Status;

  return (
    <li>
      <button
        onClick={onClick}
        style={{
          width: "100%",
          textAlign: "left",
          background: active ? "rgba(220,30,60,0.06)" : "transparent",
          border: "none",
          borderLeft: active ? "3px solid #dc1e3c" : "3px solid transparent",
          borderBottom: "1px solid rgba(220,30,60,0.06)",
          padding: "14px 18px",
          cursor: "pointer",
          display: "flex", gap: 12, alignItems: "flex-start",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,30,60,0.03)"; }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: photo ? `center / cover no-repeat url(${photo})` : "linear-gradient(135deg,#dc1e3c,#a0153c)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0,
        }}>
          {!photo && initials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a0a14", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </span>
            {a !== null && <span style={{ fontSize: 12, color: "#888" }}>· {a}</span>}
          </div>
          <div style={{ fontSize: 12, color: "#888", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[profile.city, profile.religion, profile.occupation].filter(Boolean).join(" · ") || "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <StatusBadge status={status} />
            {profile.submitted_at && (
              <span style={{ fontSize: 11, color: "#aaa" }}>{formatRelative(profile.submitted_at)}</span>
            )}
            {typeof profile.completeness_score === "number" && (
              <span style={{ fontSize: 11, color: "#aaa" }}>· {profile.completeness_score}% complete</span>
            )}
          </div>
        </div>
        <ChevronRight style={{ width: 14, height: 14, color: "#ccc", flexShrink: 0, marginTop: 6 }} />
      </button>
    </li>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, { bg: string; fg: string; label: string }> = {
    draft:     { bg: "rgba(0,0,0,0.06)",      fg: "#666",     label: "Draft" },
    submitted: { bg: "rgba(200,144,32,0.12)", fg: "#9A6B00",  label: "Pending" },
    approved:  { bg: "rgba(92,122,82,0.14)",  fg: "#3F5937",  label: "Approved" },
    rejected:  { bg: "rgba(220,30,60,0.10)",  fg: "#a0153c",  label: "Rejected" },
  };
  const s = styles[status] || styles.draft;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "3px 8px", borderRadius: 999,
      background: s.bg, color: s.fg,
    }}>
      {s.label}
    </span>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────────

function DetailPanel({
  profile, note, setNote, busy,
  onClose, onApprove, onReject, onRequestInfo, onPhotoClick,
}: {
  profile: Profile;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestInfo: () => void;
  onPhotoClick: (url: string) => void;
}) {
  const name = fullName(profile);
  const a = age(profile.date_of_birth);
  const photos = (Array.isArray(profile.photos) ? profile.photos : []).filter((p) => !!p?.url);
  const status = profile.verification_status as Status;
  const canAct = status !== "approved";

  return (
    <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 160px)", background: "#fff" }}>

      {/* Title strip */}
      <div style={{
        padding: "20px 28px", borderBottom: "1px solid rgba(220,30,60,0.08)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
        position: "sticky", top: 0, background: "#fff", zIndex: 5,
      }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 22, fontWeight: 600, color: "#1a0a14", margin: 0 }}>
            {name}{a !== null && `, ${a}`}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <StatusBadge status={status} />
            {profile.submitted_at && (
              <span style={{ fontSize: 12, color: "#888" }}>
                Submitted {formatRelative(profile.submitted_at)}
              </span>
            )}
            {typeof profile.completeness_score === "number" && (
              <span style={{ fontSize: 12, color: "#888" }}>
                · {profile.completeness_score}% complete
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 8,
            width: 32, height: 32, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X style={{ width: 16, height: 16, color: "#888" }} />
        </button>
      </div>

      <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Previous rejection banner */}
        {profile.rejection_reason && (
          <div style={{
            padding: 14, background: "#ffe9ec", borderRadius: 10,
            border: "1px solid rgba(220,30,60,0.15)",
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <AlertTriangle style={{ width: 18, height: 18, color: "#dc1e3c", flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13 }}>
              <strong style={{ color: "#7B2D3A" }}>
                {status === "rejected" ? "Rejection reason" : "Outstanding request"}:
              </strong>{" "}
              <span style={{ color: "#555" }}>{profile.rejection_reason}</span>
            </div>
          </div>
        )}
        {profile.last_rejection_reason && profile.rejection_reason !== profile.last_rejection_reason && (
          <div style={{
            padding: 12, background: "#f8f8f8", borderRadius: 10, fontSize: 12, color: "#888",
          }}>
            <strong>Previous rejection:</strong> {profile.last_rejection_reason}
          </div>
        )}

        {/* Photos */}
        <Section icon={ImageIcon} title={`Photos (${photos.length})`}>
          {photos.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>No photos uploaded.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
              {photos.map((ph, i) => ph.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <button
                  key={ph.key || i}
                  onClick={() => onPhotoClick(ph.url!)}
                  style={{
                    position: "relative", borderRadius: 10, overflow: "hidden",
                    aspectRatio: "1", border: "1px solid rgba(220,30,60,0.12)",
                    cursor: "pointer", padding: 0, background: "none",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {ph.is_primary && (
                    <span style={{
                      position: "absolute", top: 6, left: 6,
                      background: "#dc1e3c", color: "#fff", fontSize: 9, fontWeight: 700,
                      padding: "2px 6px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>Primary</span>
                  )}
                </button>
              ) : null)}
            </div>
          )}
        </Section>

        {/* Basic info */}
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

        {/* Location */}
        <Section icon={MapPin} title="Location">
          <DataGrid>
            <Cell label="City">{profile.city}</Cell>
            <Cell label="State">{profile.state}</Cell>
            <Cell label="Country">{profile.country}</Cell>
          </DataGrid>
        </Section>

        {/* Education & career */}
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

        {/* Bio */}
        {profile.bio && (
          <Section icon={MessageSquare} title="About">
            <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
              {profile.bio}
            </p>
          </Section>
        )}

        {/* Family */}
        {profile.about_family && (
          <Section icon={Heart} title="Family">
            <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
              {profile.about_family}
            </p>
          </Section>
        )}

        {/* Partner prefs */}
        {profile.partner_prefs && Object.keys(profile.partner_prefs).length > 0 && (
          <Section icon={Heart} title="Partner preferences">
            <KeyValueList data={profile.partner_prefs} />
          </Section>
        )}

        {/* Family details JSON */}
        {profile.family_details && Object.keys(profile.family_details).length > 0 && (
          <Section icon={User} title="Family details">
            <KeyValueList data={profile.family_details} />
          </Section>
        )}
      </div>

      {/* Action dock */}
      {canAct && (
        <div style={{
          borderTop: "1px solid rgba(220,30,60,0.08)",
          background: "#fdfbf9",
          padding: 20,
          display: "flex", flexDirection: "column", gap: 10,
          position: "sticky", bottom: 0,
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
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onApprove}
              disabled={busy}
              style={{
                flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600,
                background: "linear-gradient(135deg,#5C7A52,#8DB870)",
                color: "#fff", border: "none", borderRadius: 10, cursor: busy ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <CheckCircle2 style={{ width: 14, height: 14 }} /> Approve
            </button>
            <button
              onClick={onRequestInfo}
              disabled={busy}
              style={{
                padding: "10px 14px", fontSize: 13, fontWeight: 600,
                background: "#fff", color: "#9A6B00",
                border: "1px solid rgba(200,144,32,0.4)",
                borderRadius: 10, cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Request info
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              style={{
                padding: "10px 14px", fontSize: 13, fontWeight: 600,
                background: "#fff", color: "#dc1e3c",
                border: "1px solid rgba(220,30,60,0.4)",
                borderRadius: 10, cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail building blocks ──────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon style={{ width: 14, height: 14, color: "#dc1e3c" }} />
        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function DataGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
      {children}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  const v = children;
  if (v === null || v === undefined || v === "" || v === 0) {
    return (
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        <div style={{ fontSize: 13, color: "#ccc" }}>—</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 13, color: "#1a0a14" }}>{String(v)}</div>
    </div>
  );
}

function KeyValueList({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "" && (Array.isArray(v) ? v.length > 0 : true));
  if (entries.length === 0) return <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>—</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
      {entries.map(([k, v]) => {
        const label = k.replace(/[_-]/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
        const value = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
        return (
          <div key={k}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 13, color: "#1a0a14", overflowWrap: "anywhere" }}>{value}</div>
          </div>
        );
      })}
    </div>
  );
}
