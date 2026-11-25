"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Calendar, Shield, AlertTriangle, Send,
  UserX, UserCheck, Trash2, RotateCcw, CalendarClock, CreditCard,
} from "lucide-react";
import { PageShell, Button, GlassCard, fadeUp } from "@/components/admin/PageShell";
import { adminApi, adminCrmApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";
import ComposeDrawer, { type ComposeTarget } from "@/components/admin/crm/ComposeDrawer";
import {
  useMemberCrm, ContactCard, TagsFollowUp, NotesCard, Timeline, type MemberContact,
} from "@/components/admin/crm/MemberCrm";
import { C, CrmStyles, TagChip, Kbd, followUpState } from "@/components/admin/crm/shared";

interface UserDetail extends MemberContact {
  membership_number: string | null;
  phone: string | null;
  is_active: boolean;
  deleted_at: string | null;
  completeness_score: number;
  verification_status: string;
  subscription_tier: string;
  plan_label?: string;
  gender?: string | null;
  first_name: string;
  last_name: string;
  city: string | null;
  country: string | null;
  religion: string | null;
  occupation: string | null;
  primary_photo_url: string | null;
  reports_against: number;
  reports_filed: number;
  tags?: string[];
  follow_up_at?: string | null;
  last_contacted_at?: string | null;
  subscription?: { plan: string; plan_label: string; status: string | null; current_period_end: string | null } | null;
  profile: any | null;
}

const VERIFICATION_LABEL: Record<string, string> = {
  approved: "Approved", submitted: "Pending review", rejected: "Rejected", draft: "Not submitted",
};

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const userId = params?.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crm = useMemberCrm(userId);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [compose, setCompose] = useState<{ target: ComposeTarget; channels: Array<"email" | "in_app"> } | null>(null);
  const [logPrompt, setLogPrompt] = useState<"call" | "whatsapp" | "email" | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi.getUser(userId);
      setUser((res.data as any)?.data || null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => { if (userId) load(); }, [userId, load]);

  useEffect(() => {
    adminCrmApi.meta().then((r) => {
      const d = (r.data as any)?.data;
      if (!d) return;
      setSuggested(Array.from(new Set([...(d.suggested_tags || []), ...(d.tags || []).map((t: any) => t.tag)])));
    }).catch(() => {});
  }, []);

  const act = async (op: string, fn: () => Promise<unknown>) => {
    if (!user) return;
    setBusy(true);
    try { await fn(); toast("success", `${op}`); await load(); }
    catch (e) { toast("error", e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };

  const openCompose = useCallback((channels: Array<"email" | "in_app">) => {
    if (!user) return;
    setCompose({
      channels,
      target: {
        kind: "user",
        user: {
          id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email,
          phone_e164: user.phone_e164, membership_number: user.membership_number, plan_label: user.plan_label,
          city: user.city, country: user.country, primary_photo_url: user.primary_photo_url,
        },
      },
    });
  }, [user]);

  // Keyboard shortcuts: e = email, m = in-app message, n = note, l = log a call.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (compose || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "e" && user?.email) { e.preventDefault(); openCompose(["email"]); }
      else if (e.key === "m") { e.preventDefault(); openCompose(["in_app"]); }
      else if (e.key === "n") { e.preventDefault(); document.getElementById("crm-note-input")?.focus(); }
      else if (e.key === "l") { e.preventDefault(); setLogPrompt("call"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compose, user, openCompose]);

  const lastContacted = useMemo(
    () => crm.data?.stats?.last_contacted_at || user?.last_contacted_at || null,
    [crm.data, user],
  );

  if (loading) {
    return (
      <PageShell title="Member">
        <GlassCard padding={24}>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div className="m4m-shimmer" style={{ width: 72, height: 72, borderRadius: "50%" }} />
            <div style={{ flex: 1 }}>
              <div className="m4m-shimmer" style={{ height: 24, width: "40%", borderRadius: 6, marginBottom: 8 }} />
              <div className="m4m-shimmer" style={{ height: 14, width: "60%", borderRadius: 4 }} />
            </div>
          </div>
        </GlassCard>
        <div className="crm-detail-grid" style={{ marginTop: 14 }}>
          <div className="m4m-shimmer" style={{ height: 320, borderRadius: 16 }} />
          <div className="m4m-shimmer" style={{ height: 320, borderRadius: 16 }} />
        </div>
        <DetailGridStyles />
      </PageShell>
    );
  }

  if (error || !user) {
    return (
      <PageShell title="Member" actions={<BackLink />}>
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
  const tags = crm.data?.tags ?? user.tags ?? [];
  const followUp = followUpState(crm.data?.follow_up_at ?? user.follow_up_at);
  const sub = user.subscription;

  return (
    <PageShell
      title={name}
      subtitle={[user.membership_number, user.religion, user.city, user.occupation].filter(Boolean).join(" · ") || user.email || user.phone || ""}
      actions={
        <>
          <BackLink />
          <Button variant="primary" onClick={() => openCompose(user.email ? ["email"] : ["in_app"])} title="Message this member (E)">
            <Send style={{ width: 13, height: 13 }} /> Message
          </Button>
        </>
      }
    >
      <CrmStyles />
      <DetailGridStyles />

      {/* Hero strip */}
      <motion.div variants={fadeUp}>
        <GlassCard padding={20} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div style={{ width: 68, height: 68, padding: 3, borderRadius: "50%", background: "linear-gradient(135deg, #dc1e3c, #a0153c)", flexShrink: 0 }}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%",
                background: user.primary_photo_url ? `center / cover no-repeat url(${user.primary_photo_url})` : "linear-gradient(135deg,#dc1e3c,#a0153c)",
                color: "#fff", fontSize: 24, fontWeight: 700, display: "grid", placeItems: "center", border: "3px solid #fff",
              }}>
                {!user.primary_photo_url && (name[0]?.toUpperCase() || "?")}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <StatusChip user={user} />
                <Chip>{user.plan_label || user.subscription_tier}</Chip>
                <Chip>{VERIFICATION_LABEL[user.verification_status] || user.verification_status}</Chip>
                {user.gender && <Chip>{user.gender}</Chip>}
                {tags.map((t) => <TagChip key={t} tag={t} size="sm" />)}
                {followUp && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 650, padding: "3px 9px", borderRadius: 999,
                    color: followUp.tone === "bad" ? C.wineDeep : followUp.tone === "warn" ? C.warn : C.ink2,
                    background: followUp.tone === "bad" ? C.wineTint : followUp.tone === "warn" ? C.warnTint : "rgba(0,0,0,0.04)",
                  }}><CalendarClock style={{ width: 12, height: 12 }} /> Follow-up {followUp.label.toLowerCase()}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.muted, display: "flex", gap: 14, flexWrap: "wrap" }}>
                {(user.city || user.country) && <Meta icon={MapPin}>{[user.city, user.country].filter(Boolean).join(", ")}</Meta>}
                {user.created_at && <Meta icon={Calendar}>Joined {new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Meta>}
                {sub && (
                  <Meta icon={CreditCard}>
                    {sub.plan_label} · {sub.status}{sub.current_period_end ? ` · renews ${new Date(sub.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </Meta>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 22 }}>
              <KPI label="Complete" value={`${user.completeness_score}%`} />
              <KPI label="Reports" value={String(user.reports_against)} tone={user.reports_against > 0 ? "bad" : "neutral"} />
              <KPI label="Contacts" value={String(crm.data?.stats?.total ?? 0)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
            {user.deleted_at ? (
              <Button onClick={() => act("Member restored", () => adminApi.restoreUser(user.id))} disabled={busy} variant="primary">
                <RotateCcw style={{ width: 13, height: 13 }} /> Restore member
              </Button>
            ) : user.is_active ? (
              <>
                <Button onClick={() => act("Member suspended", () => adminApi.suspendUser(user.id))} disabled={busy} variant="warn">
                  <UserX style={{ width: 13, height: 13 }} /> Suspend
                </Button>
                <Button onClick={() => act("Member deleted", () => adminApi.softDeleteUser(user.id))} disabled={busy} variant="danger">
                  <Trash2 style={{ width: 13, height: 13 }} /> Soft-delete
                </Button>
              </>
            ) : (
              <Button onClick={() => act("Member activated", () => adminApi.activateUser(user.id))} disabled={busy} variant="primary">
                <UserCheck style={{ width: 13, height: 13 }} /> Activate
              </Button>
            )}
            {user.verification_status !== "approved" && user.profile && (
              <Link href="/admin/verifications" style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.8)", border: "1px solid rgba(220,30,60,0.12)",
                color: "#1a0a14", fontSize: 13, fontWeight: 600, textDecoration: "none",
              }}>
                <Shield style={{ width: 13, height: 13 }} /> Review verification
              </Link>
            )}
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.muted, display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span><Kbd>E</Kbd> email</span><span><Kbd>M</Kbd> in-app</span><span><Kbd>L</Kbd> log call</span><span><Kbd>N</Kbd> note</span>
            </span>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={fadeUp} className="crm-detail-grid">
        {/* Main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <Timeline
            userId={user.id}
            items={crm.data?.communications || []}
            loading={crm.loading}
            onLogged={() => crm.reload()}
            logPrompt={logPrompt}
            onDismissPrompt={() => setLogPrompt(null)}
            onCompose={() => openCompose(user.email ? ["email"] : ["in_app"])}
          />
          {crm.error && (
            <div role="alert" style={{ fontSize: 12.5, color: C.wineDeep, background: C.wineTint, padding: "8px 12px", borderRadius: 10 }}>
              {crm.error}
            </div>
          )}
          {user.profile ? <ProfileSections profile={user.profile} /> : (
            <GlassCard><p style={{ margin: 0, color: C.muted, fontSize: 13 }}>This member hasn’t started their profile yet.</p></GlassCard>
          )}
        </div>

        {/* CRM rail */}
        <aside className="crm-rail" style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <ContactCard
            user={user}
            lastContactedAt={lastContacted}
            onEmail={() => openCompose(["email"])}
            onInApp={() => openCompose(["in_app"])}
            onExternal={(ch) => setLogPrompt(ch)}
          />
          {crm.data ? (
            <>
              <TagsFollowUp
                userId={user.id}
                data={crm.data}
                suggestions={suggested}
                onChange={(next) => crm.setData((d) => (d ? { ...d, ...next } : d))}
              />
              <NotesCard
                userId={user.id}
                notes={crm.data.notes}
                onNotes={(notes) => crm.setData((d) => (d ? { ...d, notes } : d))}
              />
            </>
          ) : crm.loading ? (
            <>
              <div className="m4m-shimmer" style={{ height: 180, borderRadius: 16 }} />
              <div className="m4m-shimmer" style={{ height: 160, borderRadius: 16 }} />
            </>
          ) : null}
        </aside>
      </motion.div>

      <ComposeDrawer
        open={!!compose}
        target={compose?.target || null}
        initialChannels={compose?.channels}
        onClose={() => setCompose(null)}
        onSent={() => { crm.reload(); }}
      />
    </PageShell>
  );
}

function DetailGridStyles() {
  return (
    <style>{`
      .crm-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; align-items: start; }
      @media (min-width: 1100px) {
        .crm-detail-grid { grid-template-columns: minmax(0, 1fr) 380px; }
        .crm-rail { position: sticky; top: 96px; max-height: calc(100vh - 110px); overflow-y: auto; padding-bottom: 8px; }
      }
      @media (max-width: 1099px) { .crm-rail { order: -1; } }
    `}</style>
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
        textDecoration: "none",
      }}
    >
      <ArrowLeft style={{ width: 14, height: 14 }} /> Users
    </Link>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, color: C.ink2, background: "rgba(0,0,0,0.045)", padding: "3px 9px", borderRadius: 999, textTransform: "capitalize", fontWeight: 600 }}>
      {children}
    </span>
  );
}

function Meta({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.ink2 }}>
      <Icon style={{ width: 12, height: 12, color: C.muted }} />
      {children}
    </span>
  );
}

function StatusChip({ user }: { user: UserDetail }) {
  let label = "Active", color = "#3F5937", bg = "rgba(92,122,82,0.14)";
  if (user.deleted_at) { label = "Deleted"; color = "#555"; bg = "rgba(0,0,0,0.06)"; }
  else if (!user.is_active) { label = "Suspended"; color = "#a0153c"; bg = "rgba(220,30,60,0.08)"; }
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "3px 10px", borderRadius: 999, background: bg, color,
    }}>{label}</span>
  );
}

function KPI({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "bad" | "neutral" }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone === "bad" ? "#a0153c" : C.ink, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function ProfileSections({ profile }: { profile: Record<string, any> }) {
  const photos = Array.isArray(profile.photos) ? profile.photos.filter((p: any) => p?.url) : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {photos.length > 0 && (
        <GlassCard>
          <SectionTitle>Photos · {photos.length}</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {photos.map((ph: any, i: number) => (
              <div
                key={ph.key || i}
                style={{
                  position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden",
                  border: ph.is_primary ? "2px solid #dc1e3c" : "1px solid rgba(0,0,0,0.06)",
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
              </div>
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
          <Field label="Postcode">{profile.pincode}</Field>
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
          <p style={{ fontSize: 13.5, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, maxWidth: "72ch" }}>{profile.bio}</p>
        </GlassCard>
      )}

      {profile.about_family && (
        <GlassCard>
          <SectionTitle>Family</SectionTitle>
          <p style={{ fontSize: 13.5, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, maxWidth: "72ch" }}>{profile.about_family}</p>
        </GlassCard>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 13.5, fontWeight: 650, color: C.ink, margin: "0 0 14px" }}>{children}</h3>;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "" || children === 0;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 13, color: empty ? C.faint : C.ink, marginTop: 3, textTransform: typeof children === "string" && /^[a-z_]+$/.test(children) ? "capitalize" : undefined }}>
        {empty ? "—" : String(children).replace(/_/g, " ")}
      </div>
    </div>
  );
}
