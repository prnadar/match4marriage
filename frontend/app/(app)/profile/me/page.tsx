"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { profileApi, api } from "@/lib/api";
import {
  Shield, CheckCircle, AlertCircle, Camera, Upload,
  Plus, X, Edit3, Heart, Star, Users, Briefcase, GraduationCap,
  MapPin, Globe,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

const HEIGHTS = [
  "4ft 6in","4ft 7in","4ft 8in","4ft 9in","4ft 10in","4ft 11in",
  "5ft 0in","5ft 1in","5ft 2in","5ft 3in","5ft 4in","5ft 5in",
  "5ft 6in","5ft 7in","5ft 8in","5ft 9in","5ft 10in","5ft 11in",
  "6ft 0in","6ft 1in","6ft 2in","6ft 3in","6ft 4in","6ft 5in",
  "6ft 6in","7ft 0in",
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const COUNTRIES = [
  "UK","India","UAE","USA","Canada","Australia",
  "Singapore","Germany","France","Netherlands","New Zealand","Malaysia","Other",
];

const INCOME_OPTIONS = [
  "Not Specified","Below £20k","£20k–£30k","£30k–£50k",
  "£50k–£75k","£75k–£100k","Above £100k",
];

const INTERESTS_CONFIG: Record<string, string[]> = {
  Music:   ["Film Music","Devotional","Western Music","Hindi Songs","Tamil Songs","Malayalam Songs","Classical"],
  Reading: ["Newspapers","Self Help","Management","Classics","Biographies","Romance","Thrillers","Magazines"],
  Movies:  ["Malayalam","English","Hindi","Tamil","Comedy","Romance","Action","Family Stories","Documentaries"],
  Sports:  ["Cricket","Football","Tennis","Badminton","Board Games","Basketball","Swimming","Running","Gym"],
  Foods:   ["Kerala","North Indian","South Indian","Chinese","Continental","Thai","Anything"],
  Dress:   ["Indian Traditional","Indo Western","Casual","Formal","No Preference"],
};

const VERIFICATIONS = [
  { label: "Email Verified",    done: true,  pts: 20 },
  { label: "Mobile Verified",   done: true,  pts: 20 },
  { label: "ID Verified",       done: false, pts: 30 },
  { label: "Profile Complete",  done: false, pts: 20 },
  { label: "LinkedIn",          done: false, pts: 10 },
];

const TABS = [
  { id: "general",   label: "General Info",         total: 25 },
  { id: "education", label: "Education & Career",   total: 8  },
  { id: "family",    label: "My Family",            total: 12 },
  { id: "interests", label: "Interests",            total: 6  },
  { id: "partner",   label: "Partner Preferences",  total: 10 },
  { id: "contact",   label: "Contact Details",      total: 11 },
  { id: "photos",    label: "My Photos",            total: 6  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface School      { name: string; place: string; year: string; }
interface College     { name: string; course: string; place: string; year: string; }
interface Employment  { company: string; designation: string; location: string; }

// ─── Shared Styles ────────────────────────────────────────────────────────────

const BASE_INPUT: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-poppins, sans-serif)",
  fontSize: "0.875rem",
  color: "#1a0a14",
  border: "1px solid rgba(220,30,60,0.15)",
  borderRadius: 10,
  padding: "12px 16px",
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-poppins, sans-serif)",
  fontSize: 11,
  fontWeight: 600,
  color: "#555",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  display: "block",
  marginBottom: 6,
};

const CARD_STYLE: React.CSSProperties = {
  borderRadius: 16,
  padding: "1.25rem",
  background: "#fff",
  border: "1px solid rgba(220,30,60,0.08)",
  boxShadow: "0 2px 16px rgba(220,30,60,0.06)",
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MyProfilePage() {
  const [activeTab, setActiveTab] = useState("general");
  const [savedTab,  setSavedTab]  = useState<string | null>(null);

  // General Info
  const [general, setGeneral] = useState({
    profileCreatedBy: "", name: "", gender: "",
    dobDay: "", dobMonth: "", dobYear: "",
    height: "", weight: "", maritalStatus: "", motherTongue: "",
    religion: "", denomination: "", subCaste: "",
    complexion: "", bodyType: "", bloodGroup: "",
    star: "", chovvaDosham: "", physicalStatus: "",
    aboutMe: "", countryLivingIn: "", residentialStatus: "",
    nativePlace: "", currentLocation: "", diet: "", smoke: "", drink: "",
  });

  // Education & Career
  const [education, setEducation] = useState({
    educationLevel: "", educationDetail: "",
    occupation: "", employedIn: "", annualIncome: "",
  });
  const [schools,    setSchools]    = useState<School[]>([{ name: "", place: "", year: "" }]);
  const [colleges,   setColleges]   = useState<College[]>([{ name: "", course: "", place: "", year: "" }]);
  const [employment, setEmployment] = useState<Employment[]>([{ company: "", designation: "", location: "" }]);

  // Family
  const [family, setFamily] = useState({
    aboutFamily: "", familyType: "", familyStatus: "", familyValue: "",
    annualFamilyIncome: "",
    fatherName: "", fatherOccupation: "", fatherCompany: "", fatherDesignation: "", fatherLocation: "",
    motherName: "", motherOccupation: "", motherCompany: "", motherDesignation: "", motherLocation: "",
    brothers: "", sisters: "",
  });

  // Interests
  const [interests, setInterests] = useState<Record<string, string[]>>({
    Music: [], Reading: [], Movies: [], Sports: [], Foods: [], Dress: [],
  });

  // Partner Preferences
  const [partner, setPartner] = useState({
    ageFrom: "", ageTo: "", heightFrom: "", heightTo: "",
    maritalStatus: "", religionPref: "", denomination: "",
    motherTongue: "", education: "", occupation: "",
    diet: "", country: "", residentialStatus: "", aboutPartner: "",
  });

  // Contact
  const [contact, setContact] = useState({
    countryCode: "+44", mobile: "", altPhone: "", preferredContact: "",
    bestTimeToCall: "", contactPersonName: "", contactRelationship: "",
    address1: "", address2: "", city: "", country: "", postcode: "",
  });

  // Completion counts
  const countFilled = (obj: Record<string, string>) =>
    Object.values(obj).filter((v) => v.trim() !== "").length;

  const tabCounts: Record<string, { filled: number; total: number }> = {
    general:   { filled: countFilled(general),   total: 25 },
    education: { filled: countFilled(education), total: 8  },
    family:    { filled: countFilled(family),    total: 12 },
    interests: { filled: Object.values(interests).filter((a) => a.length > 0).length, total: 6 },
    partner:   { filled: countFilled(partner),   total: 10 },
    contact:   { filled: countFilled(contact),   total: 11 },
    photos:    { filled: 0, total: 6 },
  };

  // Load profile from backend on mount (uses Firebase auth token via profileApi.me)
  useEffect(() => {
    (async () => {
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data ?? res.data;
        if (!p) return;

        const dob = p.date_of_birth ? new Date(p.date_of_birth) : null;
        setGeneral((prev) => ({
          ...prev,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || prev.name,
          gender: p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : prev.gender,
          dobDay: dob ? String(dob.getDate()) : prev.dobDay,
          dobMonth: dob ? ["January","February","March","April","May","June","July","August","September","October","November","December"][dob.getMonth()] : prev.dobMonth,
          dobYear: dob ? String(dob.getFullYear()) : prev.dobYear,
          height: p.height_cm ? `${Math.floor(p.height_cm / 30.48)}ft ${Math.round((p.height_cm % 30.48) / 2.54)}in` : prev.height,
          weight: p.weight_kg ? String(p.weight_kg) : prev.weight,
          religion: p.religion ? p.religion.charAt(0).toUpperCase() + p.religion.slice(1) : prev.religion,
          subCaste: p.caste || prev.subCaste,
          motherTongue: p.mother_tongue || prev.motherTongue,
          countryLivingIn: p.country || prev.countryLivingIn,
          currentLocation: p.city || prev.currentLocation,
          aboutMe: p.bio || prev.aboutMe,
          maritalStatus: p.marital_status ? p.marital_status.charAt(0).toUpperCase() + p.marital_status.slice(1).replace(/_/g, " ") : prev.maritalStatus,
        }));

        setEducation((prev) => ({
          ...prev,
          educationLevel: p.education_level || prev.educationLevel,
          occupation: p.occupation || prev.occupation,
          annualIncome: p.annual_income_inr ? String(p.annual_income_inr) : prev.annualIncome,
        }));

        if (p.about_family) setFamily((prev) => ({ ...prev, aboutFamily: p.about_family }));
        if (p.family_details) setFamily((prev) => ({ ...prev, ...p.family_details }));
        if (p.partner_prefs) setPartner((prev) => ({ ...prev, ...p.partner_prefs }));
      } catch (err) {
        console.warn("Failed to load profile:", err);
      }

      // Fallback: pre-fill from localStorage if backend returned empty fields
      setGeneral((prev) => {
        if (prev.name) return prev;
        const localName = localStorage.getItem("user_name") || "";
        const localGender = localStorage.getItem("user_gender") || "";
        return {
          ...prev,
          name: prev.name || localName,
          gender: prev.gender || (localGender === "male" ? "Male" : localGender === "female" ? "Female" : prev.gender),
        };
      });
    })();
  }, []);

  // ── Verification status (draft | submitted | approved | rejected) ─────────
  const [verifStatus, setVerifStatus] = useState<string>("draft");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loadedRef = useRef(false);

  // Pick up status from first profile load
  useEffect(() => {
    (async () => {
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data ?? res.data;
        if (p) {
          setVerifStatus(p.verification_status || "draft");
          setRejectionReason(p.rejection_reason || null);
        }
      } catch { /* ignore */ }
      loadedRef.current = true;
    })();
  }, []);

  const handleSubmitForReview = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post("/api/v1/profile/me/submit", {});
      const p = (res.data as any)?.data;
      if (p) {
        setVerifStatus(p.verification_status || "submitted");
        setRejectionReason(p.rejection_reason || null);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.missing) {
        setSubmitError(`Missing required fields: ${detail.missing.join(", ")}`);
      } else {
        setSubmitError(detail?.message || detail || err?.message || "Could not submit.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = useCallback(async (tabId: string) => {
    // Map form state → backend fields
    const nameParts = general.name.trim().split(/\s+/);
    const dobStr = general.dobYear && general.dobMonth && general.dobDay
      ? `${general.dobYear}-${String(["January","February","March","April","May","June","July","August","September","October","November","December"].indexOf(general.dobMonth) + 1).padStart(2, "0")}-${String(general.dobDay).padStart(2, "0")}`
      : undefined;

    const payload: Record<string, unknown> = {
      first_name: nameParts[0] || undefined,
      last_name: nameParts.slice(1).join(" ") || undefined,
      gender: general.gender ? general.gender.toLowerCase() : undefined,
      date_of_birth: dobStr,
      country: general.countryLivingIn || undefined,
      religion: general.religion ? general.religion.toLowerCase() : undefined,
      caste: general.subCaste || undefined,
      mother_tongue: general.motherTongue || undefined,
      city: general.currentLocation || undefined,
      bio: general.aboutMe || undefined,
      education_level: education.educationLevel || undefined,
      occupation: education.occupation || undefined,
      annual_income_inr: education.annualIncome ? parseInt(education.annualIncome, 10) || undefined : undefined,
      about_family: family.aboutFamily || undefined,
      partner_prefs: Object.values(partner).some((v) => v) ? partner : undefined,
    };

    // Remove undefined values
    Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });

    try {
      await api.patch("/api/v1/profile/me", payload);
      setSavedTab(tabId);
      setTimeout(() => setSavedTab(null), 2000);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setSavedTab(null);
    }
  }, [general, education, family, partner]);

  // ── Autosave: debounce any change to form state, then PATCH to Neon ────────
  useEffect(() => {
    if (!loadedRef.current) return;
    setAutoSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await handleSave("auto");
        setAutoSaveState("saved");
        setTimeout(() => setAutoSaveState("idle"), 1500);
      } catch {
        setAutoSaveState("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [general, education, family, partner, contact, interests, handleSave]);

  const upGeneral   = (f: string, v: string) => setGeneral  ((p) => ({ ...p, [f]: v }));
  const upEducation = (f: string, v: string) => setEducation((p) => ({ ...p, [f]: v }));
  const upFamily    = (f: string, v: string) => setFamily   ((p) => ({ ...p, [f]: v }));
  const upPartner   = (f: string, v: string) => setPartner  ((p) => ({ ...p, [f]: v }));
  const upContact   = (f: string, v: string) => setContact  ((p) => ({ ...p, [f]: v }));

  const toggleInterest = (cat: string, item: string) =>
    setInterests((p) => ({
      ...p,
      [cat]: p[cat].includes(item) ? p[cat].filter((i) => i !== item) : [...p[cat], item],
    }));

  return (
    <div style={{ padding: "2rem", background: "#fdfbf9", minHeight: "100%" }}>
      <h1 style={{
        fontFamily: "var(--font-playfair, serif)",
        fontSize: "1.875rem",
        fontWeight: 300,
        color: "#1a0a14",
        marginBottom: "1.5rem",
        letterSpacing: "-0.01em",
      }}>
        My Profile
      </h1>

      {/* Verification status banner */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, padding: "12px 16px", borderRadius: 10, marginBottom: 16,
        background: verifStatus === "approved" ? "#e8f5e9"
                  : verifStatus === "submitted" ? "#fff4e0"
                  : verifStatus === "rejected" ? "#ffe9ec"
                  : "#f3f3f3",
        border: "1px solid rgba(0,0,0,0.06)",
        fontSize: 14,
      }}>
        <div>
          {verifStatus === "approved" && <span>✅ <strong>Approved.</strong> Your profile is live and visible to matches.</span>}
          {verifStatus === "submitted" && <span>⏳ <strong>Under review.</strong> We'll notify you once verified.</span>}
          {verifStatus === "rejected" && <span>⚠️ <strong>Changes needed:</strong> {rejectionReason || "please update and resubmit."}</span>}
          {verifStatus === "draft" && <span>📝 <strong>Draft.</strong> Complete all sections, then submit for verification.</span>}
          <span style={{ marginLeft: 12, color: "#666", fontSize: 12 }}>
            {autoSaveState === "saving" && "Saving…"}
            {autoSaveState === "saved" && "Saved ✓"}
            {autoSaveState === "error" && "Save failed"}
          </span>
        </div>
        {(verifStatus === "draft" || verifStatus === "rejected") && (
          <button
            onClick={handleSubmitForReview}
            disabled={submitting}
            style={{
              padding: "8px 16px", borderRadius: 6, border: "none",
              background: "#7B2D3A", color: "#fff", cursor: "pointer", fontWeight: 600,
            }}
          >
            {submitting ? "Submitting…" : "Submit for verification"}
          </button>
        )}
      </div>
      {submitError && (
        <div style={{ padding: "10px 14px", background: "#ffe9ec", color: "#7B2D3A", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {submitError}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: "1.5rem",
        alignItems: "start",
      }}>
        {/* ── Left Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <PhotoCard name={general.name || "Your Name"} />
          <TrustScoreCard score={40} />
          <CompletenessCard completeness={68} />
        </div>

        {/* ── Right: Tab Panel ── */}
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* Tab Bar */}
          <div style={{
            display: "flex",
            background: "#fff",
            borderRadius: "16px 16px 0 0",
            borderTop: "1px solid rgba(220,30,60,0.08)",
            borderLeft: "1px solid rgba(220,30,60,0.08)",
            borderRight: "1px solid rgba(220,30,60,0.08)",
            borderBottom: "2px solid rgba(220,30,60,0.1)",
            overflowX: "auto",
          }}>
            {TABS.map((tab) => {
              const { filled, total } = tabCounts[tab.id];
              const isActive   = activeTab === tab.id;
              const isComplete = filled >= total;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: "0 0 auto",
                    padding: "14px 14px 12px",
                    fontFamily: "var(--font-poppins, sans-serif)",
                    fontSize: "0.78rem",
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? "#dc1e3c" : "#888",
                    background: "transparent",
                    border: "none",
                    borderBottom: isActive ? "2px solid #dc1e3c" : "2px solid transparent",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: -2,
                  }}
                >
                  {tab.label}
                  <span style={{
                    fontSize: "0.65rem",
                    padding: "2px 5px",
                    borderRadius: 99,
                    background: isComplete
                      ? "rgba(34,197,94,0.12)"
                      : isActive
                      ? "rgba(220,30,60,0.08)"
                      : "rgba(0,0,0,0.05)",
                    color: isComplete ? "#16a34a" : isActive ? "#dc1e3c" : "#bbb",
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}>
                    {isComplete ? "✓" : `${filled}/${total}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Area */}
          <div style={{
            background: "#fdfbf9",
            borderLeft: "1px solid rgba(220,30,60,0.08)",
            borderRight: "1px solid rgba(220,30,60,0.08)",
            borderBottom: "1px solid rgba(220,30,60,0.08)",
            borderRadius: "0 0 16px 16px",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}>
            {activeTab === "general" && (
              <GeneralTab
                form={general} update={upGeneral}
                onSave={() => handleSave("general")} saving={savedTab === "general"}
              />
            )}
            {activeTab === "education" && (
              <EducationTab
                form={education} update={upEducation}
                schools={schools} setSchools={setSchools}
                colleges={colleges} setColleges={setColleges}
                employment={employment} setEmployment={setEmployment}
                onSave={() => handleSave("education")} saving={savedTab === "education"}
              />
            )}
            {activeTab === "family" && (
              <FamilyTab
                form={family} update={upFamily}
                onSave={() => handleSave("family")} saving={savedTab === "family"}
              />
            )}
            {activeTab === "interests" && (
              <InterestsTab
                interests={interests} toggle={toggleInterest}
                onSave={() => handleSave("interests")} saving={savedTab === "interests"}
              />
            )}
            {activeTab === "partner" && (
              <PartnerTab
                form={partner} update={upPartner}
                onSave={() => handleSave("partner")} saving={savedTab === "partner"}
              />
            )}
            {activeTab === "contact" && (
              <ContactTab
                form={contact} update={upContact}
                onSave={() => handleSave("contact")} saving={savedTab === "contact"}
              />
            )}
            {activeTab === "photos" && (
              <PhotosTab />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 1: General Info ───────────────────────────────────────────────────────

function GeneralTab({
  form, update, onSave, saving,
}: {
  form: Record<string, string>;
  update: (f: string, v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <>
      {/* Mandatory notice */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "rgba(220,30,60,0.04)", border: "1px solid rgba(220,30,60,0.12)", marginBottom: 4 }}>
        <span style={{ color: "#dc1e3c", fontWeight: 700, fontSize: 14 }}>*</span>
        <span style={{ fontSize: 12, color: "#888" }}>Fields marked with an asterisk are mandatory and must be completed before your profile can go live.</span>
      </div>
      {/* Personal Details */}
      <SubSection title="Personal Details">
        <TwoCol>
          <Field label="Profile Created By">
            <FSelect value={form.profileCreatedBy} onChange={(v) => update("profileCreatedBy", v)} placeholder="Select">
              {["Self","Parent","Sibling","Friend","Relative"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Full Name" required>
            <FInput value={form.name} onChange={(v) => update("name", v)} placeholder="e.g. Priya Menon" />
          </Field>
          <Field label="Gender" required>
            <FSelect value={form.gender} onChange={(v) => update("gender", v)} placeholder="Select">
              {["Male","Female"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Marital Status" required>
            <FSelect value={form.maritalStatus} onChange={(v) => update("maritalStatus", v)} placeholder="Select">
              {["Never Married","Divorced","Widowed","Awaiting Divorce"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>

        {/* Date of Birth */}
        <div style={{ marginTop: 16 }}>
          <label style={LABEL_STYLE}>Date of Birth <span style={{ color: "#dc1e3c", fontWeight: 700 }}>*</span></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 10 }}>
            <FSelect value={form.dobDay} onChange={(v) => update("dobDay", v)} placeholder="Day">
              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </FSelect>
            <FSelect value={form.dobMonth} onChange={(v) => update("dobMonth", v)} placeholder="Month">
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </FSelect>
            <FSelect value={form.dobYear} onChange={(v) => update("dobYear", v)} placeholder="Year">
              {Array.from({ length: 60 }, (_, i) => String(2006 - i)).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </FSelect>
          </div>
        </div>

        <TwoCol style={{ marginTop: 16 }}>
          <Field label="Height" required>
            <FSelect value={form.height} onChange={(v) => update("height", v)} placeholder="e.g. 5ft 8in">
              {HEIGHTS.map((h) => <option key={h} value={h}>{h}</option>)}
            </FSelect>
          </Field>
          <Field label="Weight (kg)">
            <FInput value={form.weight} onChange={(v) => update("weight", v)} placeholder="e.g. 65" />
          </Field>
          <Field label="Complexion">
            <FSelect value={form.complexion} onChange={(v) => update("complexion", v)} placeholder="Select">
              {["Very Fair","Fair","Wheatish","Wheatish Brown","Dark"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Body Type">
            <FSelect value={form.bodyType} onChange={(v) => update("bodyType", v)} placeholder="Select">
              {["Slim","Athletic","Average","Heavy"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Blood Group">
            <FSelect value={form.bloodGroup} onChange={(v) => update("bloodGroup", v)} placeholder="Select">
              {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Physical Status">
            <FSelect value={form.physicalStatus} onChange={(v) => update("physicalStatus", v)} placeholder="Select">
              {["Normal","Physically Challenged"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>

        <div style={{ marginTop: 16 }}>
          <Field label="About Me">
            <FTextarea
              value={form.aboutMe}
              onChange={(v) => update("aboutMe", v)}
              placeholder="Tell potential matches about yourself, your values, and what you're looking for..."
              rows={4}
            />
          </Field>
        </div>
      </SubSection>

      {/* Religious & Cultural */}
      <SubSection title="Religious & Cultural">
        <TwoCol>
          <Field label="Mother Tongue" required>
            <FSelect value={form.motherTongue} onChange={(v) => update("motherTongue", v)} placeholder="Select">
              {["Malayalam","Tamil","Telugu","Kannada","Hindi","English","Other"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Religion" required>
            <FSelect value={form.religion} onChange={(v) => update("religion", v)} placeholder="Select">
              {["Hindu","Christian","Sikh","Jain","Buddhist","Muslim","Other"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Denomination / Caste" required>
            <FInput value={form.denomination} onChange={(v) => update("denomination", v)} placeholder="e.g. Nair, Iyer, Syrian Christian" />
          </Field>
          <Field label="Sub Caste">
            <FInput value={form.subCaste} onChange={(v) => update("subCaste", v)} placeholder="e.g. Kiriyathil Nair" />
          </Field>
          <Field label="Star / Nakshatra">
            <FSelect value={form.star} onChange={(v) => update("star", v)} placeholder="e.g. Ashwini">
              {NAKSHATRAS.map((n) => <option key={n} value={n}>{n}</option>)}
            </FSelect>
          </Field>
          <Field label="Chovva Dosham">
            <FSelect value={form.chovvaDosham} onChange={(v) => update("chovvaDosham", v)} placeholder="Select">
              {["Yes","No","Partial"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>
      </SubSection>

      {/* Location & Lifestyle */}
      <SubSection title="Location & Lifestyle">
        <TwoCol>
          <Field label="Country Living In" required>
            <FSelect value={form.countryLivingIn} onChange={(v) => update("countryLivingIn", v)} placeholder="Select">
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </FSelect>
          </Field>
          <Field label="Residential Status" required>
            <FSelect value={form.residentialStatus} onChange={(v) => update("residentialStatus", v)} placeholder="Select">
              {["Citizen","Permanent Resident","Work Permit","Student Visa","Temporary Visa"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Native Place" required>
            <FInput value={form.nativePlace} onChange={(v) => update("nativePlace", v)} placeholder="e.g. Thrissur, Kerala" />
          </Field>
          <Field label="Current Location / City" required>
            <FInput value={form.currentLocation} onChange={(v) => update("currentLocation", v)} placeholder="e.g. London, UK" />
          </Field>
          <Field label="Diet">
            <FSelect value={form.diet} onChange={(v) => update("diet", v)} placeholder="Select">
              {["Vegetarian","Non-Vegetarian","Eggetarian","Vegan","Jain"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Smoke">
            <FSelect value={form.smoke} onChange={(v) => update("smoke", v)} placeholder="Select">
              {["No","Occasionally","Yes"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Drink">
            <FSelect value={form.drink} onChange={(v) => update("drink", v)} placeholder="Select">
              {["No","Occasionally","Yes"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>
      </SubSection>

      <SaveButton onSave={onSave} saving={saving} label="Save General Info" />
    </>
  );
}

// ─── TAB 2: Education & Career ─────────────────────────────────────────────────

function EducationTab({
  form, update, schools, setSchools, colleges, setColleges,
  employment, setEmployment, onSave, saving,
}: {
  form: Record<string, string>;
  update: (f: string, v: string) => void;
  schools: School[];     setSchools:    (s: School[]) => void;
  colleges: College[];   setColleges:   (c: College[]) => void;
  employment: Employment[]; setEmployment: (e: Employment[]) => void;
  onSave: () => void; saving: boolean;
}) {
  return (
    <>
      <SubSection title="Education">
        <TwoCol>
          <Field label="Education Level" required>
            <FSelect value={form.educationLevel} onChange={(v) => update("educationLevel", v)} placeholder="Select">
              {["High School","Diploma","Bachelor's","Master's","Doctorate","Professional Degree","Other"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </FSelect>
          </Field>
          <Field label="Education in Detail">
            <FInput value={form.educationDetail} onChange={(v) => update("educationDetail", v)} placeholder="e.g. B.Tech Computer Science, IIT Madras" />
          </Field>
        </TwoCol>

        {/* Schools */}
        <div style={{ marginTop: 20 }}>
          <label style={{ ...LABEL_STYLE, marginBottom: 10 }}>Schools</label>
          {schools.map((s, i) => (
            <RepRow
              key={i}
              onRemove={schools.length > 1 ? () => setSchools(schools.filter((_, idx) => idx !== i)) : undefined}
            >
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                <Field label="School Name">
                  <FInput
                    value={s.name}
                    onChange={(v) => setSchools(schools.map((r, idx) => idx === i ? { ...r, name: v } : r))}
                    placeholder="e.g. St. Joseph's School"
                  />
                </Field>
                <Field label="Place">
                  <FInput
                    value={s.place}
                    onChange={(v) => setSchools(schools.map((r, idx) => idx === i ? { ...r, place: v } : r))}
                    placeholder="e.g. Kochi"
                  />
                </Field>
                <Field label="Year">
                  <FInput
                    value={s.year}
                    onChange={(v) => setSchools(schools.map((r, idx) => idx === i ? { ...r, year: v } : r))}
                    placeholder="e.g. 2010"
                  />
                </Field>
              </div>
            </RepRow>
          ))}
          <AddBtn onClick={() => setSchools([...schools, { name: "", place: "", year: "" }])} />
        </div>

        {/* Colleges */}
        <div style={{ marginTop: 20 }}>
          <label style={{ ...LABEL_STYLE, marginBottom: 10 }}>Colleges</label>
          {colleges.map((c, i) => (
            <RepRow
              key={i}
              onRemove={colleges.length > 1 ? () => setColleges(colleges.filter((_, idx) => idx !== i)) : undefined}
            >
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", gap: 10 }}>
                <Field label="College Name">
                  <FInput
                    value={c.name}
                    onChange={(v) => setColleges(colleges.map((r, idx) => idx === i ? { ...r, name: v } : r))}
                    placeholder="e.g. MG University"
                  />
                </Field>
                <Field label="Course">
                  <FInput
                    value={c.course}
                    onChange={(v) => setColleges(colleges.map((r, idx) => idx === i ? { ...r, course: v } : r))}
                    placeholder="e.g. B.Com Finance"
                  />
                </Field>
                <Field label="Place">
                  <FInput
                    value={c.place}
                    onChange={(v) => setColleges(colleges.map((r, idx) => idx === i ? { ...r, place: v } : r))}
                    placeholder="e.g. Kottayam"
                  />
                </Field>
                <Field label="Year">
                  <FInput
                    value={c.year}
                    onChange={(v) => setColleges(colleges.map((r, idx) => idx === i ? { ...r, year: v } : r))}
                    placeholder="e.g. 2016"
                  />
                </Field>
              </div>
            </RepRow>
          ))}
          <AddBtn onClick={() => setColleges([...colleges, { name: "", course: "", place: "", year: "" }])} />
        </div>
      </SubSection>

      <SubSection title="Career">
        {/* Employment */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...LABEL_STYLE, marginBottom: 10 }}>Employment History</label>
          {employment.map((e, i) => (
            <RepRow
              key={i}
              onRemove={employment.length > 1 ? () => setEmployment(employment.filter((_, idx) => idx !== i)) : undefined}
            >
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 10 }}>
                <Field label="Company Name">
                  <FInput
                    value={e.company}
                    onChange={(v) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, company: v } : r))}
                    placeholder="e.g. Infosys, NHS, Barclays"
                  />
                </Field>
                <Field label="Designation">
                  <FInput
                    value={e.designation}
                    onChange={(v) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, designation: v } : r))}
                    placeholder="e.g. Senior Software Engineer"
                  />
                </Field>
                <Field label="Location">
                  <FInput
                    value={e.location}
                    onChange={(v) => setEmployment(employment.map((r, idx) => idx === i ? { ...r, location: v } : r))}
                    placeholder="e.g. London"
                  />
                </Field>
              </div>
            </RepRow>
          ))}
          <AddBtn onClick={() => setEmployment([...employment, { company: "", designation: "", location: "" }])} />
        </div>

        <TwoCol>
          <Field label="Occupation" required>
            <FSelect value={form.occupation} onChange={(v) => update("occupation", v)} placeholder="Select">
              {["Software Engineer","Doctor","Engineer","Business","Teacher","Accountant","Lawyer","Other"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </FSelect>
          </Field>
          <Field label="Employed In" required>
            <FSelect value={form.employedIn} onChange={(v) => update("employedIn", v)} placeholder="Select">
              {["Government","Private","Business/Self-Employed","Not Employed","Other"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </FSelect>
          </Field>
          <Field label="Annual Income">
            <FSelect value={form.annualIncome} onChange={(v) => update("annualIncome", v)} placeholder="Select">
              {INCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>
      </SubSection>

      <SaveButton onSave={onSave} saving={saving} label="Save Education & Career" />
    </>
  );
}

// ─── TAB 3: My Family ──────────────────────────────────────────────────────────

function FamilyTab({
  form, update, onSave, saving,
}: {
  form: Record<string, string>;
  update: (f: string, v: string) => void;
  onSave: () => void; saving: boolean;
}) {
  return (
    <>
      <SubSection title="Family Overview">
        <Field label="About My Family" required>
          <FTextarea
            value={form.aboutFamily}
            onChange={(v) => update("aboutFamily", v)}
            placeholder="Describe your family background, values, traditions, and what makes your family special..."
            rows={3}
          />
        </Field>
        <TwoCol style={{ marginTop: 16 }}>
          <Field label="Family Type">
            <FSelect value={form.familyType} onChange={(v) => update("familyType", v)} placeholder="Select">
              {["Joint","Nuclear","Extended"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Family Status">
            <FSelect value={form.familyStatus} onChange={(v) => update("familyStatus", v)} placeholder="Select">
              {["Middle Class","Upper Middle Class","Affluent","High Net Worth"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Family Values">
            <FSelect value={form.familyValue} onChange={(v) => update("familyValue", v)} placeholder="Select">
              {["Traditional","Moderate","Liberal"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Annual Family Income">
            <FSelect value={form.annualFamilyIncome} onChange={(v) => update("annualFamilyIncome", v)} placeholder="Select">
              {INCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>
      </SubSection>

      <SubSection title="Father's Details">
        <TwoCol>
          <Field label="Name">
            <FInput value={form.fatherName} onChange={(v) => update("fatherName", v)} placeholder="Father's full name" />
          </Field>
          <Field label="Occupation" required>
            <FInput value={form.fatherOccupation} onChange={(v) => update("fatherOccupation", v)} placeholder="e.g. Retired Government Officer" />
          </Field>
          <Field label="Company / Organisation">
            <FInput value={form.fatherCompany} onChange={(v) => update("fatherCompany", v)} placeholder="e.g. KSEB, Tata Motors" />
          </Field>
          <Field label="Designation">
            <FInput value={form.fatherDesignation} onChange={(v) => update("fatherDesignation", v)} placeholder="e.g. Chief Engineer" />
          </Field>
          <Field label="Location">
            <FInput value={form.fatherLocation} onChange={(v) => update("fatherLocation", v)} placeholder="e.g. Thrissur, Kerala" />
          </Field>
        </TwoCol>
      </SubSection>

      <SubSection title="Mother's Details">
        <TwoCol>
          <Field label="Name">
            <FInput value={form.motherName} onChange={(v) => update("motherName", v)} placeholder="Mother's full name" />
          </Field>
          <Field label="Occupation" required>
            <FInput value={form.motherOccupation} onChange={(v) => update("motherOccupation", v)} placeholder="e.g. Homemaker, Teacher" />
          </Field>
          <Field label="Company / Organisation">
            <FInput value={form.motherCompany} onChange={(v) => update("motherCompany", v)} placeholder="If employed" />
          </Field>
          <Field label="Designation">
            <FInput value={form.motherDesignation} onChange={(v) => update("motherDesignation", v)} placeholder="e.g. Principal" />
          </Field>
          <Field label="Location">
            <FInput value={form.motherLocation} onChange={(v) => update("motherLocation", v)} placeholder="e.g. Thrissur, Kerala" />
          </Field>
        </TwoCol>
      </SubSection>

      <SubSection title="Siblings">
        <TwoCol>
          <Field label="Brothers (count + marital status)">
            <FInput
              value={form.brothers}
              onChange={(v) => update("brothers", v)}
              placeholder="e.g. 1 elder brother, married"
            />
          </Field>
          <Field label="Sisters (count + marital status)">
            <FInput
              value={form.sisters}
              onChange={(v) => update("sisters", v)}
              placeholder="e.g. 2 sisters, both unmarried"
            />
          </Field>
        </TwoCol>
      </SubSection>

      <SaveButton onSave={onSave} saving={saving} label="Save Family Details" />
    </>
  );
}

// ─── TAB 4: Interests & Hobbies ────────────────────────────────────────────────

function InterestsTab({
  interests, toggle, onSave, saving,
}: {
  interests: Record<string, string[]>;
  toggle: (cat: string, item: string) => void;
  onSave: () => void; saving: boolean;
}) {
  return (
    <>
      {Object.entries(INTERESTS_CONFIG).map(([category, items]) => (
        <SubSection key={category} title={category}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {items.map((item) => {
              const selected = interests[category]?.includes(item);
              return (
                <button
                  key={item}
                  onClick={() => toggle(category, item)}
                  style={{
                    fontFamily: "var(--font-poppins, sans-serif)",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    padding: "8px 16px",
                    borderRadius: 99,
                    border: selected ? "none" : "1px solid rgba(220,30,60,0.2)",
                    background: selected
                      ? "linear-gradient(135deg,#dc1e3c,#a0153c)"
                      : "#fff",
                    color: selected ? "#fff" : "#888",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: selected ? "0 2px 8px rgba(220,30,60,0.25)" : "none",
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </SubSection>
      ))}
      <SaveButton onSave={onSave} saving={saving} label="Save Interests" />
    </>
  );
}

// ─── TAB 5: Partner Preferences ────────────────────────────────────────────────

function PartnerTab({
  form, update, onSave, saving,
}: {
  form: Record<string, string>;
  update: (f: string, v: string) => void;
  onSave: () => void; saving: boolean;
}) {
  return (
    <>
      <SubSection title="Age & Physical Preferences">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Field label="Age From">
            <FInput type="number" value={form.ageFrom} onChange={(v) => update("ageFrom", v)} placeholder="e.g. 24" />
          </Field>
          <Field label="Age To">
            <FInput type="number" value={form.ageTo} onChange={(v) => update("ageTo", v)} placeholder="e.g. 32" />
          </Field>
          <Field label="Height From">
            <FSelect value={form.heightFrom} onChange={(v) => update("heightFrom", v)} placeholder="Min height">
              {HEIGHTS.map((h) => <option key={h} value={h}>{h}</option>)}
            </FSelect>
          </Field>
          <Field label="Height To">
            <FSelect value={form.heightTo} onChange={(v) => update("heightTo", v)} placeholder="Max height">
              {HEIGHTS.map((h) => <option key={h} value={h}>{h}</option>)}
            </FSelect>
          </Field>
        </div>
        <TwoCol style={{ marginTop: 16 }}>
          <Field label="Marital Status" required>
            <FSelect value={form.maritalStatus} onChange={(v) => update("maritalStatus", v)} placeholder="Any">
              {["Any","Never Married","Divorced","Widowed"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Diet Preference">
            <FSelect value={form.diet} onChange={(v) => update("diet", v)} placeholder="Any">
              {["Any","Vegetarian","Non-Vegetarian","Eggetarian","Vegan"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>
      </SubSection>

      <SubSection title="Background Preferences">
        <TwoCol>
          <Field label="Religion Preference">
            <FSelect value={form.religionPref} onChange={(v) => update("religionPref", v)} placeholder="Any">
              {["Any","Hindu","Christian","Sikh","Jain","Buddhist","Muslim"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Mother Tongue" required>
            <FSelect value={form.motherTongue} onChange={(v) => update("motherTongue", v)} placeholder="Any">
              {["Any","Malayalam","Tamil","Telugu","Kannada","Hindi","English"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Denomination / Caste" required>
            <FInput value={form.denomination} onChange={(v) => update("denomination", v)} placeholder="Any or specify, e.g. Nair" />
          </Field>
          <Field label="Education">
            <FSelect value={form.education} onChange={(v) => update("education", v)} placeholder="Any">
              {["Any", "High School", "Diploma", "Graduate / Bachelor's", "Post Graduate / Master's", "Doctorate / PhD", "Professional Degree (MBBS / LLB / CA)", "Trade / Vocational"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Occupation" required>
            <FInput value={form.occupation} onChange={(v) => update("occupation", v)} placeholder="e.g. Software / Doctor / Business" />
          </Field>
          <Field label="Country Preference">
            <FSelect value={form.country} onChange={(v) => update("country", v)} placeholder="Any">
              {["Any", ...COUNTRIES].map((c) => <option key={c} value={c}>{c}</option>)}
            </FSelect>
          </Field>
          <Field label="Residential Status" required>
            <FSelect value={form.residentialStatus} onChange={(v) => update("residentialStatus", v)} placeholder="Any">
              {["Any","Citizen","Permanent Resident","Work Permit","Student Visa"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>
      </SubSection>

      <SubSection title="Partner Description">
        <Field label="About My Ideal Partner">
          <FTextarea
            value={form.aboutPartner}
            onChange={(v) => update("aboutPartner", v)}
            placeholder="Describe the kind of person you're looking for, their values, personality, and what matters most to you in a life partner..."
            rows={4}
          />
        </Field>
      </SubSection>

      <SaveButton onSave={onSave} saving={saving} label="Save Partner Preferences" />
    </>
  );
}

// ─── TAB 6: Contact Details ────────────────────────────────────────────────────

function ContactTab({
  form, update, onSave, saving,
}: {
  form: Record<string, string>;
  update: (f: string, v: string) => void;
  onSave: () => void; saving: boolean;
}) {
  return (
    <>
      <SubSection title="Phone & Contact">
        <TwoCol>
          <Field label="Mobile Number" required>
            <div style={{ display: "flex", gap: 8 }}>
              <FSelect
                value={form.countryCode}
                onChange={(v) => update("countryCode", v)}
                placeholder="+44"
                extraStyle={{ width: 90, flexShrink: 0 }}
              >
                {["+44","+91","+971","+1","+61","+65","+49","+33","+31"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </FSelect>
              <FInput value={form.mobile} onChange={(v) => update("mobile", v)} placeholder="e.g. 7700 900 123" />
            </div>
          </Field>
          <Field label="Alternate Phone">
            <FInput value={form.altPhone} onChange={(v) => update("altPhone", v)} placeholder="e.g. +91 98765 43210" />
          </Field>
          <Field label="Preferred Contact Method">
            <FSelect value={form.preferredContact} onChange={(v) => update("preferredContact", v)} placeholder="Select">
              {["Mobile","Email","WhatsApp"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
          <Field label="Best Time to Call">
            <FSelect value={form.bestTimeToCall} onChange={(v) => update("bestTimeToCall", v)} placeholder="Select">
              {["Morning","Afternoon","Evening","Anytime"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>
      </SubSection>

      <SubSection title="Contact Person">
        <TwoCol>
          <Field label="Contact Person Name" required>
            <FInput value={form.contactPersonName} onChange={(v) => update("contactPersonName", v)} placeholder="e.g. Rajan Menon" />
          </Field>
          <Field label="Relationship to Profile">
            <FSelect value={form.contactRelationship} onChange={(v) => update("contactRelationship", v)} placeholder="Select">
              {["Self","Parent","Sibling","Relative","Friend"].map((o) => <option key={o} value={o}>{o}</option>)}
            </FSelect>
          </Field>
        </TwoCol>
      </SubSection>

      <SubSection title="Address">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Address Line 1" required>
            <FInput value={form.address1} onChange={(v) => update("address1", v)} placeholder="e.g. 12 Maple Road" />
          </Field>
          <Field label="Address Line 2">
            <FInput value={form.address2} onChange={(v) => update("address2", v)} placeholder="Flat / Apartment / Area" />
          </Field>
          <TwoCol>
            <Field label="City" required>
              <FInput value={form.city} onChange={(v) => update("city", v)} placeholder="e.g. Birmingham" />
            </Field>
            <Field label="Postcode" required>
              <FInput value={form.postcode} onChange={(v) => update("postcode", v)} placeholder="e.g. B1 1AA" />
            </Field>
            <Field label="Country" required>
              <FSelect value={form.country} onChange={(v) => update("country", v)} placeholder="Select country">
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </FSelect>
            </Field>
          </TwoCol>
        </div>
      </SubSection>

      <SaveButton onSave={onSave} saving={saving} label="Save Contact Details" />
    </>
  );
}

// ─── Shared UI Components ──────────────────────────────────────────────────────

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      ...CARD_STYLE,
      display: "flex",
      flexDirection: "column",
      gap: 0,
    }}>
      <h3 style={{
        fontFamily: "var(--font-playfair, serif)",
        fontSize: "1.0625rem",
        fontWeight: 600,
        color: "#1a0a14",
        marginBottom: "1.25rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid rgba(220,30,60,0.07)",
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function TwoCol({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      gap: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={LABEL_STYLE}>
        {label}
        {required && <span style={{ color: "#dc1e3c", marginLeft: 3, fontWeight: 700 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function FInput({
  value, onChange, placeholder, type,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type || "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...BASE_INPUT,
        borderColor: focused ? "rgba(220,30,60,0.4)" : "rgba(220,30,60,0.15)",
        boxShadow: focused ? "0 0 0 3px rgba(220,30,60,0.08)" : "none",
      }}
    />
  );
}

function FSelect({
  value, onChange, placeholder, children, extraStyle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  children: React.ReactNode;
  extraStyle?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative", ...extraStyle }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...BASE_INPUT,
          appearance: "none",
          WebkitAppearance: "none",
          paddingRight: 36,
          borderColor: focused ? "rgba(220,30,60,0.4)" : "rgba(220,30,60,0.15)",
          boxShadow: focused ? "0 0 0 3px rgba(220,30,60,0.08)" : "none",
          cursor: "pointer",
          width: "100%",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      {/* Custom arrow */}
      <div style={{
        position: "absolute",
        right: 12,
        top: "50%",
        transform: "translateY(-50%)",
        pointerEvents: "none",
        color: "rgba(220,30,60,0.5)",
      }}>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

function FTextarea({
  value, onChange, placeholder, rows,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows || 3}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...BASE_INPUT,
        resize: "vertical",
        lineHeight: 1.6,
        borderColor: focused ? "rgba(220,30,60,0.4)" : "rgba(220,30,60,0.15)",
        boxShadow: focused ? "0 0 0 3px rgba(220,30,60,0.08)" : "none",
      }}
    />
  );
}

function RepRow({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div style={{
      position: "relative",
      background: "rgba(220,30,60,0.025)",
      border: "1px solid rgba(220,30,60,0.08)",
      borderRadius: 12,
      padding: "14px 14px 14px 14px",
      marginBottom: 10,
    }}>
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "none",
            background: "rgba(220,30,60,0.1)",
            color: "#dc1e3c",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
            padding: 0,
          }}
          title="Remove"
        >
          <X size={12} />
        </button>
      )}
      {children}
    </div>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-poppins, sans-serif)",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: "#dc1e3c",
        background: hovered ? "rgba(220,30,60,0.06)" : "transparent",
        border: "1px solid rgba(220,30,60,0.3)",
        borderRadius: 8,
        padding: "7px 14px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        marginTop: 4,
      }}
    >
      <Plus size={14} />
      Add Another
    </button>
  );
}

function SaveButton({
  onSave, saving, label,
}: {
  onSave: () => void;
  saving: boolean;
  label: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onSave}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        padding: "15px 24px",
        fontFamily: "var(--font-poppins, sans-serif)",
        fontSize: "0.9375rem",
        fontWeight: 600,
        color: "#fff",
        background: saving
          ? "linear-gradient(135deg,#22c55e,#16a34a)"
          : hovered
          ? "linear-gradient(135deg,#b91c37,#881230)"
          : "linear-gradient(135deg,#dc1e3c,#a0153c)",
        border: "none",
        borderRadius: 10,
        boxShadow: saving
          ? "0 4px 16px rgba(34,197,94,0.3)"
          : "0 4px 16px rgba(220,30,60,0.25)",
        cursor: "pointer",
        transition: "all 0.25s ease",
        transform: hovered && !saving ? "translateY(-1px)" : "none",
        marginTop: 8,
      }}
    >
      {saving ? "✓  Saved!" : label}
    </button>
  );
}

// ─── Left Sidebar Components ───────────────────────────────────────────────────

// ─── Photos Tab ──────────────────────────────────────────────────────────────

function PhotosTab() {
  const [photos, setPhotos] = useState<{ id: string; url: string; path: string; isPrimary: boolean }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing photos from backend profile
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<{ success: boolean; data: { photos?: { url: string; key: string; is_primary?: boolean }[] } }>("/api/v1/profile/me");
        const list = data?.data?.photos || [];
        setPhotos(list.map((p) => ({ id: p.key, url: p.url, path: p.key, isPrimary: !!p.is_primary })));
      } catch (err) {
        console.warn("Failed to load photos", err);
      }
    })();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);

    const toUpload = Array.from(files).slice(0, 6 - photos.length);
    const uploaded: typeof photos = [];

    for (const file of toUpload) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 5 * 1024 * 1024) { setUploadError("Each photo must be under 5MB."); continue; }

      try {
        // 1. Get signed Cloudinary params from backend
        const sig = await api.post<{ success: boolean; data: { upload_url: string; api_key: string; timestamp: number; signature: string; folder: string; public_id: string; resource_type: string; url: string; key: string } }>(
          `/api/v1/profile/photos/upload-url?content_type=${encodeURIComponent(file.type)}`
        );
        const params = sig.data.data;

        // 2. POST multipart to Cloudinary
        const form = new FormData();
        form.append("file", file);
        form.append("api_key", params.api_key);
        form.append("timestamp", String(params.timestamp));
        form.append("signature", params.signature);
        form.append("folder", params.folder);
        form.append("public_id", params.public_id);
        form.append("overwrite", "false");

        const cldRes = await fetch(params.upload_url, { method: "POST", body: form });
        if (!cldRes.ok) {
          const txt = await cldRes.text();
          throw new Error(`Cloudinary upload failed: ${txt}`);
        }
        const cld = await cldRes.json() as { secure_url: string; public_id: string };

        // 3. Save to backend profile
        await api.post("/api/v1/profile/me/photos", { url: cld.secure_url, key: cld.public_id });

        uploaded.push({ id: cld.public_id, url: cld.secure_url, path: cld.public_id, isPrimary: photos.length === 0 && uploaded.length === 0 });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      }
    }

    setPhotos((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const makePrimary = async (id: string) => {
    try {
      await api.post("/api/v1/profile/me/photos/primary", { key: id });
      setPhotos((prev) => prev.map((p) => ({ ...p, isPrimary: p.id === id })));
    } catch (err) {
      console.warn("Failed to set primary", err);
    }
  };

  const removePhoto = async (id: string) => {
    try {
      await api.delete(`/api/v1/profile/me/photos?key=${encodeURIComponent(id)}`);
    } catch (err) {
      console.warn("Delete failed", err);
    }
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (filtered.length > 0 && !filtered.some((p) => p.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const remaining = 6 - photos.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
      <div>
        <h3 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "1.1rem", fontWeight: 700, color: "#1a0a14", marginBottom: 6 }}>
          My Photos
        </h3>
        <p style={{ fontSize: "0.8125rem", color: "#888", fontFamily: "var(--font-poppins, sans-serif)" }}>
          Upload up to 6 photos. Your primary photo appears on your profile card.
          Profiles with photos get <strong style={{ color: "#dc1e3c" }}>8× more responses</strong>.
        </p>
        {uploadError && (
          <p style={{ fontSize: 12, color: "#dc1e3c", marginTop: 6 }}>⚠️ {uploadError}</p>
        )}
      </div>

      {/* Upload zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragOver ? "#dc1e3c" : "rgba(220,30,60,0.25)"}`,
          borderRadius: 16,
          padding: "40px 24px",
          textAlign: "center",
          cursor: remaining === 0 ? "not-allowed" : "pointer",
          background: dragOver ? "rgba(220,30,60,0.04)" : "#fdfbf9",
          transition: "all 0.2s",
          opacity: remaining === 0 ? 0.5 : 1,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={remaining === 0}
        />
        <div style={{ marginBottom: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(220,30,60,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            <Upload style={{ width: 24, height: 24, color: "#dc1e3c" }} />
          </div>
          <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontWeight: 600, fontSize: "0.9375rem", color: "#1a0a14", marginBottom: 4 }}>
            {uploading ? "Uploading…" : remaining === 0 ? "Photo limit reached" : "Drop photos here or click to browse"}
          </p>
          <p style={{ fontSize: "0.8125rem", color: "#aaa" }}>
            JPG, PNG, WebP · Max 5MB each · {remaining} slot{remaining !== 1 ? "s" : ""} remaining
          </p>
        </div>
        {!uploading && remaining > 0 && (
          <button style={{
            padding: "10px 24px", borderRadius: 8, fontSize: "0.875rem", fontWeight: 600,
            background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff",
            border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(220,30,60,0.25)",
          }}>
            Select Photos
          </button>
        )}
      </div>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div>
          <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.8125rem", fontWeight: 600, color: "#555", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Your Photos ({photos.length}/6)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {photos.map((photo) => (
              <div key={photo.id} style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1", boxShadow: photo.isPrimary ? "0 0 0 3px #dc1e3c" : "0 2px 10px rgba(0,0,0,0.1)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Profile photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                {/* Primary badge */}
                {photo.isPrimary && (
                  <div style={{ position: "absolute", top: 8, left: 8, background: "#dc1e3c", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>
                    PRIMARY
                  </div>
                )}

                {/* Actions overlay */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0)", transition: "background 0.2s",
                  display: "flex", alignItems: "flex-end", justifyContent: "center",
                  gap: 8, padding: 10,
                }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.45)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0)"}
                >
                  {!photo.isPrimary && (
                    <button
                      onClick={() => makePrimary(photo.id)}
                      style={{ padding: "5px 10px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "rgba(255,255,255,0.9)", color: "#dc1e3c", border: "none", cursor: "pointer" }}
                    >
                      Set Primary
                    </button>
                  )}
                  <button
                    onClick={() => removePhoto(photo.id)}
                    style={{ padding: "5px 10px", borderRadius: 6, fontSize: "11px", fontWeight: 600, background: "rgba(220,30,60,0.85)", color: "#fff", border: "none", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: remaining }).map((_, i) => (
              <div
                key={`empty-${i}`}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  aspectRatio: "1", borderRadius: 12, border: "1.5px dashed rgba(220,30,60,0.18)",
                  background: "#fdfbf9", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
                }}
              >
                <Camera style={{ width: 22, height: 22, color: "rgba(220,30,60,0.3)" }} />
                <span style={{ fontSize: "11px", color: "#ccc", fontFamily: "var(--font-poppins, sans-serif)" }}>Add Photo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy note */}
      <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(220,30,60,0.04)", border: "1px solid rgba(220,30,60,0.1)", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Shield style={{ width: 16, height: 16, color: "#dc1e3c", flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.8125rem", fontWeight: 600, color: "#1a0a14", marginBottom: 2 }}>Privacy Protected</p>
          <p style={{ fontSize: "0.75rem", color: "#888" }}>Your photos are only visible to verified members. You can set any photo as your primary profile picture.</p>
        </div>
      </div>

      {/* Save button */}
      {photos.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button style={{
            padding: "12px 32px", borderRadius: 10, fontSize: "0.9375rem", fontWeight: 600,
            background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff",
            border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(220,30,60,0.3)",
          }}>
            Save Photos
          </button>
        </div>
      )}
    </div>
  );
}

function PhotoCard({ name }: { name: string }) {
  const [hovered, setHovered] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <div style={{
      borderRadius: 16,
      overflow: "hidden",
      border: "1px solid rgba(220,30,60,0.08)",
      boxShadow: "0 2px 16px rgba(220,30,60,0.06)",
      background: "#fff",
    }}>
      <div
        style={{
          height: 220,
          background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          cursor: "pointer",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.18)",
          border: "2.5px solid rgba(255,255,255,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}>
          <span style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: "2rem",
            fontWeight: 400,
            color: "#fff",
          }}>
            {initials || "?"}
          </span>
        </div>
        {hovered && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 8,
          }}>
            <Camera style={{ width: 22, height: 22, color: "#fff" }} />
            <span style={{
              fontFamily: "var(--font-poppins, sans-serif)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#fff",
            }}>
              Change Photo
            </span>
          </div>
        )}
      </div>
      <div style={{ padding: "0.875rem 1rem" }}>
        <p style={{
          fontFamily: "var(--font-playfair, serif)",
          fontSize: "1.0625rem",
          fontWeight: 600,
          color: "#1a0a14",
        }}>
          {name}
        </p>
        <p style={{
          fontFamily: "var(--font-poppins, sans-serif)",
          fontSize: "0.8125rem",
          color: "#888",
          marginTop: 2,
        }}>
          Edit your profile below →
        </p>
      </div>
    </div>
  );
}

function TrustScoreCard({ score }: { score: number }) {
  return (
    <div style={{ ...CARD_STYLE }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "0.75rem",
      }}>
        <span style={{
          fontFamily: "var(--font-poppins, sans-serif)",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "#1a0a14",
        }}>
          Trust Score
        </span>
        <span style={{
          fontFamily: "var(--font-playfair, serif)",
          fontSize: "1.75rem",
          fontWeight: 700,
          color: "#dc1e3c",
        }}>
          {score}
        </span>
      </div>
      <div style={{
        height: 6,
        background: "rgba(26,10,20,0.06)",
        borderRadius: 99,
        overflow: "hidden",
        marginBottom: "0.75rem",
      }}>
        <div style={{
          height: "100%",
          borderRadius: 99,
          width: `${score}%`,
          background: "linear-gradient(90deg,#dc1e3c,#a0153c)",
          transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {VERIFICATIONS.map((v) => (
          <div key={v.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {v.done
              ? <CheckCircle style={{ width: 15, height: 15, color: "#dc1e3c", flexShrink: 0 }} />
              : <AlertCircle style={{ width: 15, height: 15, color: "rgba(26,10,20,0.18)", flexShrink: 0 }} />
            }
            <span style={{
              flex: 1,
              fontFamily: "var(--font-poppins, sans-serif)",
              fontSize: "0.75rem",
              color: v.done ? "rgba(26,10,20,0.7)" : "rgba(26,10,20,0.35)",
            }}>
              {v.label}
            </span>
            <span style={{
              fontFamily: "var(--font-poppins, sans-serif)",
              fontSize: "0.7rem",
              fontWeight: 700,
              color: v.done ? "#dc1e3c" : "rgba(26,10,20,0.18)",
            }}>
              +{v.pts}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletenessCard({ completeness }: { completeness: number }) {
  return (
    <div style={{ ...CARD_STYLE }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "0.5rem",
      }}>
        <span style={{
          fontFamily: "var(--font-poppins, sans-serif)",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "#1a0a14",
        }}>
          Profile Complete
        </span>
        <span style={{
          fontFamily: "var(--font-playfair, serif)",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#C89020",
        }}>
          {completeness}%
        </span>
      </div>
      <div style={{
        height: 6,
        background: "rgba(26,10,20,0.06)",
        borderRadius: 99,
        overflow: "hidden",
        marginBottom: "0.5rem",
      }}>
        <div style={{
          height: "100%",
          borderRadius: 99,
          width: `${completeness}%`,
          background: "linear-gradient(90deg,#dc1e3c,#C89020)",
          transition: "width 0.5s ease",
        }} />
      </div>
      <p style={{
        fontFamily: "var(--font-poppins, sans-serif)",
        fontSize: "0.75rem",
        color: "#888",
        lineHeight: 1.5,
      }}>
        Complete all sections to unlock +28 trust points and 3× more profile views.
      </p>
    </div>
  );
}
