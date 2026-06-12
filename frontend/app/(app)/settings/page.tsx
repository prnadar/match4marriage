"use client";

import { useState, useEffect } from "react";
import { Bell, Shield, Eye, Globe, Smartphone, CreditCard, LogOut, ChevronRight, Trash2, Download, Lock, CheckCircle, Mail, AlertCircle, Loader2 } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase";
import { api } from "@/lib/api";

type Section = "notifications" | "privacy" | "account" | "preferences" | "data";

const NAV: { key: Section; icon: React.ReactNode; label: string }[] = [
  { key: "notifications", icon: <Bell className="w-4 h-4" />,      label: "Notifications"      },
  { key: "privacy",       icon: <Eye className="w-4 h-4" />,        label: "Privacy & Safety"   },
  { key: "preferences",   icon: <Globe className="w-4 h-4" />,      label: "Preferences"        },
  { key: "account",       icon: <Shield className="w-4 h-4" />,     label: "Account & Security" },
  { key: "data",          icon: <Download className="w-4 h-4" />,   label: "Data & Privacy"     },
];

function Toggle2({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        position: "relative",
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: on ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "rgba(255,255,255,0.12)",
        flexShrink: 0,
        transition: "background 0.2s",
        padding: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "14px 0",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div>
        <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.8)", margin: 0 }}>{label}</p>
        {desc && <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2, margin: 0 }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 16,
        padding: "4px 20px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-poppins, sans-serif)",
        fontSize: 11,
        fontWeight: 600,
        color: "rgba(255,255,255,0.35)",
        letterSpacing: "0.08em",
        padding: "14px 0 0",
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("notifications");

  const [notifs, setNotifs] = useState({
    newInterest: true,
    messages: true,
    newMatches: true,
    profileViews: false,
    promotions: false,
    emailDigest: true,
    smsAlerts: false,
    pushNotifications: true,
  });

  const [privacy, setPrivacy] = useState({
    showOnline: true,
    showLastSeen: true,
    profileBlur: false,
    hideFromExes: false,
    aadhaarVisible: false,
    phoneVisible: false,
  });

  const [prefs, setPrefs] = useState({
    darkMode: false,
    language: "English",
    ageFrom: "24",
    ageTo: "32",
    religionFilter: "Hindu",
  });

  // Pull live account identity from Firebase so the Account section shows the
  // signed-in user instead of a placeholder. Falls back to "—" while we wait.
  const [account, setAccount] = useState<{ email: string; phone: string; google: string | null }>({
    email: "—",
    phone: "—",
    google: null,
  });
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged((u) => {
      if (!u) {
        setAccount({ email: "—", phone: "—", google: null });
        return;
      }
      const googleProvider = u.providerData.find((p) => p?.providerId === "google.com");
      setAccount({
        email: u.email || "—",
        phone: u.phoneNumber || "—",
        google: googleProvider?.email || null,
      });
    });
    return () => unsub();
  }, []);

  // ── Email verification status ────────────────────────────────────────────
  //
  // Pulled from /auth/me (server-side truth). If is_email_verified is false
  // we show a "Verify now" card that POSTs /auth/send-verification-email,
  // then takes the 6-digit code via /auth/verify-email?token=... which on
  // success sets is_email_verified=true.
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [emailVerifyStage, setEmailVerifyStage] = useState<"idle" | "sending" | "code" | "verifying">("idle");
  const [emailVerifyMsg, setEmailVerifyMsg] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);
  const [emailCode, setEmailCode] = useState("");

  const refreshAuthStatus = async () => {
    try {
      const res = await api.get<any>("/api/v1/auth/me");
      const d = (res.data as any)?.data;
      if (typeof d?.is_email_verified === "boolean") setEmailVerified(d.is_email_verified);
    } catch { /* leave as null */ }
  };
  useEffect(() => { refreshAuthStatus(); }, []);

  const handleSendVerificationEmail = async () => {
    setEmailVerifyMsg(null);
    setEmailVerifyStage("sending");
    try {
      const res = await api.post<any>("/api/v1/auth/send-verification-email");
      const d = (res.data as any)?.data;
      if (d?.email_verified) {
        setEmailVerified(true);
        setEmailVerifyStage("idle");
        setEmailVerifyMsg({ tone: "success", text: "Your email is already verified." });
        return;
      }
      setEmailVerifyStage("code");
      setEmailVerifyMsg({
        tone: "info",
        text: `Verification code sent to ${d?.email ?? "your inbox"}. It expires in 10 minutes.`,
      });
    } catch (e: any) {
      setEmailVerifyStage("idle");
      setEmailVerifyMsg({ tone: "error", text: e?.message || "Could not send the email. Try again." });
    }
  };

  const handleVerifyEmailCode = async () => {
    const code = emailCode.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      setEmailVerifyMsg({ tone: "error", text: "Please enter the 6-digit code we emailed." });
      return;
    }
    setEmailVerifyStage("verifying");
    try {
      await api.get(`/api/v1/auth/verify-email?token=${code}`);
      // Refresh the Firebase ID token so any backend claim caches pick up
      // the updated verification state.
      try { await firebaseAuth.currentUser?.getIdToken(true); } catch {}
      setEmailVerified(true);
      setEmailVerifyStage("idle");
      setEmailVerifyMsg({
        tone: "success",
        text: "Email verified. Thank you for confirming your address.",
      });
      setEmailCode("");
    } catch (e: any) {
      setEmailVerifyStage("code");
      const detail = (e?.detail as any)?.detail || e?.message || "Could not verify the code.";
      setEmailVerifyMsg({
        tone: "error",
        text: /expired|invalid/i.test(detail) ? "That code is invalid or expired. Send a new one." : detail,
      });
    }
  };

  const toggleNotif   = (key: keyof typeof notifs)  => setNotifs((p)  => ({ ...p, [key]: !p[key] }));
  const togglePrivacy = (key: keyof typeof privacy)  => setPrivacy((p) => ({ ...p, [key]: !p[key] }));
  const togglePrefs   = (key: keyof typeof prefs)    => setPrefs((p)   => ({ ...p, [key]: !p[key] }));

  // 16px font keeps iOS Safari from auto-zooming the viewport when these
  // controls are focused; visually near-identical to the prior 14px.
  const selectStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "6px 12px",
    fontFamily: "var(--font-poppins, sans-serif)",
    fontSize: 16,
    color: "#f4eef0",
    outline: "none",
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "6px 8px",
    fontFamily: "var(--font-poppins, sans-serif)",
    fontSize: 16,
    color: "#f4eef0",
    outline: "none",
    width: 64,
    textAlign: "center" as const,
  };

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8" style={{ background: "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -130, right: -90, width: 440, height: 440, borderRadius: "50%", background: "radial-gradient(circle, rgba(220,30,60,0.20), transparent 70%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: -150, left: -110, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,149,74,0.12), transparent 70%)", filter: "blur(60px)" }} />
      </div>
      <div style={{ maxWidth: 896, position: "relative" }}>
        <h1
          style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: 30,
            fontWeight: 300,
            color: "#f4eef0",
            marginBottom: 24,
            margin: "0 0 24px",
          }}
        >
          Settings
        </h1>

        {/* Stacks to a single column on phones; 200px rail + content from md+. */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]">
          {/* Nav — horizontal scroll on mobile, vertical rail on md+ */}
          <div className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-1 md:overflow-visible">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setSection(n.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-poppins, sans-serif)",
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  background: section === n.key ? "rgba(220,30,60,0.18)" : "transparent",
                  color: section === n.key ? "#ff8aa3" : "rgba(255,255,255,0.6)",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <span style={{ color: section === n.key ? "#ff8aa3" : "rgba(255,255,255,0.4)" }}>
                  {n.icon}
                </span>
                {n.label}
              </button>
            ))}

            {/* Divider only makes sense in the vertical (md+) rail. On the
                mobile horizontal strip it's just another scrollable item. */}
            <div className="flex-shrink-0 md:mt-4 md:pt-4 md:border-t md:border-[rgba(255,255,255,0.1)]">
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-poppins, sans-serif)",
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  background: "transparent",
                  color: "#f87171",
                  width: "100%",
                }}
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── Notifications ── */}
            {section === "notifications" && (
              <>
                <Card>
                  <Row label="New Interests" desc="When someone sends you an interest">
                    <Toggle2 on={notifs.newInterest} onToggle={() => toggleNotif("newInterest")} />
                  </Row>
                  <Row label="Messages" desc="New chat messages">
                    <Toggle2 on={notifs.messages} onToggle={() => toggleNotif("messages")} />
                  </Row>
                  <Row label="New Matches" desc="Daily match recommendations">
                    <Toggle2 on={notifs.newMatches} onToggle={() => toggleNotif("newMatches")} />
                  </Row>
                  <Row label="Profile Views" desc="When someone views your profile">
                    <Toggle2 on={notifs.profileViews} onToggle={() => toggleNotif("profileViews")} />
                  </Row>
                  <Row label="Promotions" desc="Offers, discounts, and upgrades">
                    <Toggle2 on={notifs.promotions} onToggle={() => toggleNotif("promotions")} />
                  </Row>
                </Card>

                <Card>
                  <Row label="Email Digest" desc="Weekly summary of your activity">
                    <Toggle2 on={notifs.emailDigest} onToggle={() => toggleNotif("emailDigest")} />
                  </Row>
                  <Row label="SMS Alerts" desc="Critical alerts via SMS">
                    <Toggle2 on={notifs.smsAlerts} onToggle={() => toggleNotif("smsAlerts")} />
                  </Row>
                  <Row label="Push Notifications" desc="Browser and app notifications">
                    <Toggle2 on={notifs.pushNotifications} onToggle={() => toggleNotif("pushNotifications")} />
                  </Row>
                </Card>
              </>
            )}

            {/* ── Privacy ── */}
            {section === "privacy" && (
              <>
                <Card>
                  <Row label="Show Online Status" desc="Let matches see when you're active">
                    <Toggle2 on={privacy.showOnline} onToggle={() => togglePrivacy("showOnline")} />
                  </Row>
                  <Row label="Show Last Seen" desc="Display last active time">
                    <Toggle2 on={privacy.showLastSeen} onToggle={() => togglePrivacy("showLastSeen")} />
                  </Row>
                  <Row label="Profile Blur" desc="Blur photos until interest is accepted (Platinum)">
                    <Toggle2 on={privacy.profileBlur} onToggle={() => togglePrivacy("profileBlur")} />
                  </Row>
                </Card>

                <Card>
                  <Row label="Aadhaar Number Visible" desc="Show masked Aadhaar to verified matches">
                    <Toggle2 on={privacy.aadhaarVisible} onToggle={() => togglePrivacy("aadhaarVisible")} />
                  </Row>
                  <Row label="Phone Number Visible" desc="Gold+ required to view contact details">
                    <Toggle2 on={privacy.phoneVisible} onToggle={() => togglePrivacy("phoneVisible")} />
                  </Row>
                </Card>

                <div
                  style={{
                    borderRadius: 16,
                    padding: 16,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    background: "rgba(141,184,112,0.06)",
                    border: "1px solid rgba(141,184,112,0.18)",
                  }}
                >
                  <Lock style={{ width: 20, height: 20, color: "#8DB870", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p
                      style={{
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#8DB870",
                        marginBottom: 4,
                        margin: "0 0 4px",
                      }}
                    >
                      Your data is protected
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 12,
                        color: "rgba(141,184,112,0.7)",
                        margin: 0,
                      }}
                    >
                      Match4Marriage is PDPB compliant. Aadhaar is hashed and never stored in plain text. All messages are E2E encrypted.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ── Preferences ── */}
            {section === "preferences" && (
              <>
                <Card>
                  <Row label="Dark Mode" desc="Switch to dark theme">
                    <Toggle2 on={prefs.darkMode} onToggle={() => togglePrefs("darkMode")} />
                  </Row>
                  <Row label="Language">
                    <select value={prefs.language} onChange={(e) => setPrefs({ ...prefs, language: e.target.value })} style={selectStyle}>
                      {["English", "Hindi", "Tamil", "Telugu", "Marathi", "Bengali", "Gujarati"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </Row>
                </Card>

                <Card>
                  <SectionLabel text="Partner Preferences" />
                  <Row label="Age Range">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="number"
                        value={prefs.ageFrom}
                        onChange={(e) => setPrefs({ ...prefs, ageFrom: e.target.value })}
                        style={inputStyle}
                      />
                      <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>to</span>
                      <input
                        type="number"
                        value={prefs.ageTo}
                        onChange={(e) => setPrefs({ ...prefs, ageTo: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </Row>
                  <Row label="Religion">
                    <select value={prefs.religionFilter} onChange={(e) => setPrefs({ ...prefs, religionFilter: e.target.value })} style={selectStyle}>
                      {["Any", "Hindu", "Christian", "Sikh", "Jain", "Buddhist", "Muslim"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </Row>
                </Card>
              </>
            )}

            {/* ── Account ── */}
            {section === "account" && (
              <>
                {/* Email verification card. Hidden while the verified flag
                    is loading (null) so the UI doesn't flash 'Not verified'
                    for a verified user. */}
                {emailVerified !== null && (
                  <div
                    style={{
                      borderRadius: 16,
                      padding: 20,
                      background: emailVerified
                        ? "rgba(141,184,112,0.05)"
                        : "rgba(220,30,60,0.04)",
                      border: `1px solid ${emailVerified ? "rgba(141,184,112,0.2)" : "rgba(220,30,60,0.18)"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: emailVerified ? 0 : 12 }}>
                      <div
                        style={{
                          flexShrink: 0,
                          width: 32, height: 32, borderRadius: 999,
                          background: emailVerified ? "rgba(141,184,112,0.15)" : "rgba(220,30,60,0.12)",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {emailVerified
                          ? <CheckCircle style={{ width: 16, height: 16, color: "#8DB870" }} />
                          : <Mail style={{ width: 16, height: 16, color: "#dc1e3c" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontFamily: "var(--font-poppins, sans-serif)", fontSize: 14, fontWeight: 600, color: "#f4eef0" }}>
                          {emailVerified ? "Email verified" : "Verify your email"}
                        </p>
                        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-poppins, sans-serif)", fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                          {emailVerified
                            ? `${account.email} is confirmed. Your Trust Score includes the email signal.`
                            : `We'll send a 6-digit code to ${account.email}. Verifying boosts your Trust Score by 20 points.`}
                        </p>
                      </div>
                    </div>

                    {!emailVerified && (
                      <div style={{ marginTop: 12 }}>
                        {emailVerifyStage === "code" || emailVerifyStage === "verifying" ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="\d*"
                              maxLength={6}
                              value={emailCode}
                              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                              onKeyDown={(e) => { if (e.key === "Enter" && emailVerifyStage === "code") handleVerifyEmailCode(); }}
                              placeholder="6-digit code"
                              autoComplete="one-time-code"
                              style={{
                                flex: "1 0 140px",
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.15)",
                                fontFamily: "ui-monospace, 'SF Mono', monospace",
                                fontSize: 16,
                                letterSpacing: "0.25em",
                                background: "rgba(255,255,255,0.05)",
                                color: "#f4eef0",
                                outline: "none",
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleVerifyEmailCode}
                              disabled={emailVerifyStage === "verifying"}
                              style={{
                                padding: "10px 16px",
                                borderRadius: 10,
                                border: "none",
                                background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                                color: "#fff",
                                fontFamily: "var(--font-poppins, sans-serif)",
                                fontSize: 13, fontWeight: 600,
                                cursor: emailVerifyStage === "verifying" ? "wait" : "pointer",
                                display: "inline-flex", alignItems: "center", gap: 6,
                              }}
                            >
                              {emailVerifyStage === "verifying" && <Loader2 style={{ width: 13, height: 13, animation: "spin 0.7s linear infinite" }} />}
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={handleSendVerificationEmail}
                              disabled={emailVerifyStage === "verifying"}
                              style={{
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: "rgba(255,255,255,0.05)",
                                color: "rgba(255,255,255,0.7)",
                                fontFamily: "var(--font-poppins, sans-serif)",
                                fontSize: 13, fontWeight: 500,
                                cursor: "pointer",
                              }}
                            >
                              Resend
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendVerificationEmail}
                            disabled={emailVerifyStage === "sending"}
                            style={{
                              padding: "10px 18px",
                              borderRadius: 10,
                              border: "none",
                              background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                              color: "#fff",
                              fontFamily: "var(--font-poppins, sans-serif)",
                              fontSize: 13, fontWeight: 600,
                              cursor: emailVerifyStage === "sending" ? "wait" : "pointer",
                              display: "inline-flex", alignItems: "center", gap: 8,
                            }}
                          >
                            {emailVerifyStage === "sending"
                              ? <><Loader2 style={{ width: 13, height: 13, animation: "spin 0.7s linear infinite" }} /> Sending…</>
                              : <>Send verification code</>}
                          </button>
                        )}
                      </div>
                    )}

                    {emailVerifyMsg && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "8px 12px",
                          borderRadius: 8,
                          fontFamily: "var(--font-poppins, sans-serif)",
                          fontSize: 12,
                          lineHeight: 1.5,
                          display: "inline-flex", alignItems: "center", gap: 6,
                          background:
                            emailVerifyMsg.tone === "error" ? "rgba(220,30,60,0.08)"
                            : emailVerifyMsg.tone === "success" ? "rgba(141,184,112,0.1)"
                            : "rgba(255,255,255,0.05)",
                          color:
                            emailVerifyMsg.tone === "error" ? "#a0153c"
                            : emailVerifyMsg.tone === "success" ? "#8DB870"
                            : "rgba(255,255,255,0.7)",
                        }}
                      >
                        {emailVerifyMsg.tone === "error" && <AlertCircle style={{ width: 12, height: 12 }} />}
                        {emailVerifyMsg.tone === "success" && <CheckCircle style={{ width: 12, height: 12 }} />}
                        <span>{emailVerifyMsg.text}</span>
                      </div>
                    )}

                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}

                <Card>
                  {[
                    { label: "Change Phone Number",      desc: account.phone                        },
                    { label: "Change Email",             desc: account.email                        },
                    { label: "Change Password",          desc: "Reset via email"                    },
                    { label: "Two-Factor Authentication",desc: "Add extra security"                 },
                  ].map(({ label, desc }) => (
                    <Row key={label} label={label} desc={desc}>
                      <ChevronRight style={{ width: 16, height: 16, color: "rgba(255,255,255,0.25)" }} />
                    </Row>
                  ))}
                </Card>

                <Card>
                  {account.google ? (
                    <Row label="Linked Google Account" desc={account.google}>
                      <CheckCircle style={{ width: 16, height: 16, color: "#8DB870" }} />
                    </Row>
                  ) : (
                    <Row label="Link Google Account" desc="Sign in faster with one click">
                      <ChevronRight style={{ width: 16, height: 16, color: "rgba(255,255,255,0.25)" }} />
                    </Row>
                  )}
                  <Row label="Link LinkedIn" desc="Verify your professional credentials">
                    <button
                      style={{
                        padding: "4px 12px",
                        borderRadius: 999,
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#fff",
                        background: "#0077B5",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Link
                    </button>
                  </Row>
                </Card>

                <div
                  style={{
                    borderRadius: 16,
                    padding: 16,
                    background: "rgba(239,68,68,0.05)",
                    border: "1px solid rgba(239,68,68,0.15)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-poppins, sans-serif)",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#ef4444",
                      marginBottom: 4,
                      margin: "0 0 4px",
                    }}
                  >
                    Danger Zone
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-poppins, sans-serif)",
                      fontSize: 12,
                      color: "rgba(248,113,113,0.7)",
                      marginBottom: 12,
                      margin: "0 0 12px",
                    }}
                  >
                    These actions are irreversible. Please be certain.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{
                        padding: "8px 16px",
                        borderRadius: 999,
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#ef4444",
                        background: "transparent",
                        border: "1px solid rgba(239,68,68,0.25)",
                        cursor: "pointer",
                      }}
                    >
                      Deactivate Account
                    </button>
                    <button
                      style={{
                        padding: "8px 16px",
                        borderRadius: 999,
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#fff",
                        background: "#ef4444",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />Delete Account
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── Data & Privacy ── */}
            {section === "data" && (
              <Card>
                {[
                  { label: "Download My Data",    desc: "Get a copy of all your Match4Marriage data (GDPR Article 20)", icon: <Download style={{ width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} /> },
                  { label: "Privacy Policy",      desc: "How we use and protect your data",                            icon: <Shield   style={{ width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} /> },
                  { label: "Terms of Service",    desc: "Platform terms and conditions",                               icon: <Globe    style={{ width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} /> },
                  { label: "Cookie Preferences",  desc: "Manage tracking and analytics cookies",                       icon: <Smartphone style={{ width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} /> },
                ].map(({ label, desc, icon }) => (
                  <Row key={label} label={label} desc={desc}>
                    {icon}
                  </Row>
                ))}
              </Card>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
