"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, GraduationCap,
  Heart, Calendar, Shield, Flag, Loader2, AlertTriangle, ChevronUp,
  ChevronDown, UserX, UserCheck, Trash2, RotateCcw,
} from "lucide-react";
import { PageShell, Button } from "@/components/admin/PageShell";
import { adminApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";

interface UserDetail {
  id: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  deleted_at: string | null;
  trust_score: number;
  completeness_score: number;
  verification_status: string;
  subscription_tier: string;
  first_name: string;
  last_name: string;
  city: string | null;
  country: string | null;
  religion: string | null;
  occupation: string | null;
  primary_photo_url: string | null;
  created_at: string | null;
  last_active_at: string | null;
  reports_against: number;
  reports_filed: number;
  profile: any | null;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const userId = params?.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await adminApi.getUser(userId);
      setUser((res.data as any)?.data || null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userId) load(); /* eslint-disable-next-line */ }, [userId]);

  const act = async (op: string, fn: () => Promise<unknown>) => {
    if (!user) return;
    setBusy(true);
    try {
      await fn();
      toast("success", `${op} done`);
      await load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageShell title="User">
        <div style={{ padding: 60, textAlign: "center", color: "#999" }}>
          <Loader2 style={{ width: 22, height: 22, animation: "spin 1s linear infinite", margin: "0 auto 10px", display: "block" }} />
        </div>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </PageShell>
    );
  }

  if (error || !user) {
    return (
      <PageShell title="User" actions={<Link href="/admin/users" style={backLinkStyle}><ArrowLeft style={{ width: 14, height: 14 }} /> Back</Link>}>
        <div style={{ padding: 20, background: "#ffe9ec", color: "#7B2D3A", borderRadius: 10, fontSize: 13 }}>
          <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
          {error || "User not found"}
        </div>
      </PageShell>
    );
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "(unnamed)";

  return (
    <PageShell
      title={name}
      subtitle={[user.religion, user.city, user.occupation].filter(Boolean).join(" · ") || user.email || user.phone || ""}
      actions={
        <Link href="/admin/users" style={backLinkStyle}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Back to users
        </Link>
      }
    >
      {/* Top status strip */}
      <div style={{
        background: "#fff", border: "1px solid rgba(220,30,60,0.08)",
        borderRadius: 14, padding: 18, marginBottom: 16,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: user.primary_photo_url
            ? `center / cover no-repeat url(${user.primary_photo_url})`
            : "linear-gradient(135deg,#dc1e3c,#a0153c)",
          color: "#fff", fontSize: 22, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {!user.primary_photo_url && (name[0]?.toUpperCase() || "?")}
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
            <StatusChip user={user} />
            <span style={{ fontSize: 11, color: "#666", background: "rgba(0,0,0,0.05)", padding: "3px 8px", borderRadius: 999, textTransform: "capitalize" }}>
              {user.subscription_tier}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#666", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {user.email && <span><Mail style={iconStyle} />{user.email} {user.is_email_verified && "✓"}</span>}
            {user.phone && <span><Phone style={iconStyle} />{user.phone} {user.is_phone_verified && "✓"}</span>}
            {user.city && <span><MapPin style={iconStyle} />{user.city}{user.country ? `, ${user.country}` : ""}</span>}
            {user.created_at && <span><Calendar style={iconStyle} />Joined {new Date(user.created_at).toLocaleDateString()}</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <KPI label="Trust" value={user.trust_score} max={100} tone={user.trust_score >= 60 ? "good" : user.trust_score >= 40 ? "warn" : "bad"} />
          <KPI label="Complete" value={user.completeness_score} max={100} suffix="%" />
          <KPI label="Reports" value={user.reports_against} tone={user.reports_against > 0 ? "bad" : "neutral"} />
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        background: "#fff", border: "1px solid rgba(220,30,60,0.08)",
        borderRadius: 14, padding: 14, marginBottom: 16,
        display: "flex", gap: 8, flexWrap: "wrap",
      }}>
        {user.deleted_at ? (
          <Button onClick={() => act("Restored", () => adminApi.restoreUser(user.id))} disabled={busy} variant="primary">
            <RotateCcw style={{ width: 13, height: 13 }} /> Restore user
          </Button>
        ) : user.is_active ? (
          <>
            <Button onClick={() => act("Suspended", () => adminApi.suspendUser(user.id))} disabled={busy} variant="warn">
              <UserX style={{ width: 13, height: 13 }} /> Suspend
            </Button>
            <Button onClick={() => act("Deleted", () => adminApi.softDeleteUser(user.id))} disabled={busy} variant="danger">
              <Trash2 style={{ width: 13, height: 13 }} /> Soft-delete
            </Button>
          </>
        ) : (
          <Button onClick={() => act("Activated", () => adminApi.activateUser(user.id))} disabled={busy} variant="primary">
            <UserCheck style={{ width: 13, height: 13 }} /> Activate
          </Button>
        )}

        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid rgba(220,30,60,0.15)", borderRadius: 10, padding: 4 }}>
          <span style={{ fontSize: 12, color: "#666", padding: "0 8px" }}>Trust boost</span>
          <Button onClick={() => act("+10 trust", () => adminApi.trustBoost(user.id, +10))} disabled={busy} variant="ghost">
            <ChevronUp style={{ width: 14, height: 14 }} /> +10
          </Button>
          <Button onClick={() => act("-10 trust", () => adminApi.trustBoost(user.id, -10))} disabled={busy} variant="ghost">
            <ChevronDown style={{ width: 14, height: 14 }} /> -10
          </Button>
        </div>

        {user.verification_status !== "approved" && user.profile && (
          <Link href="/admin/verifications" style={{ ...backLinkStyle, textDecoration: "none" }}>
            <Shield style={{ width: 13, height: 13 }} /> Review verification
          </Link>
        )}
      </div>

      {/* Profile sections */}
      {user.profile ? <ProfileSections profile={user.profile} /> : (
        <div style={{ background: "#fff", border: "1px solid rgba(220,30,60,0.08)", borderRadius: 14, padding: 20, color: "#888" }}>
          No profile data yet.
        </div>
      )}

      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </PageShell>
  );
}

const iconStyle: React.CSSProperties = {
  width: 12, height: 12, display: "inline", verticalAlign: "text-bottom", marginRight: 4, color: "#aaa",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 12px", borderRadius: 10,
  background: "#fff", border: "1px solid rgba(220,30,60,0.15)",
  color: "#1a0a14", fontSize: 13, fontWeight: 600, textDecoration: "none",
};

function StatusChip({ user }: { user: UserDetail }) {
  let label = "Active"; let color = "#5C7A52"; let bg = "rgba(92,122,82,0.12)";
  if (user.deleted_at) { label = "Deleted"; color = "#666"; bg = "rgba(0,0,0,0.06)"; }
  else if (!user.is_active) { label = "Suspended"; color = "#a0153c"; bg = "rgba(220,30,60,0.08)"; }
  else if (user.verification_status === "approved") { label = "Verified"; color = "#1e4bc8"; bg = "rgba(30,75,200,0.06)"; }
  else if (user.verification_status === "submitted") { label = "Pending review"; color = "#9A6B00"; bg = "rgba(200,144,32,0.12)"; }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
      padding: "4px 10px", borderRadius: 999, background: bg, color,
    }}>{label}</span>
  );
}

function KPI({ label, value, max, tone = "neutral", suffix = "" }: { label: string; value: number; max?: number; tone?: "good" | "warn" | "bad" | "neutral"; suffix?: string }) {
  const color = tone === "good" ? "#3F5937" : tone === "warn" ? "#9A6B00" : tone === "bad" ? "#a0153c" : "#1a0a14";
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "var(--font-playfair, serif)" }}>
        {value}{suffix}{max ? <span style={{ fontSize: 12, color: "#aaa", fontWeight: 500 }}> / {max}</span> : null}
      </div>
    </div>
  );
}

function ProfileSections({ profile }: { profile: Record<string, any> }) {
  const photos = Array.isArray(profile.photos) ? profile.photos.filter((p: any) => p?.url) : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {photos.length > 0 && (
        <Card title={`Photos (${photos.length})`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {photos.map((ph: any, i: number) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={ph.key || i} src={ph.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: ph.is_primary ? "2px solid #dc1e3c" : "1px solid rgba(0,0,0,0.06)" }} />
            ))}
          </div>
        </Card>
      )}

      <Card title="Basic">
        <Grid>
          <Field label="Gender">{profile.gender}</Field>
          <Field label="Date of birth">{profile.date_of_birth}</Field>
          <Field label="Height">{profile.height_cm ? `${profile.height_cm} cm` : null}</Field>
          <Field label="Weight">{profile.weight_kg ? `${profile.weight_kg} kg` : null}</Field>
          <Field label="Marital status">{profile.marital_status}</Field>
          <Field label="Religion">{profile.religion}</Field>
          <Field label="Caste">{profile.caste}</Field>
          <Field label="Mother tongue">{profile.mother_tongue}</Field>
        </Grid>
      </Card>

      <Card title="Location">
        <Grid>
          <Field label="City">{profile.city}</Field>
          <Field label="State">{profile.state}</Field>
          <Field label="Country">{profile.country}</Field>
          <Field label="Pincode">{profile.pincode}</Field>
        </Grid>
      </Card>

      <Card title="Education & career">
        <Grid>
          <Field label="Education">{profile.education_level}</Field>
          <Field label="Field">{profile.education_field}</Field>
          <Field label="College">{profile.college}</Field>
          <Field label="Occupation">{profile.occupation}</Field>
          <Field label="Employer">{profile.employer}</Field>
          <Field label="Income">{profile.annual_income_inr ? `£${Number(profile.annual_income_inr).toLocaleString()}` : null}</Field>
        </Grid>
      </Card>

      {profile.bio && (
        <Card title="About">
          <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{profile.bio}</p>
        </Card>
      )}

      {profile.about_family && (
        <Card title="Family">
          <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{profile.about_family}</p>
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(220,30,60,0.08)", borderRadius: 14, padding: 18 }}>
      <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 12px" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const v = children;
  const empty = v === null || v === undefined || v === "" || v === 0;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 13, color: empty ? "#ccc" : "#1a0a14", marginTop: 2 }}>{empty ? "—" : String(v)}</div>
    </div>
  );
}
