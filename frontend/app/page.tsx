"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock, Handshake, Sparkles, ShieldCheck,
  ArrowRight, BadgeCheck, Plus, Minus, Quote,
} from "lucide-react";
import { firebaseAuth } from "@/lib/firebase";
import { profileApi } from "@/lib/api";
import { CountryFlag } from "@/components/ui/country-flag";
import { FloatingHearts } from "@/components/ui/floating-hearts";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

/* ── Marketing content (curated testimonials, not user data) ──────────── */

import { featuredStories as stories, monogramFor } from "@/lib/featured-stories";

const features = [
  { title: "Hand-Picked Profiles Only", desc: "Every profile is personally reviewed and approved, not just registered" },
  { title: "Complete Discretion", desc: "Your details are handled with the utmost confidentiality at every step" },
  { title: "Elite Matching", desc: "We match on values, ambition, and compatibility, not just age and location" },
  { title: "UK-Based Service", desc: "Founded in the United Kingdom, serving the global Indian community" },
  { title: "Dedicated Guidance", desc: "Personal support from our relationship advisors, 7 days a week" },
  { title: "Secure & GDPR Compliant", desc: "SSL encrypted, fully compliant with UK data protection standards" },
];


/* ── Component ─────────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("onboarding_completed") === "true") {
      router.replace("/dashboard");
      return;
    }
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        const res = await profileApi.me();
        const raw: any = res.data;
        const p = raw?.data ?? raw;
        if (p && p.first_name && String(p.first_name).trim()) {
          localStorage.setItem("onboarding_completed", "true");
          router.replace("/dashboard");
        }
      } catch { /* ignore */ }
    });
    return unsub;
  }, [router]);

  // Scroll reveal: editorial-reveal sections fade up on first viewport entry
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".editorial-reveal");
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);


  return (
    <div className="min-h-screen overflow-x-hidden font-poppins">

      {/* ── 1+2. Top bar + sticky main nav (shared across public pages).
              On the homepage the header floats transparently over the hero
              video and only flips to its solid editorial style once the user
              has scrolled past it. ─── */}
      <PublicHeader transparent />


      {/* ── 3. Hero Banner — Full-Width Cinematic Video ─────────────── */}
      <section id="home" style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>

        {/* Static poster — paints instantly, also serves users with reduced-motion */}
        <img
          src="/images/Gemini_Generated_Image_xaa8o9xaa8o9xaa8.png"
          alt=""
          aria-hidden="true"
          className="hero-poster"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "75% 30%",
          }}
        />

        {/* Background hero video (decorative, muted, autoplays inline on mobile) */}
        <video
          className="hero-video"
          src="/ALEX%20NISHA%20HINDU%20HIGHLIGHTS%20LQ-001%20(online-video-cutter.com)%20(1).mp4"
          poster="/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "75% 30%",
          }}
        />

        {/* Editorial overlay — stronger darkening behind the text column on the
            left, lifting toward transparent on the right so the video still
            reads clearly. Vertical fades sit above for top/bottom legibility. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(10,4,8,0.78) 0%, rgba(10,4,8,0.55) 35%, rgba(10,4,8,0.18) 70%, rgba(10,4,8,0.05) 100%)",
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.55) 100%)",
            zIndex: 2,
          }}
        />

        {/* Drifting petals + animated love hearts (premium hero motion) */}
        <FloatingHearts count={14} density="balanced" />
        {[
          { left: "8%",  delay: "0s",    dur: "14s", scale: 1 },
          { left: "22%", delay: "3s",    dur: "17s", scale: 0.7 },
          { left: "38%", delay: "6s",    dur: "13s", scale: 1.2 },
          { left: "55%", delay: "1.5s",  dur: "19s", scale: 0.9 },
          { left: "72%", delay: "8s",    dur: "15s", scale: 1.1 },
          { left: "88%", delay: "4.5s",  dur: "18s", scale: 0.8 },
          { left: "15%", delay: "10s",   dur: "16s", scale: 0.6 },
          { left: "65%", delay: "12s",   dur: "14s", scale: 1 },
        ].map((p, i) => (
          <span
            key={i}
            className="petal"
            style={{
              left: p.left,
              animationDuration: p.dur,
              animationDelay: p.delay,
              transform: `scale(${p.scale})`,
            }}
          />
        ))}

{/* Editorial content overlay — left-aligned column. Asymmetric
            vertical padding (large at top, smaller at bottom) ensures the
            kicker has breathing room below the floating header instead of
            crowding against the nav. */}
        <div
          className="hero-reveal"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            padding: "clamp(160px, 16vh, 220px) clamp(24px, 6vw, 80px) clamp(96px, 10vh, 140px)",
          }}
        >
          <div style={{ maxWidth: 720, width: "100%" }}>
            {/* Editorial kicker — thin gold rule + label */}
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: "rgba(255,220,180,0.9)",
              marginBottom: 28,
            }}>
              <span style={{ width: 32, height: 1, background: "rgba(255,220,180,0.55)" }} />
              <CountryFlag code="GB" rounded="sm" width={18} />
              Elite Indian Matrimony
            </span>

            {/* Headline — Fraunces with Cormorant italic accent (matches every other page) */}
            <h1
              className="font-display"
              style={{
                color: "#fdf9f4",
                fontSize: "clamp(28px, 4vw, 52px)",
                fontWeight: 500,
                lineHeight: 1.0,
                letterSpacing: "-0.025em",
                margin: "0 0 24px",
                textShadow: "0 2px 40px rgba(0,0,0,0.35)",
              }}
            >
              Where two families
              <br />
              <span
                style={{
                  fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                  fontStyle: "italic",
                  fontWeight: 500,
                  background: "linear-gradient(135deg, #FFE4A8 0%, #FFB347 50%, #FFD87A 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 6px 30px rgba(255,180,90,0.35))",
                }}
              >
                become one.
              </span>
            </h1>

            {/* Subhead — single calm line */}
            <p style={{
              color: "rgba(253,249,244,0.88)",
              fontSize: "clamp(15px, 1.4vw, 19px)",
              lineHeight: 1.65,
              margin: "0 0 40px",
              maxWidth: 560,
              textShadow: "0 1px 20px rgba(0,0,0,0.4)",
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
            }}>
              An advisor-led matrimony service for the British Indian community
              and the global diaspora. Personally curated, privately introduced.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <Link href="/auth/register" style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#fdf9f4",
                color: "#1a0a14",
                padding: "16px 32px",
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.02em",
                boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              }}>
                Find your forever
                <ArrowRight size={15} strokeWidth={2} />
              </Link>
              <Link href="/contact" style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "#fdf9f4",
                padding: "15px 30px",
                border: "1px solid rgba(253,249,244,0.35)",
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.02em",
                backdropFilter: "blur(6px)",
                background: "rgba(253,249,244,0.04)",
              }}>
                Speak to an advisor
              </Link>
            </div>

            {/* Quiet credentials line — matches editorial restraint */}
            <p style={{
              marginTop: 48,
              fontSize: 12.5,
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: "rgba(253,249,244,0.6)",
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
            }}>
              Founded 2023 · Hand-picked · Family-rated 4.9
            </p>
          </div>
        </div>

        {/* Scroll indicator — tiny editorial cue at the bottom */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            color: "rgba(253,249,244,0.55)",
          }}
          className="hero-scroll-indicator"
        >
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.14em" }}>
            Scroll
          </span>
          <span style={{
            display: "block",
            width: 1,
            height: 36,
            background: "linear-gradient(to bottom, rgba(253,249,244,0.6) 0%, rgba(253,249,244,0) 100%)",
          }} />
        </div>

        {/* Hero video / poster styling */}
        <style>{`
          /* Subtle film grade + cinematic fade-in on the hero video */
          .hero-video {
            opacity: 0;
            animation: heroVideoFade 1.6s cubic-bezier(.2,.7,.2,1) 0.15s forwards;
            filter: saturate(1.06) contrast(1.02);
            will-change: opacity, transform;
          }
          @keyframes heroVideoFade {
            from { opacity: 0; transform: scale(1.04); }
            to   { opacity: 1; transform: scale(1); }
          }

          /* On reduced-motion or no-video support, fall back to the static poster image */
          @media (prefers-reduced-motion: reduce) {
            .hero-video { display: none; }
          }

          /* Scroll indicator — gentle vertical drift on the line */
          .hero-scroll-indicator {
            animation: heroScrollFloat 2.4s ease-in-out infinite;
          }
          @keyframes heroScrollFloat {
            0%, 100% { transform: translate(-50%, 0); opacity: 0.55; }
            50%      { transform: translate(-50%, 6px); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .hero-scroll-indicator { animation: none; }
          }

          /* Staggered reveal for hero content */
          .hero-reveal > * {
            opacity: 0;
            transform: translateY(24px);
            animation: heroRise 1.1s cubic-bezier(.2,.7,.2,1) forwards;
          }
          .hero-reveal > *:nth-child(1) { animation-delay: 0.05s; }
          .hero-reveal > *:nth-child(2) { animation-delay: 0.25s; }
          .hero-reveal > *:nth-child(3) { animation-delay: 0.45s; }
          .hero-reveal > *:nth-child(4) { animation-delay: 0.65s; }
          .hero-reveal > *:nth-child(5) { animation-delay: 0.85s; }
          @keyframes heroRise {
            to { opacity: 1; transform: translateY(0); }
          }

          /* Shimmering gold script text */
          .gold-shimmer {
            background: linear-gradient(100deg, #ffd87a 20%, #fff3c2 45%, #ffb347 55%, #ffd87a 80%);
            background-size: 200% 100%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: goldSweep 5.5s ease-in-out infinite;
            filter: drop-shadow(0 2px 18px rgba(255,200,100,0.35));
          }
          @keyframes goldSweep {
            0%, 100% { background-position: 0% 50%; }
            50%      { background-position: 100% 50%; }
          }

          /* Drifting petals */
          .petal {
            position: absolute;
            top: -40px;
            width: 14px; height: 14px;
            background: radial-gradient(circle at 30% 30%, #ffb5c5, #d4607a 70%, transparent 72%);
            border-radius: 80% 0 80% 0;
            opacity: 0;
            animation: petalFall linear infinite;
            pointer-events: none;
            z-index: 3;
            filter: blur(0.3px);
          }
          @keyframes petalFall {
            0%   { opacity: 0; transform: translate3d(0,0,0) rotate(0deg); }
            10%  { opacity: 0.85; }
            90%  { opacity: 0.75; }
            100% { opacity: 0; transform: translate3d(80px, 110vh, 0) rotate(540deg); }
          }

          /* Button sheen */
          .sheen-btn { position: relative; overflow: hidden; isolation: isolate; }
          .sheen-btn::after {
            content: "";
            position: absolute; inset: 0;
            background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%);
            transform: translateX(-120%);
            transition: transform 0.9s cubic-bezier(.2,.7,.2,1);
            pointer-events: none;
          }
          .sheen-btn:hover::after { transform: translateX(120%); }
          .sheen-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 32px rgba(220,30,60,0.35); }
          .sheen-btn { transition: transform .3s ease, box-shadow .3s ease; }

          /* Lift-on-hover cards */
          .lift-card { transition: transform .5s cubic-bezier(.2,.7,.2,1), box-shadow .5s ease; }
          .lift-card:hover { transform: translateY(-6px) rotate(-0.3deg); box-shadow: 0 24px 48px rgba(160,21,60,0.18); }

          /* Fade-up on scroll (IntersectionObserver adds .in) */
          .reveal { opacity: 0; transform: translateY(32px); transition: opacity 1s ease, transform 1s cubic-bezier(.2,.7,.2,1); }
          .reveal.in { opacity: 1; transform: translateY(0); }

          /* Custom scrollbar */
          html { scrollbar-color: #dc1e3c #fdf1ea; scrollbar-width: thin; }
          ::-webkit-scrollbar { width: 10px; }
          ::-webkit-scrollbar-track { background: #fdf1ea; }
          ::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #dc1e3c, #a0153c);
            border-radius: 10px; border: 2px solid #fdf1ea;
          }

          @media (prefers-reduced-motion: reduce) {
            .hero-reveal > *, .petal, .gold-shimmer, .sheen-btn::after { animation: none !important; }
            .hero-reveal > * { opacity: 1; transform: none; }
          }
        `}</style>
      </section>

      {/* ════════════════════════════════════════════════════════
          Trust strip — typographic, no boxes
          ════════════════════════════════════════════════════════ */}
      <section style={{ background: "#fdf9f4", borderTop: "1px solid rgba(26,10,20,0.08)", borderBottom: "1px solid rgba(26,10,20,0.08)" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {[
            { Icon: Sparkles,   title: "Hand-picked profiles", desc: "Every member personally vetted" },
            { Icon: BadgeCheck, title: "UK-registered",         desc: "Based and regulated in Britain" },
            { Icon: Lock,       title: "Discreet by default",   desc: "Never shared without consent" },
            { Icon: Handshake,  title: "Personal advisors",     desc: "Real people guiding the journey" },
          ].map((item, i) => (
            <div key={item.title} style={{
              padding: "32px 24px",
              borderRight: i < 3 ? "1px solid rgba(26,10,20,0.06)" : "none",
            }}>
              <item.Icon size={18} strokeWidth={1.5} style={{ color: "#dc1e3c", marginBottom: 12, opacity: 0.85 }} />
              <p className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "#1a0a14", marginBottom: 4, letterSpacing: "-0.01em" }}>
                {item.title}
              </p>
              <p style={{ fontSize: 12.5, color: "#88787f", lineHeight: 1.55 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          I — How we work
          ════════════════════════════════════════════════════════ */}
      <section className="editorial-reveal" id="how-it-works" style={{ padding: "clamp(72px, 9vw, 112px) 24px", background: "#fdf9f4" }}>
        <div className="max-w-7xl mx-auto">
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 48, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#a78a8f" }}>
              How we work
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)", minWidth: 40 }} />
          </div>
          <h2 className="font-display" style={{ fontSize: "clamp(34px, 4.5vw, 60px)", fontWeight: 500, lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 56, maxWidth: 820, color: "#1a0a14" }}>
            From the first conversation to{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              the wedding day.
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ rowGap: 48, columnGap: 40 }}>
            {[
              { n: "01", title: "Tell us about you", body: "Begin with a private intake call. Our advisor takes the time to understand who you are, what matters, and what you are looking for in a partner." },
              { n: "02", title: "We hand-pick matches", body: "We curate three to five compatible introductions per month. No algorithm, no swiping, just considered, advisor-led suggestions." },
              { n: "03", title: "Connect in private", body: "Express interest discreetly. Your contact details are shared only when both sides have indicated mutual interest." },
              { n: "04", title: "Begin forever", body: "Meet families and take the next step. Our advisors stay alongside you, through the introductions, the meetings, and the wedding." },
            ].map((step) => (
              <article key={step.n} style={{ paddingTop: 24, borderTop: "1px solid rgba(26,10,20,0.16)" }}>
                <h3 className="font-display" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25, marginBottom: 12, letterSpacing: "-0.01em", color: "#1a0a14" }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "#4a3a40", margin: 0 }}>
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          II — Members are introduced privately
          ════════════════════════════════════════════════════════ */}
      <section className="editorial-reveal" style={{ padding: "clamp(72px, 9vw, 112px) 24px", background: "#faf3eb" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          <div className="lg:col-span-5">
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 32 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#a78a8f" }}>
                By invitation
              </span>
              <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)" }} />
            </div>
            <h2 className="font-display" style={{ fontSize: "clamp(28px, 3.6vw, 44px)", fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 20, color: "#1a0a14" }}>
              Members are{" "}
              <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
                personally introduced.
              </span>
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: "#4a3a40", marginBottom: 28 }}>
              For their privacy, member profiles are not visible to the open
              internet. Every introduction begins with a confidential call,
              and only after we genuinely believe two families are right for
              each other.
            </p>
            <Link
              href="/auth/register"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#1a0a14",
                color: "#fdf9f4",
                padding: "14px 28px",
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.02em",
              }}
            >
              Find your forever
              <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>

          <div className="lg:col-span-7" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {[
              { kicker: "01", title: "Confidential intake", body: "A 30-minute call with one of our advisors to understand what matters to you and your family." },
              { kicker: "02", title: "Hand-picked profiles", body: "Three to five considered introductions per month, never automated, never compromised." },
              { kicker: "03", title: "Guided introduction", body: "When you are both interested, we facilitate the family meeting with discretion and care." },
            ].map((step) => (
              <article key={step.kicker} style={{
                background: "#fdf9f4",
                border: "1px solid rgba(26,10,20,0.08)",
                borderRadius: 4,
                padding: "26px 28px",
              }}>
                <div>
                  <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "#1a0a14", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 14, color: "#4a3a40", lineHeight: 1.7, margin: 0 }}>
                    {step.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          III — Why this approach (3 principles)
          ════════════════════════════════════════════════════════ */}
      <section className="editorial-reveal" style={{ padding: "clamp(72px, 9vw, 112px) 24px", background: "#1a0a14", color: "#fdf9f4" }}>
        <div className="max-w-7xl mx-auto">
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 48, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "rgba(255,220,180,0.75)" }}>
              Why this approach
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(255,220,180,0.18)", minWidth: 40 }} />
          </div>
          <h2 className="font-display" style={{ fontSize: "clamp(30px, 4vw, 52px)", fontWeight: 500, lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 64, maxWidth: 760 }}>
            Three principles that make a{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#ffd87a" }}>
              difference.
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 56 }}>
            {[
              { Icon: Sparkles, title: "Hand-picked, not crowded", body: "We deliberately stay small. Every profile is reviewed by the same advisors who later make the introduction. No algorithm sits between you." },
              { Icon: ShieldCheck, title: "Verified before introduced", body: "Identity, profession, and intent are checked privately first. By the time you see a profile, the meaningful background work is done." },
              { Icon: Handshake, title: "Advisors, not operators", body: "Our role does not end at the introduction. We remain on the call through hesitations, family conversations, and the months that follow." },
            ].map((p) => (
              <article key={p.title} style={{ paddingTop: 24, borderTop: "1px solid rgba(255,220,180,0.18)" }}>
                <p.Icon size={20} strokeWidth={1.4} style={{ color: "#ffd87a", marginBottom: 16 }} />
                <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.25, marginBottom: 12, letterSpacing: "-0.01em" }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "rgba(253,249,244,0.72)", margin: 0 }}>
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          IV — Stories
          ════════════════════════════════════════════════════════ */}
      <section className="editorial-reveal" id="success-stories" style={{ padding: "clamp(72px, 9vw, 112px) 24px", background: "#fdf9f4" }}>
        <div className="max-w-7xl mx-auto">
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 48, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#a78a8f" }}>
              Stories so far
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)", minWidth: 40 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 48, gap: 32, flexWrap: "wrap" }}>
            <h2 className="font-display" style={{ fontSize: "clamp(30px, 4vw, 52px)", fontWeight: 500, lineHeight: 1.08, letterSpacing: "-0.02em", maxWidth: 720, margin: 0, color: "#1a0a14" }}>
              They found each other{" "}
              <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
                here.
              </span>
            </h2>
            <Link href="/success-stories" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 14, fontWeight: 600, color: "#1a0a14",
              textDecoration: "none",
              borderBottom: "1px solid rgba(26,10,20,0.25)",
              paddingBottom: 2,
              flexShrink: 0,
            }}>
              See all stories <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 32 }}>
            {stories.map((s) => (
              <article key={s.names} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 4, marginBottom: 20, background: "linear-gradient(135deg, #faf3eb 0%, #f4e0e6 100%)", position: "relative" }}>
                  {/* Monogram fallback — sits underneath the photo so if the
                      image fails to load the card still looks intentional. */}
                  <div aria-hidden style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                    fontStyle: "italic", fontSize: 64, fontWeight: 500,
                    color: "rgba(220,30,60,0.30)", letterSpacing: "0.04em",
                  }}>
                    {monogramFor(s.names)}
                  </div>
                  <img
                    src={s.img}
                    alt={s.names}
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                  />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#a78a8f", marginBottom: 10 }}>
                  {s.year} · {s.location}
                </span>
                <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2, color: "#1a0a14", marginBottom: 12, letterSpacing: "-0.01em" }}>
                  {s.names}
                </h3>
                <Quote size={20} strokeWidth={1} style={{ color: "#dc1e3c", opacity: 0.5, marginBottom: 8 }} />
                <p
                  className="font-display-alt"
                  style={{
                    fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                    fontStyle: "italic",
                    fontSize: 16,
                    lineHeight: 1.65,
                    color: "#4a3a40",
                    margin: 0,
                  }}
                >
                  {s.quote}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          V — Why we are different (split feature list)
          ════════════════════════════════════════════════════════ */}
      <section className="editorial-reveal" style={{ padding: "clamp(72px, 9vw, 112px) 24px", background: "#faf3eb" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          <div className="lg:col-span-5">
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 32 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#a78a8f" }}>
                What we offer
              </span>
              <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)" }} />
            </div>
            <h2 className="font-display" style={{ fontSize: "clamp(30px, 4vw, 52px)", fontWeight: 500, lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 24, color: "#1a0a14" }}>
              Six reasons families{" "}
              <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
                stay with us.
              </span>
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4a3a40", margin: 0 }}>
              Every detail of how we work has been chosen with a single
              question in mind. What would we want for our own family?
            </p>
          </div>
          <div className="lg:col-span-7">
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr", gap: 0 }}>
              {features.map((f, i) => (
                <li key={f.title} style={{
                  padding: "20px 0",
                  borderTop: i === 0 ? "1px solid rgba(26,10,20,0.16)" : "none",
                  borderBottom: "1px solid rgba(26,10,20,0.10)",
                }}>
                  <div>
                    <p className="font-display" style={{ fontSize: 17, fontWeight: 600, color: "#1a0a14", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                      {f.title}
                    </p>
                    <p style={{ fontSize: 14, color: "#4a3a40", lineHeight: 1.6, margin: 0 }}>
                      {f.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          VI — Common questions
          ════════════════════════════════════════════════════════ */}
      <section className="editorial-reveal" id="faq" style={{ padding: "clamp(72px, 9vw, 112px) 24px", background: "#fdf9f4" }}>
        <div className="max-w-3xl mx-auto">
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 32 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#a78a8f" }}>
              Common questions
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)" }} />
          </div>
          <h2 className="font-display" style={{ fontSize: "clamp(28px, 3.6vw, 44px)", fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 48, color: "#1a0a14" }}>
            Before you{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              begin.
            </span>
          </h2>

          <div>
            {[
              { q: "How is Match4Marriage different from other matrimony sites?", a: "We are a boutique service, not a mass-market platform. Every profile is hand-picked and personally vetted by our team. We focus on quality introductions, not volume." },
              { q: "How does the matching process work?", a: "Once you register, our advisors review your profile and preferences. We personally curate compatible introductions. No swiping, no endless browsing, just meaningful, considered matches." },
              { q: "Is my information kept private?", a: "Absolutely. Your contact details and personal information are never shared without explicit consent. All data is handled in compliance with UK GDPR regulations." },
              { q: "How long does it typically take to find a match?", a: "Every journey is unique. Some members find their match within weeks; others take a few months. We guide you at every stage and never rush the process." },
              { q: "Do you serve families outside the UK?", a: "Yes. While our primary focus is the British Indian community, we connect families globally, including India, UAE, Canada, Australia, and the USA." },
            ].map((faq, i) => {
              const open = openFaq === i;
              return (
                <div key={i} style={{ borderBottom: "1px solid rgba(26,10,20,0.10)" }}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    style={{
                      width: "100%",
                      padding: "22px 0",
                      background: "none",
                      border: 0,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      textAlign: "left",
                      color: "#1a0a14",
                      fontFamily: "inherit",
                    }}
                    aria-expanded={open}
                  >
                    <span className="font-display" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.005em" }}>
                      {faq.q}
                    </span>
                    <span style={{ flexShrink: 0, color: "#dc1e3c" }}>
                      {open ? <Minus size={18} strokeWidth={2} /> : <Plus size={18} strokeWidth={2} />}
                    </span>
                  </button>
                  {open && (
                    <p style={{ paddingBottom: 22, fontSize: 14.5, lineHeight: 1.75, color: "#4a3a40", margin: 0, maxWidth: 620 }}>
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 14, color: "#88787f", marginTop: 32 }}>
            More questions? See our{" "}
            <Link href="/faq" style={{ color: "#1a0a14", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid rgba(26,10,20,0.25)" }}>
              full FAQ
            </Link>{" "}
            or{" "}
            <Link href="/contact" style={{ color: "#1a0a14", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid rgba(26,10,20,0.25)" }}>
              speak to an advisor
            </Link>.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          VII — Final CTA, restrained
          ════════════════════════════════════════════════════════ */}
      <section className="editorial-reveal" style={{ padding: "clamp(72px, 9vw, 128px) 24px", background: "#faf3eb" }}>
        <div className="max-w-3xl mx-auto" style={{ textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#a78a8f", marginBottom: 24 }}>
            <CountryFlag code="GB" rounded="sm" /> Match4Marriage · United Kingdom
          </span>
          <h2 className="font-display" style={{ fontSize: "clamp(30px, 4.4vw, 56px)", fontWeight: 500, lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 20, color: "#1a0a14" }}>
            Begin a quieter way to{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              find one another.
            </span>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4a3a40", maxWidth: 540, margin: "0 auto 36px" }}>
            Begin with a private call. No commitment, just a conversation about
            what you and your family are looking for.
          </p>
          <div style={{ display: "inline-flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/auth/register" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#1a0a14", color: "#fdf9f4",
              padding: "14px 32px", borderRadius: 9999,
              fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em",
            }}>
              Find your forever <ArrowRight size={15} strokeWidth={2} />
            </Link>
            <Link href="/contact" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px",
              border: "1px solid rgba(26,10,20,0.20)",
              borderRadius: 9999,
              fontSize: 14, fontWeight: 600, color: "#1a0a14", textDecoration: "none",
            }}>
              Speak to an advisor
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
