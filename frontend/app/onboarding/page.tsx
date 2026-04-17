"use client";

/**
 * Onboarding — 3-step sign-up optimised for UK-Indian matrimony market.
 *
 *   Step 1: Create account  — Email + password + full name.
 *                             Firebase createUserWithEmailAndPassword.
 *   Step 2: About you       — DOB, gender, religion, caste, mother tongue,
 *                             country, education, profession + phone OTP.
 *                             Phone is linked to the existing user via
 *                             linkWithCredential (same Firebase UID,
 *                             multiple auth providers).
 *   Step 3: Verify identity — Unchanged ID upload step.
 *
 * After completion the user has both email/password AND phone auth on
 * the same Firebase account. They can sign in with either on /auth/login.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, User as UserIcon, Phone, Shield, Mail, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, Check, AlertCircle, Loader2, Upload,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithCredential,
  PhoneAuthProvider,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile as updateFirebaseProfile,
  type ConfirmationResult,
} from "firebase/auth";
import { firebaseAuth, rememberSessionUid } from "@/lib/firebase";
import { api } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Create account",  icon: UserIcon, hint: "Start with your email & password"       },
  { id: 2, label: "About you",       icon: Phone,    hint: "Profile basics + phone verification"     },
  { id: 3, label: "Verify identity", icon: Shield,   hint: "A moment of formality for everyone's safety" },
] as const;

const COUNTRY_CODES = [
  { code: "+44", flag: "🇬🇧", label: "UK" },
  { code: "+91", flag: "🇮🇳", label: "India" },
  { code: "+1",  flag: "🇺🇸", label: "US" },
  { code: "+1",  flag: "🇨🇦", label: "Canada" },
  { code: "+61", flag: "🇦🇺", label: "Australia" },
  { code: "+971", flag: "🇦🇪", label: "UAE" },
  { code: "+65", flag: "🇸🇬", label: "Singapore" },
] as const;

const COUNTRIES = [
  "United Kingdom", "India", "United States", "Canada", "Australia",
  "UAE", "Singapore", "New Zealand", "South Africa", "Germany",
  "Netherlands", "France", "Ireland", "Malaysia", "Kenya", "Other",
];

const RELIGION_OPTIONS = [
  "Hindu", "Muslim", "Christian", "Sikh", "Jain", "Buddhist",
  "Parsi / Zoroastrian", "Jewish", "No Religion", "Other",
];
const RELIGION_MAP: Record<string, string> = {
  "Hindu": "hindu", "Muslim": "muslim", "Christian": "christian",
  "Sikh": "sikh", "Jain": "jain", "Buddhist": "buddhist",
  "Parsi / Zoroastrian": "parsi", "Jewish": "jewish",
  "No Religion": "other", "Other": "other",
};

const MOTHER_TONGUE_OPTIONS = [
  "Tamil", "Hindi", "Telugu", "Kannada", "Malayalam", "Marathi",
  "Bengali", "Gujarati", "Punjabi", "Urdu", "Sindhi", "Odia",
  "Konkani", "Tulu", "Sinhala", "English", "Other",
];

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => { setMounted(true); }, []);

  // Auth guard: if signed in with profile, skip to dashboard; if signed in
  // without profile, start at step 2 (they have email but no phone/profile).
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) return;
      rememberSessionUid(user.uid);
      try {
        const res = await api.get("/api/v1/profile/me");
        const p = (res.data as any)?.data;
        if (p && p.first_name && String(p.first_name).trim()) {
          router.replace("/dashboard");
          return;
        }
      } catch { /* new user — stay on onboarding */ }
      // Signed in but no profile yet — they completed step 1 on a previous visit
      setStep(2);
    });
    return unsub;
  }, [router]);

  // Shared state passed down to each step
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  // ─── Step 1 (email + password) handler ─────────────────────────────────

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateAccount = useCallback(async (password: string) => {
    setLoading(true);
    setError("");
    try {
      // Guard: don't collide with an existing email
      const methods = await fetchSignInMethodsForEmail(firebaseAuth, email.trim());
      if (methods.length > 0) {
        setError("An account with this email already exists. Sign in instead.");
        setLoading(false);
        return false;
      }

      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      rememberSessionUid(cred.user.uid);

      // Best-effort: set display name on the Firebase user
      try {
        await updateFirebaseProfile(cred.user, { displayName: fullName.trim() });
      } catch { /* non-fatal */ }

      // Kick off email verification (non-blocking — we don't wait for them to click it)
      try { await sendEmailVerification(cred.user); } catch { /* non-fatal */ }

      // Save first/last name to our backend immediately
      const nameParts = fullName.trim().split(/\s+/);
      try {
        await api.patch("/api/v1/profile/me", {
          first_name: nameParts[0] || undefined,
          last_name: nameParts.slice(1).join(" ") || undefined,
        });
      } catch (e) {
        // Non-fatal — user still exists in Firebase; profile will be created on next request
        console.warn("Initial profile save failed:", e);
      }

      setStep(2);
      return true;
    } catch (e: any) {
      const code = e?.code || "";
      if (code.includes("email-already-in-use")) {
        setError("An account with this email already exists. Try signing in.");
      } else if (code.includes("weak-password")) {
        setError("Password is too weak. Use at least 8 characters.");
      } else if (code.includes("invalid-email")) {
        setError("Please enter a valid email address.");
      } else {
        setError(e?.message || "Could not create account.");
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [email, fullName]);

  // ─── Step 2 (profile + phone link) handler ─────────────────────────────

  const handleLinkPhoneAndSaveProfile = useCallback(async (payload: {
    dob: string; gender: string; religion: string; caste: string;
    country: string; motherTongue: string; education: string; profession: string;
    verificationId: string; otp: string;
  }) => {
    setLoading(true);
    setError("");
    try {
      const user = firebaseAuth.currentUser;
      if (!user) {
        setError("Session lost. Please sign in again.");
        setLoading(false);
        return false;
      }

      // 1. Link phone credential to the existing Firebase user
      const phoneCred = PhoneAuthProvider.credential(payload.verificationId, payload.otp.trim());
      try {
        await linkWithCredential(user, phoneCred);
      } catch (e: any) {
        const code = e?.code || "";
        if (code.includes("provider-already-linked")) {
          // Already linked — fine, continue
        } else if (code.includes("invalid-verification-code")) {
          setError("Incorrect code. Please try again.");
          setLoading(false);
          return false;
        } else if (code.includes("credential-already-in-use")) {
          setError("This phone number is already linked to another account.");
          setLoading(false);
          return false;
        } else {
          throw e;
        }
      }

      // 2. Refresh the token so the backend sees the new phone claim
      await user.getIdToken(true);

      // 3. Save profile basics
      await api.patch("/api/v1/profile/me", {
        date_of_birth: payload.dob || undefined,
        gender: payload.gender ? payload.gender.toLowerCase() : undefined,
        religion: payload.religion ? (RELIGION_MAP[payload.religion] || payload.religion.toLowerCase()) : undefined,
        caste: payload.caste || undefined,
        country: payload.country || undefined,
        mother_tongue: payload.motherTongue || undefined,
        education_level: payload.education || undefined,
        occupation: payload.profession || undefined,
      });

      setStep(3);
      return true;
    } catch (e: any) {
      setError(e?.message || "Could not save your profile. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Step 3 → finish ────────────────────────────────────────────────────

  const handleFinish = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await api.patch("/api/v1/profile/me", { visa_status: "id_uploaded" });
    } catch (e) {
      console.warn("ID verify persist failed:", e);
    } finally {
      localStorage.setItem("onboarding_completed", "true");
      localStorage.removeItem("onboarding_step");
      router.push("/dashboard");
    }
  }, [router]);

  const currentStep = STEPS[step - 1];

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(460px, 560px)",
      background: "#fdfbf9",
      overflow: "hidden",
      fontFamily: "var(--font-poppins, sans-serif)",
    }}
    className="m4m-onb-root"
    >
      <GlobalStyles />

      {/* ─── LEFT: editorial photograph + progress ─── */}
      <aside className="m4m-onb-hero" style={{
        position: "relative",
        overflow: "hidden",
        background: "#1a0a14",
      }}>
        <Image
          src="/couples/couple-hero.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 55vw"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(26,10,20,0.6) 0%, rgba(26,10,20,0.1) 35%, rgba(26,10,20,0.15) 60%, rgba(26,10,20,0.85) 100%)",
        }} />

        {/* Brand mark */}
        <Link href="/" style={{
          position: "absolute", top: 32, left: 32, zIndex: 2,
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "8px 12px 8px 10px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 999,
          backdropFilter: "blur(14px)",
          textDecoration: "none",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #ff4d79, #a0153c)",
            display: "grid", placeItems: "center",
          }}>
            <Heart style={{ width: 14, height: 14, color: "#fff" }} fill="#fff" />
          </div>
          <span style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.005em",
          }}>
            Match<span style={{ color: "#ffb9c8" }}>4</span>Marriage
          </span>
        </Link>

        {/* Bottom: step indicator + copy */}
        <div style={{
          position: "absolute", left: 48, right: 48, bottom: 52, zIndex: 2,
          color: "#fff",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.22em", textTransform: "uppercase",
            marginBottom: 14,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span>Step {step} of {STEPS.length}</span>
            <span style={{ width: 32, height: 1, background: "rgba(255,255,255,0.25)" }} />
            <span>{currentStep.label}</span>
          </div>
          <h1 style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: "clamp(36px, 4.2vw, 56px)",
            fontWeight: 500,
            lineHeight: 1.05,
            margin: 0,
            letterSpacing: "-0.026em",
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
          }}>
            {step === 1 && <>Create your account.</>}
            {step === 2 && <>Tell us about you.</>}
            {step === 3 && <>One last thing.</>}
          </h1>
          <p style={{
            fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.75)",
            marginTop: 14, maxWidth: 460,
          }}>
            {currentStep.hint}
          </p>

          {/* Progress bar */}
          <div style={{ display: "flex", gap: 6, marginTop: 34, maxWidth: 340 }}>
            {STEPS.map((s, i) => {
              const isDone = i + 1 < step;
              const isActive = i + 1 === step;
              return (
                <div key={s.id} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: isDone ? "#ffb9c8"
                    : isActive ? "linear-gradient(90deg, #ffb9c8, rgba(255,152,174,0.25))"
                    : "rgba(255,255,255,0.18)",
                  transition: "background 300ms ease",
                }} />
              );
            })}
          </div>
        </div>
      </aside>

      {/* ─── RIGHT: step card ─── */}
      <section className="m4m-onb-form" style={{
        display: "flex", flexDirection: "column",
        padding: "48px 52px",
        background: "#fdfbf9",
        overflowY: "auto",
        position: "relative",
      }}>
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="err"
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              style={{
                display: "flex", alignItems: "flex-start", gap: 9,
                background: "rgba(220,30,60,0.06)",
                color: "#a0153c", fontSize: 13,
                padding: "12px 14px", borderRadius: 10,
                marginBottom: 18,
                border: "1px solid rgba(220,30,60,0.14)",
                overflow: "hidden",
              }}
            >
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <Step1CreateAccount
              key="s1"
              fullName={fullName} setFullName={setFullName}
              email={email} setEmail={setEmail}
              loading={loading}
              onSubmit={handleCreateAccount}
            />
          )}
          {step === 2 && (
            <Step2Profile
              key="s2"
              loading={loading}
              onSubmit={handleLinkPhoneAndSaveProfile}
              onBack={() => setStep(1)}
              setError={setError}
            />
          )}
          {step === 3 && (
            <Step3IdVerify
              key="s3"
              loading={loading}
              onSubmit={handleFinish}
              onBack={() => setStep(2)}
            />
          )}
        </AnimatePresence>

        <div style={{
          marginTop: "auto", paddingTop: 32,
          fontSize: 13, color: "#78686e", textAlign: "center",
        }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{
            color: "#dc1e3c", fontWeight: 600, textDecoration: "none",
          }}>
            Sign in →
          </Link>
        </div>
      </section>
    </div>
  );
}

// ─── STEP 1 ─────────────────────────────────────────────────────────────────

function Step1CreateAccount({
  fullName, setFullName, email, setEmail, loading, onSubmit,
}: {
  fullName: string; setFullName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  loading: boolean;
  onSubmit: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const passwordStrength = useMemo(() => scorePassword(password), [password]);
  const canSubmit = fullName.trim().length >= 2
    && /^[^@]+@[^@]+\.[^@]+$/.test(email.trim())
    && password.length >= 8
    && !loading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <Eyebrow>Step 1 of 3</Eyebrow>
      <H2>Create your account</H2>
      <Sub>We&apos;ll use your email for important updates and as your primary sign-in.</Sub>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit(password);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}
      >
        <Field icon={UserIcon} label="Full name">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Priya Menon"
            autoComplete="name"
            required
            style={inputStyle}
          />
        </Field>

        <Field icon={Mail} label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            style={inputStyle}
          />
        </Field>

        <Field icon={Lock} label="Password">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
            style={{ ...inputStyle, paddingRight: 42 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={eyeBtnStyle}
          >
            {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
          </button>
        </Field>

        {password.length > 0 && <PasswordStrength score={passwordStrength} />}

        <SubmitBtn disabled={!canSubmit} loading={loading}>
          Continue to profile
        </SubmitBtn>
      </form>

      <p style={{
        fontSize: 11.5, color: "#999", marginTop: 20, textAlign: "center", lineHeight: 1.6,
      }}>
        By continuing you agree to our{" "}
        <Link href="/terms" style={linkStyle}>Terms</Link> and{" "}
        <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>.
      </p>
    </motion.div>
  );
}

function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}

function PasswordStrength({ score }: { score: number }) {
  const labels = ["Weak", "Weak", "Okay", "Strong", "Excellent"];
  const colors = ["#dc1e3c", "#dc1e3c", "#c89020", "#5c7a52", "#3f5937"];
  return (
    <div style={{ marginTop: -6 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < score ? colors[score] : "rgba(0,0,0,0.07)",
            transition: "background 200ms",
          }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#777", marginTop: 6 }}>
        Password strength: <strong style={{ color: colors[score] }}>{labels[score]}</strong>
      </div>
    </div>
  );
}

// ─── STEP 2 ─────────────────────────────────────────────────────────────────

type OtpState = "idle" | "sending" | "sent" | "verifying";

function Step2Profile({
  loading, onSubmit, onBack, setError,
}: {
  loading: boolean;
  onSubmit: (p: {
    dob: string; gender: string; religion: string; caste: string;
    country: string; motherTongue: string; education: string; profession: string;
    verificationId: string; otp: string;
  }) => Promise<boolean>;
  onBack: () => void;
  setError: (s: string) => void;
}) {
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [religion, setReligion] = useState("");
  const [caste, setCaste] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [motherTongue, setMotherTongue] = useState("");
  const [education, setEducation] = useState("");
  const [profession, setProfession] = useState("");

  const [countryCode, setCountryCode] = useState("+44");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpState, setOtpState] = useState<OtpState>("idle");
  const verificationIdRef = useRef<string | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const ensureRecaptcha = useCallback(() => {
    if (recaptchaRef.current) return recaptchaRef.current;
    const v = new RecaptchaVerifier(firebaseAuth, "recaptcha-onboarding", { size: "invisible" });
    recaptchaRef.current = v;
    return v;
  }, []);

  const canSendOtp = dob && gender && religion && caste.trim() && motherTongue && education.trim() && profession.trim()
    && phone.replace(/\D/g, "").length >= 6;

  const handleSendOtp = async () => {
    setError("");
    setOtpState("sending");
    try {
      const full = `${countryCode}${phone.replace(/\D/g, "")}`;
      const confirm: ConfirmationResult = await signInWithPhoneNumber(firebaseAuth, full, ensureRecaptcha());
      verificationIdRef.current = confirm.verificationId;
      setOtpState("sent");
    } catch (e: any) {
      const code = e?.code || "";
      if (code.includes("invalid-phone-number")) setError("That phone number doesn't look right.");
      else if (code.includes("too-many-requests")) setError("Too many attempts. Try again in a few minutes.");
      else if (code.includes("quota-exceeded")) setError("SMS quota exhausted. Please try again later.");
      else setError(e?.message || "Could not send code. Please try again.");
      setOtpState("idle");
    }
  };

  const canSubmit = otpState === "sent" && verificationIdRef.current && otp.replace(/\D/g, "").length === 6 && !loading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div id="recaptcha-onboarding" />

      <Eyebrow>Step 2 of 3</Eyebrow>
      <H2>About you</H2>
      <Sub>Core details that help us find meaningful matches.</Sub>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canSubmit || !verificationIdRef.current) return;
          setOtpState("verifying");
          const ok = await onSubmit({
            dob, gender, religion, caste, country,
            motherTongue, education, profession,
            verificationId: verificationIdRef.current, otp,
          });
          if (!ok) setOtpState("sent");
        }}
        style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}
      >
        <Row>
          <Field label="Date of birth">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required style={inputStyle} />
          </Field>
          <Field label="Gender">
            <Segmented
              value={gender}
              onChange={setGender}
              options={["Male", "Female", "Other"]}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Religion">
            <select value={religion} onChange={(e) => setReligion(e.target.value)} required style={selectStyle}>
              <option value="">Select religion</option>
              {RELIGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Caste / community">
            <input
              type="text" value={caste} onChange={(e) => setCaste(e.target.value)}
              placeholder="e.g. Nair, Iyer" required style={inputStyle}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Country">
            <select value={country} onChange={(e) => setCountry(e.target.value)} required style={selectStyle}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Mother tongue">
            <select value={motherTongue} onChange={(e) => setMotherTongue(e.target.value)} required style={selectStyle}>
              <option value="">Select language</option>
              {MOTHER_TONGUE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </Row>

        <Row>
          <Field label="Education">
            <input
              type="text" value={education} onChange={(e) => setEducation(e.target.value)}
              placeholder="e.g. BSc Computer Science" required style={inputStyle}
            />
          </Field>
          <Field label="Profession">
            <input
              type="text" value={profession} onChange={(e) => setProfession(e.target.value)}
              placeholder="e.g. Software Engineer" required style={inputStyle}
            />
          </Field>
        </Row>

        <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "8px 0" }} />

        <Field icon={Phone} label="Mobile number (for SMS verification)">
          <div style={phoneShell}>
            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} style={countrySelectStyle}>
              {COUNTRY_CODES.map((c, i) => (
                <option key={`${c.code}-${i}`} value={c.code}>{c.flag} {c.code}</option>
              ))}
            </select>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
              placeholder="7700 900000"
              autoComplete="tel"
              style={phoneNumberInputStyle}
              disabled={otpState === "sent"}
            />
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={!canSendOtp || otpState === "sending" || otpState === "sent"}
              style={sendOtpBtnStyle(otpState === "sent")}
            >
              {otpState === "sending" ? "Sending…" : otpState === "sent" ? "Sent ✓" : "Send code"}
            </button>
          </div>
        </Field>

        <AnimatePresence>
          {otpState === "sent" && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: "hidden" }}
            >
              <Field label="6-digit code from SMS">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  autoComplete="one-time-code"
                  style={otpInputStyle}
                />
              </Field>
              <button
                type="button"
                onClick={() => { setOtpState("idle"); setOtp(""); verificationIdRef.current = null; }}
                style={resendBtnStyle}
              >
                Resend to a different number
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={onBack}
            style={backBtnStyle}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> Back
          </button>
          <SubmitBtn disabled={!canSubmit} loading={loading || otpState === "verifying"} grow>
            Continue
          </SubmitBtn>
        </div>
      </form>
    </motion.div>
  );
}

// ─── STEP 3 ─────────────────────────────────────────────────────────────────

const DOCUMENTS_BY_COUNTRY: Record<string, string[]> = {
  "United Kingdom":  ["Passport", "UK Driving Licence", "BRP", "National ID"],
  "India":           ["Passport", "Driving Licence", "Voter ID", "Aadhaar (masked)"],
  "United States":   ["Passport", "US Driver's License", "State ID"],
  "Other":           ["Passport", "National ID", "Driving Licence"],
};

function Step3IdVerify({
  loading, onSubmit, onBack,
}: {
  loading: boolean; onSubmit: () => void; onBack: () => void;
}) {
  const [docCountry, setDocCountry] = useState("United Kingdom");
  const [docType, setDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const needsBack = docType && docType !== "Passport";
  const [backFile, setBackFile] = useState<File | null>(null);

  const available = DOCUMENTS_BY_COUNTRY[docCountry] || DOCUMENTS_BY_COUNTRY["Other"];
  const canSubmit = docCountry && docType && docNumber.trim() && frontFile && selfieFile && (!needsBack || backFile) && !loading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <Eyebrow>Step 3 of 3</Eyebrow>
      <H2>Verify your identity</H2>
      <Sub>Shared only with our review team — never with matches. Encrypted at rest.</Sub>

      <div style={{
        marginTop: 20, padding: "14px 16px",
        background: "rgba(92,122,82,0.06)",
        border: "1px solid rgba(92,122,82,0.18)",
        borderRadius: 12,
        display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#3F5937",
      }}>
        <Shield style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
        <div style={{ lineHeight: 1.55 }}>
          <strong>Your data is protected.</strong> ID documents are encrypted and only visible to our
          verification team. Only your verified ✓ status is shown on your profile.
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (canSubmit) onSubmit(); }}
        style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}
      >
        <Row>
          <Field label="Country">
            <select value={docCountry} onChange={(e) => { setDocCountry(e.target.value); setDocType(""); }} style={selectStyle}>
              {Object.keys(DOCUMENTS_BY_COUNTRY).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Document type">
            <select value={docType} onChange={(e) => setDocType(e.target.value)} required style={selectStyle}>
              <option value="">Select</option>
              {available.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </Row>

        <Field label="Document number">
          <input
            type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)}
            placeholder="Enter number" required style={inputStyle}
          />
        </Field>

        <UploadBox label="Front of document" file={frontFile} onChange={setFrontFile} />
        {needsBack && <UploadBox label="Back of document" file={backFile} onChange={setBackFile} />}
        <UploadBox label="Selfie holding your document" file={selfieFile} onChange={setSelfieFile} />

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onBack} style={backBtnStyle}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> Back
          </button>
          <SubmitBtn disabled={!canSubmit} loading={loading} grow>
            Finish &amp; go to dashboard
          </SubmitBtn>
        </div>
      </form>
    </motion.div>
  );
}

function UploadBox({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7 }}>{label}</div>
      <label style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        padding: "20px 16px",
        border: file ? "1.5px solid rgba(92,122,82,0.4)" : "1.5px dashed rgba(220,30,60,0.2)",
        borderRadius: 12,
        background: file ? "rgba(92,122,82,0.04)" : "#fff",
        cursor: "pointer",
        transition: "border-color 180ms, background 180ms",
      }}>
        <input
          type="file" accept="image/*,.pdf"
          style={{ display: "none" }}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
        <Upload style={{ width: 20, height: 20, color: file ? "#5C7A52" : "rgba(220,30,60,0.35)" }} />
        {file ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#3F5937" }}>{file.name}</div>
            <div style={{ fontSize: 11, color: "#5C7A52" }}>Click to change</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#555" }}>Click to upload</div>
            <div style={{ fontSize: 11, color: "#999" }}>JPG, PNG or PDF · Max 10MB</div>
          </>
        )}
      </label>
    </div>
  );
}

// ─── Shared tiny components ─────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "4px 10px 4px 8px",
      background: "rgba(220,30,60,0.055)",
      border: "1px solid rgba(220,30,60,0.12)",
      borderRadius: 999,
      marginBottom: 16,
    }}>
      <Heart style={{ width: 10, height: 10, color: "#dc1e3c" }} fill="#dc1e3c" />
      <span style={{
        fontSize: 9.5, fontWeight: 700, color: "#a0153c",
        letterSpacing: "0.14em", textTransform: "uppercase",
      }}>{children}</span>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{
      fontFamily: "var(--font-playfair, serif)",
      fontSize: 36, fontWeight: 500, color: "#1a0a14",
      margin: 0, letterSpacing: "-0.022em", lineHeight: 1.1,
    }}>{children}</h1>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 14.5, color: "#78686e",
      margin: "10px 0 0", lineHeight: 1.55,
    }}>{children}</p>
  );
}

function Field({ icon: Icon, label, children }: {
  icon?: any; label: string; children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", position: "relative", flex: 1 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: "#555",
        textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 7,
      }}>{label}</div>
      <div style={{ position: "relative" }}>
        {Icon && (
          <Icon style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            width: 15, height: 15, color: "#bbb", pointerEvents: "none", zIndex: 1,
          }} />
        )}
        {children}
      </div>
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="m4m-onb-row" style={{ display: "flex", gap: 12 }}>{children}</div>;
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{
      display: "flex", padding: 3,
      background: "rgba(220,30,60,0.03)",
      border: "1px solid rgba(26,10,20,0.1)",
      borderRadius: 12,
    }}>
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={{
              position: "relative", flex: 1,
              padding: "10px 10px", border: "none", background: "transparent",
              fontSize: 13, fontWeight: active ? 600 : 500,
              color: active ? "#fff" : "#666",
              cursor: "pointer", fontFamily: "inherit", zIndex: 1,
            }}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.join("|")}`}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                  borderRadius: 9,
                  boxShadow: "0 4px 12px rgba(220,30,60,0.28), inset 0 0 0 1px rgba(255,255,255,0.08)",
                  zIndex: -1,
                }}
              />
            )}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function SubmitBtn({ disabled, loading, grow, children }: {
  disabled?: boolean; loading?: boolean; grow?: boolean; children: React.ReactNode;
}) {
  return (
    <motion.button
      type="submit"
      disabled={disabled}
      whileHover={{ y: disabled ? 0 : -1 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      style={{
        flex: grow ? 1 : undefined,
        marginTop: 6,
        padding: "15px 18px",
        background: disabled
          ? "linear-gradient(135deg, rgba(220,30,60,0.35), rgba(160,21,60,0.35))"
          : "linear-gradient(135deg, #dc1e3c 0%, #a0153c 100%)",
        color: "#fff",
        border: "none",
        borderRadius: 12,
        fontSize: 14, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : "0 10px 28px rgba(220,30,60,0.32), inset 0 0 0 1px rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        fontFamily: "inherit",
        transition: "background 0.2s, box-shadow 0.2s",
      }}
    >
      {loading ? (
        <>
          <Loader2 style={{ width: 15, height: 15, animation: "m4m-onb-spin 0.7s linear infinite" }} />
          Please wait…
        </>
      ) : (
        <>{children} <ArrowRight style={{ width: 15, height: 15 }} /></>
      )}
    </motion.button>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px 13px 40px",
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(26,10,20,0.1)",
  borderRadius: 12,
  fontSize: 14,
  color: "#1a0a14",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(26,10,20,0.1)",
  borderRadius: 12,
  fontSize: 14,
  color: "#1a0a14",
  outline: "none",
  fontFamily: "inherit",
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
};

const eyeBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: 10, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", cursor: "pointer",
  color: "#aaa", padding: 6, display: "grid", placeItems: "center",
  borderRadius: 6, transition: "color 0.15s",
};

const phoneShell: React.CSSProperties = {
  display: "flex", gap: 6,
  padding: 4,
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(26,10,20,0.1)",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
};

const countrySelectStyle: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: 13,
  color: "#1a0a14", outline: "none", cursor: "pointer",
  padding: "8px 6px 8px 10px", fontFamily: "inherit", fontWeight: 600,
  minWidth: 78,
};

const phoneNumberInputStyle: React.CSSProperties = {
  flex: 1, border: "none", outline: "none",
  fontSize: 14, color: "#1a0a14", background: "transparent",
  fontFamily: "inherit", padding: "9px 4px",
};

function sendOtpBtnStyle(sent: boolean): React.CSSProperties {
  return {
    padding: "9px 14px",
    background: sent ? "rgba(92,122,82,0.12)" : "linear-gradient(135deg, #dc1e3c, #a0153c)",
    color: sent ? "#3F5937" : "#fff",
    border: "none",
    borderRadius: 9,
    fontSize: 12, fontWeight: 600, cursor: sent ? "default" : "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    boxShadow: sent ? "none" : "0 2px 10px rgba(220,30,60,0.2)",
  };
}

const otpInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px 14px",
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(26,10,20,0.1)",
  borderRadius: 12,
  fontSize: 22, fontWeight: 600,
  color: "#1a0a14",
  outline: "none",
  textAlign: "center",
  letterSpacing: "0.4em",
  fontFamily: "ui-monospace, 'SF Mono', monospace",
};

const resendBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 12, color: "#dc1e3c", fontWeight: 600,
  marginTop: 8, padding: 0, fontFamily: "inherit",
};

const backBtnStyle: React.CSSProperties = {
  padding: "14px 18px",
  background: "#fff",
  border: "1px solid rgba(26,10,20,0.1)",
  borderRadius: 12,
  fontSize: 13, fontWeight: 600, color: "#555",
  cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 6,
};

const linkStyle: React.CSSProperties = {
  color: "#dc1e3c", textDecoration: "none", fontWeight: 600,
};

// ─── Global styles ─────────────────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style jsx global>{`
      @keyframes m4m-onb-spin { to { transform: rotate(360deg); } }

      .m4m-onb-root input:focus,
      .m4m-onb-root select:focus {
        border-color: #dc1e3c !important;
        background: #fff !important;
        box-shadow: 0 0 0 4px rgba(220, 30, 60, 0.07) !important;
      }

      @media (max-width: 1024px) {
        .m4m-onb-root {
          grid-template-columns: 1fr !important;
          min-height: auto !important;
        }
        .m4m-onb-hero {
          aspect-ratio: 16 / 10;
          min-height: 320px;
        }
        .m4m-onb-form {
          padding: 40px 28px !important;
        }
      }
      @media (max-width: 640px) {
        .m4m-onb-row {
          flex-direction: column !important;
        }
        .m4m-onb-hero {
          aspect-ratio: unset;
          min-height: 280px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
      }
    `}</style>
  );
}
