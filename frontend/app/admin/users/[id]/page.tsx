"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Shield,
  AlertTriangle, ChevronUp, ChevronDown,
  UserX, UserCheck, Trash2, RotateCcw,
} from "lucide-react";
import { PageShell, Button, GlassCard, fadeUp } from "@/components/admin/PageShell";
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
    try { await fn(); toast("success", `${op} done`); await load(); }
    catch (e) { toast("error", e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };

  if (loading) {
    return (
      <PageShell title="User">
        <GlassCard padding={24}>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div className="m4m-shimmer" style={{ width: 72, height: 72, borderRadius: "50%" }} />
            <div style={{ flex: 1 }}>
              <div className="m4m-shimmer" style={{ height: 24, width: "40%", borderRadius: 6, marginBottom: 8 }} />
              <div className="m4m-shimmer" style={{ height: 14, width: "60%", borderRadius: 4 }} />
            </div>
          </div>
        </GlassCard>
      </PageShell>
    );
  }

  if (error || !user) {
    return (
      <PageShell
        title="User"
        actions={<BackLink />}
      >
        <GlassCard>
          <div style={{ display: "flex", gap: 10, color: "#a0153c" }}>
            <AlertTriangle style={{ width: 16, height: 16, marginTop: 2 }} />
            <span style={{ fontSize: 13 }}>{error || "User not found"}</span>
          </div>
        </GlassCard>
      </PageShell>
    );
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "(unnamed)";

  return (
    <PageShell
      title={name}
      subtitle={[user.religion, user.city, user.occupation].filter(Boolean).join(" · ") || user.email || user.phone || ""}
      actions={<BackLink />}
    >
      {/* Hero strip */}
      <motion.div variants={fadeUp}>
        <GlassCard padding={22} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{
              width: 72, height: 72, padding: 3, borderRadius: "50%",
              background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
              flexShrink: 0,
            }}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%",
                background: user.primary_photo_url
                  ? `center / cover no-repeat url(${user.primary_photo_url})`
                  : "linear-gradient(135deg,#dc1e3c,#a0153c)",
                color: "#fff", fontSize: 24, fontWeight: 700,
                display: "grid", placeItems: "center",
                border: "3px solid #fff",
              }}>
                {!user.primary_photo_url && (name[0]?.toUpperCase() || "?")}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <StatusChip user={user} />
                <span style={{ fontSize: 11, color: "#666", background: "rgba(0,0,0,0.04)", padding: "4px 10px", borderRadius: 999, textTransform: "capitalize", fontWeight: 500 }}>
                  {user.subscription_tier}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#666", display: "flex", gap: 14, flexWrap: "wrap" }}>
                {user.email && <MetaPill icon={Mail}>{user.email} {user.is_email_verified && <span style={{ color: "#5C7A52" }}>✓</span>}</MetaPill>}
                {user.phone && <MetaPill icon={Phone}>{user.phone} {user.is_phone_verified && <span style={{ color: "#5C7A52" }}>✓</span>}</MetaPill>}
                {user.city && <MetaPill icon={MapPin}>{user.city}{user.country ? `, ${user.country}` : ""}</MetaPill>}
                {user.created_at && <MetaPill icon={Calendar}>Joined {new Date(user.created_at).toLocaleDateString()}</MetaPill>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 20 }}>
              <KPI label="Trust" value={user.trust_score} max={100} tone={user.trust_score >= 60 ? "good" : user.trust_score >= 40 ? "warn" : "bad"} />
              <KPI label="Complete" value={user.completeness_score} suffix="%" />
              <KPI label="Reports" value={user.reports_against} tone={user.reports_against > 0 ? "bad" : "neutral"} />
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Actions */}
      <motion.div variants={fadeUp}>
        <GlassCard padding={14} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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

            <div style={{
              display: "inline-flex", alignItems: "center", gap: 2,
              background: "rgba(255,255,255,0.8)", border: "1px solid rgba(220,30,60,0.12)",
              borderRadius: 10, padding: 3,
              backdropFilter: "blur(6px)",
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#888", padding: "0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Trust</span>
              <TrustBtn onClick={() => act("+10 trust", () => adminApi.trustBoost(user.id, +10))} disabled={busy} up />
              <TrustBtn onClick={() => act("-10 trust", () => adminApi.trustBoost(user.id, -10))} disabled={busy} />
            </div>

            {user.verification_status !== "approved" && user.profile && (
              <Link href="/admin/verifications" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.8)",
                border: "1px solid rgba(220,30,60,0.12)",
                color: "#1a0a14", fontSize: 13, fontWeight: 600,
                textDecoration: "none", backdropFilter: "blur(6px)",
              }}>
                <Shield style={{ width: 13, height: 13 }} /> Review verification
              </Link>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {user.profile ? <ProfileSections profile={user.profile} /> : (
        <motion.div variants={fadeUp}>
          <GlassCard>
            <p style={{ margin: 0, color: "#888", fontSize: 13 }}>No profile data yet.</p>
          </GlassCard>
        </motion.div>
      )}
    </PageShell>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/users"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 14px", borderRadius: 10,
        background: "rgba(255,255,255,0.85)",
        border: "1px solid rgba(220,30,60,0.15)",
        color: "#1a0a14", fontSize: 13, fontWeight: 600,
        textDecoration: "none", backdropFilter: "blur(6px)",
      }}
    >
      <ArrowLeft style={{ width: 14, height: 14 }} /> Back to users
    </Link>
  );
}

function TrustBtn({ onClick, disabled, up = false }: { onClick: () => void; disabled: boolean; up?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      style={{
        background: "transparent", border: "none", cursor: disabled ? "not-allowed" : "pointer",
        padding: "6px 10px", borderRadius: 6,
        color: up ? "#5C7A52" : "#dc1e3c",
        fontSize: 12, fontWeight: 700,
        display: "inline-flex", alignItems: "center", gap: 3,
        fontFamily: "inherit", opacity: disabled ? 0.5 : 1,
      }}
    >
      {up ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
      {up ? "+10" : "-10"}
    </motion.button>
  );
}

function MetaPill({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 12, color: "#555",
    }}>
      <Icon style={{ width: 12, height: 12, color: "#aaa" }} />
      {children}
    </span>
  );
}

function StatusChip({ user }: { user: UserDetail }) {
  let label = "Active", color = "#3F5937", bg = "rgba(92,122,82,0.14)";
  if (user.deleted_at) { label = "Deleted"; color = "#666"; bg = "rgba(0,0,0,0.06)"; }
  else if (!user.is_active) { label = "Suspended"; color = "#a0153c"; bg = "rgba(220,30,60,0.08)"; }
  else if (user.verification_status === "approved") { label = "Verified"; color = "#2544a8"; bg = "rgba(90,120,230,0.08)"; }
  else if (user.verification_status === "submitted") { label = "Pending review"; color = "#8A5F00"; bg = "rgba(200,144,32,0.14)"; }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "4px 11px", borderRadius: 999, background: bg, color,
    }}>{label}</span>
  );
}

function KPI({ label, value, max, tone = "neutral", suffix = "" }: { label: string; value: number; max?: number; tone?: "good" | "warn" | "bad" | "neutral"; suffix?: string }) {
  const color = tone === "good" ? "#3F5937" : tone === "warn" ? "#8A5F00" : tone === "bad" ? "#a0153c" : "#1a0a14";
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "var(--font-playfair, serif)", letterSpacing: "-0.01em", marginTop: 2 }}>
        {value}{suffix}
        {max ? <span style={{ fontSize: 12, color: "#aaa", fontWeight: 500 }}> / {max}</span> : null}
      </div>
    </div>
  );
}

function ProfileSections({ profile }: { profile: Record<string, any> }) {
  const photos = Array.isArray(profile.photos) ? profile.photos.filter((p: any) => p?.url) : [];
  return (
    <motion.div variants={fadeUp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {photos.length > 0 && (
        <GlassCard>
          <SectionTitle>Photos · {photos.length}</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {photos.map((ph: any, i: number) => (
              <motion.div
                key={ph.key || i}
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                style={{
                  position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden",
                  border: ph.is_primary ? "2px solid #dc1e3c" : "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {ph.is_primary && (
                  <span style={{
                    position: "absolute", top: 6, left: 6,
                    background: "#dc1e3c", color: "#fff", fontSize: 9, fontWeight: 700,
                    padding: "3px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>Primary</span>
                )}
              </motion.div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <SectionTitle>Basic</SectionTitle>
        <Grid>
          <Field label="Gender">{profile.gender}</Field>
          <Field label="Date of birth">{profile.date_of_birth}</Field>
          <Field label="Height">{profile.height_cm ? `${profile.height_cm} cm` : null}</Field>
          <Field label="Weight">{profile.weight_kg ? `${profile.weight_kg} kg` : null}</Field>
          <Field label="Marital">{profile.marital_status}</Field>
          <Field label="Religion">{profile.religion}</Field>
          <Field label="Caste">{profile.caste}</Field>
          <Field label="Mother tongue">{profile.mother_tongue}</Field>
        </Grid>
      </GlassCard>

      <GlassCard>
        <SectionTitle>Location</SectionTitle>
        <Grid>
          <Field label="City">{profile.city}</Field>
          <Field label="State">{profile.state}</Field>
          <Field label="Country">{profile.country}</Field>
          <Field label="Pincode">{profile.pincode}</Field>
        </Grid>
      </GlassCard>

      <GlassCard>
        <SectionTitle>Education & career</SectionTitle>
        <Grid>
          <Field label="Education">{profile.education_level}</Field>
          <Field label="Field">{profile.education_field}</Field>
          <Field label="College">{profile.college}</Field>
          <Field label="Occupation">{profile.occupation}</Field>
          <Field label="Employer">{profile.employer}</Field>
          <Field label="Income">{profile.annual_income_inr ? `£${Number(profile.annual_income_inr).toLocaleString()}` : null}</Field>
        </Grid>
      </GlassCard>

      {profile.bio && (
        <GlassCard>
          <SectionTitle>About</SectionTitle>
          <p style={{ fontSize: 13.5, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{profile.bio}</p>
        </GlassCard>
      )}

      {profile.about_family && (
        <GlassCard>
          <SectionTitle>Family</SectionTitle>
          <p style={{ fontSize: 13.5, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{profile.about_family}</p>
        </GlassCard>
      )}
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
      color: "#666", margin: "0 0 14px",
    }}>{children}</h3>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "" || children === 0;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 13, color: empty ? "#ccc" : "#1a0a14", marginTop: 3 }}>{empty ? "—" : String(children)}</div>
    </div>
  );
}
