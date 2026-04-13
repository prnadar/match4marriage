"use client";

import { useState } from "react";
import { Bell, Shield, Eye, Globe, Smartphone, CreditCard, LogOut, ChevronRight, Trash2, Download, Lock, CheckCircle } from "lucide-react";

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
        background: on ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "rgba(26,10,20,0.12)",
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
        borderBottom: "1px solid rgba(220,30,60,0.06)",
      }}
    >
      <div>
        <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 14, fontWeight: 500, color: "rgba(26,10,20,0.8)", margin: 0 }}>{label}</p>
        {desc && <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 12, color: "rgba(26,10,20,0.4)", marginTop: 2, margin: 0 }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(220,30,60,0.08)",
        borderRadius: 16,
        padding: "4px 20px",
        boxShadow: "0 2px 12px rgba(220,30,60,0.04)",
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
        color: "rgba(26,10,20,0.35)",
        textTransform: "uppercase",
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

  const toggleNotif   = (key: keyof typeof notifs)  => setNotifs((p)  => ({ ...p, [key]: !p[key] }));
  const togglePrivacy = (key: keyof typeof privacy)  => setPrivacy((p) => ({ ...p, [key]: !p[key] }));
  const togglePrefs   = (key: keyof typeof prefs)    => setPrefs((p)   => ({ ...p, [key]: !p[key] }));

  const selectStyle = {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(220,30,60,0.15)",
    borderRadius: 10,
    padding: "6px 12px",
    fontFamily: "var(--font-poppins, sans-serif)",
    fontSize: 14,
    color: "#1a0a14",
    outline: "none",
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(220,30,60,0.15)",
    borderRadius: 10,
    padding: "6px 8px",
    fontFamily: "var(--font-poppins, sans-serif)",
    fontSize: 14,
    color: "#1a0a14",
    outline: "none",
    width: 64,
    textAlign: "center" as const,
  };

  return (
    <div style={{ background: "#fdfbf9", minHeight: "100vh", padding: "32px" }}>
      <div style={{ maxWidth: 896 }}>
        <h1
          style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: 30,
            fontWeight: 300,
            color: "#1a0a14",
            marginBottom: 24,
            margin: "0 0 24px",
          }}
        >
          Settings
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24 }}>
          {/* Nav */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                  background: section === n.key ? "rgba(220,30,60,0.08)" : "transparent",
                  color: section === n.key ? "#dc1e3c" : "rgba(26,10,20,0.55)",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <span style={{ color: section === n.key ? "#dc1e3c" : "rgba(26,10,20,0.35)" }}>
                  {n.icon}
                </span>
                {n.label}
              </button>
            ))}

            <div style={{ borderTop: "1px solid rgba(220,30,60,0.1)", marginTop: 16, paddingTop: 16 }}>
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
                    background: "rgba(92,122,82,0.06)",
                    border: "1px solid rgba(92,122,82,0.18)",
                  }}
                >
                  <Lock style={{ width: 20, height: 20, color: "#5C7A52", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p
                      style={{
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#5C7A52",
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
                        color: "rgba(92,122,82,0.7)",
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
                      <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 12, color: "rgba(26,10,20,0.4)" }}>to</span>
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
                <Card>
                  {[
                    { label: "Change Phone Number",      desc: "+44 7476 212655"           },
                    { label: "Change Email",             desc: "prabhakar@example.com"     },
                    { label: "Change Password",          desc: "Last changed 3 months ago" },
                    { label: "Two-Factor Authentication",desc: "Add extra security"        },
                  ].map(({ label, desc }) => (
                    <Row key={label} label={label} desc={desc}>
                      <ChevronRight style={{ width: 16, height: 16, color: "rgba(26,10,20,0.25)" }} />
                    </Row>
                  ))}
                </Card>

                <Card>
                  <Row label="Linked Google Account" desc="prabhakar@gmail.com">
                    <CheckCircle style={{ width: 16, height: 16, color: "#5C7A52" }} />
                  </Row>
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
                  { label: "Download My Data",    desc: "Get a copy of all your Match4Marriage data (GDPR Article 20)", icon: <Download style={{ width: 16, height: 16, color: "rgba(26,10,20,0.35)" }} /> },
                  { label: "Privacy Policy",      desc: "How we use and protect your data",                            icon: <Shield   style={{ width: 16, height: 16, color: "rgba(26,10,20,0.35)" }} /> },
                  { label: "Terms of Service",    desc: "Platform terms and conditions",                               icon: <Globe    style={{ width: 16, height: 16, color: "rgba(26,10,20,0.35)" }} /> },
                  { label: "Cookie Preferences",  desc: "Manage tracking and analytics cookies",                       icon: <Smartphone style={{ width: 16, height: 16, color: "rgba(26,10,20,0.35)" }} /> },
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
