"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ShieldCheck, Plus, Trash2, Lock } from "lucide-react";
import { PageShell, Button, GlassCard, fadeUp } from "@/components/admin/PageShell";
import { adminApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";

interface Me {
  user_id: string | null;
  email: string | null;
  roles: string[];
  is_admin: boolean;
  is_super_admin: boolean;
}

interface AdminUser {
  uid: string;
  email: string | null;
  display_name: string | null;
  disabled: boolean;
  email_verified: boolean;
  last_sign_in: number | null;
  created: number | null;
  roles: string[];
}

export default function AdminSettingsPage() {
  const { toast } = useToast();

  const [me, setMe] = useState<Me | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New admin form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [meRes, adminsRes] = await Promise.all([
        adminApi.me(),
        adminApi.listAdmins(),
      ]);
      setMe((meRes.data as any)?.data);
      setAdmins(((adminsRes.data as any)?.data || []) as AdminUser[]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    if (create && newPassword.length < 8) {
      toast("warning", "Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.grantAdmin(newEmail.trim().toLowerCase(), create ? { create: true, password: newPassword } : {});
      toast("success", `Admin granted to ${newEmail}`);
      setNewEmail("");
      setNewPassword("");
      setCreate(false);
      await load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to grant admin");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (uid: string, email: string | null) => {
    if (!confirm(`Revoke admin from ${email || uid}? Active sessions will be terminated.`)) return;
    setBusy(true);
    try {
      await adminApi.revokeAdmin(uid);
      toast("success", `Revoked admin from ${email || uid}`);
      await load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to revoke admin");
    } finally {
      setBusy(false);
    }
  };

  const canManage = !!me?.is_super_admin;

  if (loading) {
    return (
      <PageShell title="Settings">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="m4m-shimmer" style={{ height: 80, borderRadius: 16 }} />
          <div className="m4m-shimmer" style={{ height: 220, borderRadius: 16 }} />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Settings" subtitle="Admin identities and platform configuration.">
      {error && (
        <motion.div
          variants={fadeUp}
          style={{ padding: 14, background: "rgba(220,30,60,0.06)", color: "#a0153c", borderRadius: 12, fontSize: 13, marginBottom: 16, border: "1px solid rgba(220,30,60,0.12)" }}
        >
          <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} /> {error}
        </motion.div>
      )}

      {/* Current user */}
      <motion.div variants={fadeUp} style={{ marginBottom: 14 }}>
      <Card title="Signed in as" icon={ShieldCheck}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, color: "#1a0a14", fontWeight: 500 }}>{me?.email || "—"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(me?.roles || []).map((r) => (
              <span key={r} style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                padding: "3px 8px", borderRadius: 999,
                background: r === "super_admin" ? "rgba(220,30,60,0.10)" : "rgba(30,75,200,0.06)",
                color: r === "super_admin" ? "#a0153c" : "#1e4bc8",
              }}>
                {r.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      </Card>
      </motion.div>

      {/* Admin users */}
      <motion.div variants={fadeUp}>
        <Card
          title="Admin accounts"
          icon={ShieldCheck}
          action={!canManage ? (
            <span style={{ fontSize: 11, color: "#888", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Lock style={{ width: 11, height: 11 }} /> super-admin only
            </span>
          ) : undefined}
        >
          {admins.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa" }}>No admins found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {admins.map((a) => (
                <div key={a.uid} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1a0a14" }}>
                      {a.email || a.uid}
                      {a.roles.includes("super_admin") && (
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#a0153c", background: "rgba(220,30,60,0.08)", padding: "2px 7px", borderRadius: 999 }}>
                          Super
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {a.last_sign_in ? `Last sign-in ${new Date(a.last_sign_in).toLocaleString()}` : "Never signed in"}
                    </div>
                  </div>
                  {canManage && !a.roles.includes("super_admin") && (
                    <Button onClick={() => handleRevoke(a.uid, a.email)} disabled={busy} variant="danger">
                      <Trash2 style={{ width: 12, height: 12 }} /> Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManage && (
            <form onSubmit={handleGrant} style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", marginBottom: 10 }}>
                Grant admin
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                <input
                  type="email"
                  required
                  placeholder="new-admin@match4marriage.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={inputStyle}
                />
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}>
                  <input type="checkbox" checked={create} onChange={(e) => setCreate(e.target.checked)} />
                  Create if missing
                </label>
                {create && (
                  <input
                    type="password"
                    required
                    placeholder="Initial password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={inputStyle}
                  />
                )}
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1,
                    background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff",
                    border: "1px solid transparent", display: "inline-flex", alignItems: "center", gap: 6,
                    boxShadow: "0 2px 10px rgba(220,30,60,0.2)",
                  }}
                >
                  <Plus style={{ width: 13, height: 13 }} /> Grant
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#888", marginTop: 8, marginBottom: 0 }}>
                The user will be able to sign in at /admin/login. Revoking terminates their active sessions immediately.
              </p>
            </form>
          )}
        </Card>
      </motion.div>
    </PageShell>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid rgba(220,30,60,0.15)", borderRadius: 8,
  fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff",
  minWidth: 220,
};

function Card({ icon: Icon, title, action, children }: { icon: any; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, background: "rgba(220,30,60,0.08)", display: "grid", placeItems: "center" }}>
            <Icon style={{ width: 14, height: 14, color: "#dc1e3c" }} />
          </div>
          <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555", margin: 0 }}>
            {title}
          </h3>
        </div>
        {action}
      </div>
      {children}
    </GlassCard>
  );
}
