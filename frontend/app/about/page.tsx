"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Sparkles, ShieldCheck, Lock, Handshake, Globe, Users,
  Quote, ArrowRight,
} from "lucide-react";
import { CountryFlag } from "@/components/ui/country-flag";
import { useAuthState, getCTA } from "@/lib/useVerification";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

/* ────────────────────────────────────────────────────────────────
   About — editorial layout: hero → founder's letter → principles →
   what sets us apart → numbers → quiet CTA. Restrained palette,
   serif display type, generous whitespace. Subtle scroll-fades only.
   ──────────────────────────────────────────────────────────────── */

const principles = [
  {
    Icon: Users,
    title: "Family at the centre",
    body: "An Indian marriage is not the meeting of two people; it is the meeting of two families. Every introduction we make is shaped around that truth: values, upbringing, and the people who matter to you.",
  },
  {
    Icon: Sparkles,
    title: "Hand-picked, never crowded",
    body: "We deliberately stay small. Profiles are reviewed and accepted one at a time, by the same advisors who later guide the introductions. There is no algorithm behind the curtain. There is a person.",
  },
  {
    Icon: ShieldCheck,
    title: "Verified before introduced",
    body: "Identity, profession, and intent are checked privately before a profile is shown to anyone. By the time you meet a member, the meaningful background work has already been done.",
  },
  {
    Icon: Lock,
    title: "Discretion as a default",
    body: "Your photographs, your story, and your contact details are never visible to the open internet, never shared without consent, and never used to build advertising profiles.",
  },
  {
    Icon: Handshake,
    title: "Advisors, not operators",
    body: "Our role does not end at the introduction. We sit with families through hesitations, schedule the first meetings, and stay in touch through the months that follow. The conversation is human, all the way through.",
  },
  {
    Icon: Globe,
    title: "Britain-rooted, globally connected",
    body: "Founded in the United Kingdom and serving the global Indian diaspora, from London to Coimbatore, Singapore to Toronto. The same standard of care, wherever the family sits.",
  },
];

const contrast: Array<{ them: string; us: string }> = [
  {
    them: "Open registration to anyone with an email address.",
    us: "An application reviewed by a person before a profile becomes visible.",
  },
  {
    them: "Algorithmic feeds tuned for engagement, not outcomes.",
    us: "A small number of considered introductions per month, hand-selected.",
  },
  {
    them: "Profile photos and personal details surfaced to the open web.",
    us: "Members visible only to other approved members, by mutual consent.",
  },
  {
    them: "A subscription that ends when you cancel.",
    us: "An advisor relationship that continues through the wedding and beyond.",
  },
];

export default function AboutPage() {
  const authState = useAuthState();
  const cta = getCTA(authState);

  // Subtle parallax on the hero ornament
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const ornamentY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const ornamentOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.2]);

  // Fade-up reveal on every section marked .reveal — same pattern the homepage uses.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".about-reveal");
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
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: "#fdf9f4", color: "#1a0a14" }}>
      <PublicHeader />

      {/* ════════════════════════════════════════════════════════
          1 — Editorial hero. No gradient screamer. Two columns:
              left = headline + lede; right = a single calm portrait.
          ════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          padding: "clamp(64px, 10vw, 128px) 24px clamp(56px, 8vw, 96px)",
          background: "linear-gradient(180deg, #fdf9f4 0%, #faf3eb 100%)",
          overflow: "hidden",
        }}
      >
        {/* Editorial ornament — a single thin gold rule, slowly drifting */}
        <motion.div
          aria-hidden
          style={{
            y: ornamentY,
            opacity: ornamentOpacity,
            position: "absolute",
            top: "32%",
            right: "-10%",
            width: 520,
            height: 520,
            borderRadius: "50%",
            border: "1px solid rgba(201,149,74,0.20)",
            pointerEvents: "none",
          }}
        />
        <motion.div
          aria-hidden
          style={{
            y: ornamentY,
            opacity: ornamentOpacity,
            position: "absolute",
            top: "38%",
            right: "-8%",
            width: 360,
            height: 360,
            borderRadius: "50%",
            border: "1px solid rgba(220,30,60,0.16)",
            pointerEvents: "none",
          }}
        />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center" style={{ position: "relative" }}>
          {/* Left: copy */}
          <div className="lg:col-span-7">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#a78a8f",
              }}
            >
              <span style={{ width: 28, height: 1, background: "rgba(220,30,60,0.4)" }} />
              About Match4Marriage
            </span>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(28px, 4vw, 52px)",
                fontWeight: 500,
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                marginTop: 24,
                color: "#1a0a14",
              }}
            >
              A quieter way to{" "}
              <span
                style={{
                  fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                  fontStyle: "italic",
                  fontWeight: 500,
                  color: "#dc1e3c",
                }}
              >
                find one another.
              </span>
            </h1>
            <p
              style={{
                marginTop: 28,
                fontSize: "clamp(16px, 1.4vw, 19px)",
                lineHeight: 1.7,
                color: "#4a3a40",
                maxWidth: 600,
              }}
            >
              Match4Marriage is a small, advisor-led matrimonial service for the
              British Indian community and the wider diaspora. We do not run a
              dating app. We hand-pick a limited number of profiles, verify each
              one personally, and accompany families through every stage of an
              introduction: the call, the meeting, the conversation that follows.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 28, marginTop: 36, alignItems: "center" }}>
              <Link
                href={cta.href}
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
                {cta.label}
                <ArrowRight size={15} strokeWidth={2} />
              </Link>
              <Link
                href="/contact"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1a0a14",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(26,10,20,0.25)",
                  paddingBottom: 2,
                }}
              >
                Speak to an advisor
                <ArrowRight size={13} strokeWidth={2} />
              </Link>
            </div>
          </div>

          {/* Right: portrait */}
          <div className="lg:col-span-5">
            <div
              style={{
                position: "relative",
                aspectRatio: "4 / 5",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 30px 80px -40px rgba(26,10,20,0.45)",
              }}
            >
              <img
                src="/images/about-hero.jpg"
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 18%" }}
              />
              {/* Editorial caption strip */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "20px 24px",
                  background: "linear-gradient(to top, rgba(26,10,20,0.65) 0%, rgba(26,10,20,0) 100%)",
                  color: "#fdf9f4",
                  fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                  fontStyle: "italic",
                  fontSize: 15,
                  letterSpacing: "0.01em",
                }}
              >
                Founded in the United Kingdom · Serving the global diaspora
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          2 — Founder's note. Personal voice. The human signature is
              the whole point. Cormorant italic for the body, Fraunces
              for the small chapter heading.
          ════════════════════════════════════════════════════════ */}
      <section className="about-reveal" style={{ padding: "clamp(72px, 9vw, 112px) 24px", background: "#fdf9f4" }}>
        <div className="max-w-4xl mx-auto">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#a78a8f" }}>
              Why we exist
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)" }} />
          </div>

          <Quote
            size={28}
            strokeWidth={1}
            style={{ color: "#dc1e3c", opacity: 0.6, marginBottom: 16 }}
          />
          <p
            className="font-display-alt"
            style={{
              fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
              fontStyle: "italic",
              fontSize: "clamp(20px, 2.4vw, 28px)",
              lineHeight: 1.55,
              color: "#1a0a14",
              fontWeight: 500,
              marginBottom: 32,
              letterSpacing: "-0.005em",
            }}
          >
            We started Match4Marriage because the families we knew were tired of
            scrolling. Tired of being one of ten thousand profiles. Tired of an
            algorithm choosing for them. They wanted what their parents had: a
            personal introduction, made by someone who actually knew both sides.
          </p>

          <p style={{ fontSize: 16, lineHeight: 1.85, color: "#4a3a40", marginBottom: 18 }}>
            That is the whole idea. We sit with one family at a time. We listen,
            properly. We make a small number of introductions each month, not
            every match in the database, just the ones we genuinely believe in.
            And we stay in the room for the conversations that follow.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.85, color: "#4a3a40", marginBottom: 36 }}>
            We have no ambition to be the largest matrimonial service in the
            United Kingdom. We have every ambition to be the most considered.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 20, borderTop: "1px solid rgba(26,10,20,0.10)" }}>
            <div>
              <p className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "#1a0a14", margin: 0 }}>
                The Match4Marriage Team
              </p>
              <p style={{ fontSize: 12, color: "#88787f", margin: "2px 0 0", letterSpacing: "0.04em" }}>
                Solihull, England · Established 2023
              </p>
            </div>
            <CountryFlag code="GB" rounded="sm" width={22} />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          3 — Principles. Editorial grid. Numbered. No big icon
              circles, no marketing flourish. Just principles + body.
          ════════════════════════════════════════════════════════ */}
      <section className="about-reveal" style={{ padding: "clamp(72px, 9vw, 112px) 24px", background: "#faf3eb" }}>
        <div className="max-w-7xl mx-auto">
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 64, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#a78a8f" }}>
              How we work
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)", minWidth: 40 }} />
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(32px, 4.5vw, 56px)",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 780,
              marginBottom: 64,
            }}
          >
            Six principles that decide{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              every introduction
            </span>{" "}
            we make.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ rowGap: 56, columnGap: 56 }}>
            {principles.map((p) => (
              <article key={p.title} style={{ paddingTop: 28, borderTop: "1px solid rgba(26,10,20,0.16)" }}>
                <p.Icon size={20} strokeWidth={1.5} style={{ color: "#1a0a14", opacity: 0.85, marginBottom: 16 }} />
                <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.25, marginBottom: 12, letterSpacing: "-0.01em" }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "#4a3a40", margin: 0 }}>
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          4 — What sets us apart. Side-by-side "elsewhere / with us"
              comparison. Two columns of equal weight.
          ════════════════════════════════════════════════════════ */}
      <section className="about-reveal" style={{ padding: "clamp(72px, 9vw, 112px) 24px", background: "#1a0a14", color: "#fdf9f4" }}>
        <div className="max-w-6xl mx-auto">
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 56, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,220,180,0.7)" }}>
              How we differ
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(255,220,180,0.18)", minWidth: 40 }} />
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 720,
              marginBottom: 56,
            }}
          >
            What you find elsewhere, and what we{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#ffd87a" }}>
              do instead.
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 0 }}>
            {/* Header row */}
            <div style={{ padding: "16px 0", borderBottom: "1px solid rgba(255,220,180,0.18)", borderRight: "1px solid rgba(255,220,180,0.10)", paddingRight: 24 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,220,180,0.55)" }}>
                Elsewhere
              </span>
            </div>
            <div style={{ padding: "16px 0 16px 24px", borderBottom: "1px solid rgba(255,220,180,0.18)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#ffd87a" }}>
                With Match4Marriage
              </span>
            </div>

            {/* Rows */}
            {contrast.map((row, i) => (
              <Row key={i} them={row.them} us={row.us} last={i === contrast.length - 1} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          5 — Numbers. Honest, not boastful.
          ════════════════════════════════════════════════════════ */}
      <section className="about-reveal" style={{ padding: "clamp(64px, 8vw, 96px) 24px", background: "#fdf9f4" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: "1px solid rgba(26,10,20,0.12)", borderBottom: "1px solid rgba(26,10,20,0.12)" }}>
            {[
              { num: "2023",    label: "Founded in the UK" },
              { num: "100%",    label: "Hand-picked profiles" },
              { num: "By call", label: "Onboarding, not a form" },
              { num: "4.9 / 5", label: "Family-rated, last 18 mo." },
            ].map((s, i, arr) => (
              <div
                key={s.label}
                style={{
                  padding: "40px 24px",
                  textAlign: "left",
                  borderRight: i < arr.length - 1 ? "1px solid rgba(26,10,20,0.08)" : "none",
                }}
              >
                <p
                  className="font-display"
                  style={{
                    fontSize: "clamp(22px, 2.8vw, 32px)",
                    fontWeight: 600,
                    color: "#1a0a14",
                    letterSpacing: "-0.01em",
                    margin: 0,
                  }}
                >
                  {s.num}
                </p>
                <p style={{ fontSize: 12.5, color: "#88787f", marginTop: 8, fontWeight: 500, letterSpacing: "0.04em" }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          6 — Quiet CTA. No banner, no shouting.
          ════════════════════════════════════════════════════════ */}
      <section className="about-reveal" style={{ padding: "clamp(72px, 9vw, 128px) 24px", background: "#fdf9f4" }}>
        <div className="max-w-3xl mx-auto" style={{ textAlign: "center" }}>
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: 16,
              color: "#1a0a14",
            }}
          >
            If this approach feels right for{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              your family,
            </span>{" "}
            we would like to meet.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4a3a40", maxWidth: 520, margin: "0 auto 36px" }}>
            Begin with a private call. No commitment, no obligation, just a
            conversation about what you are looking for.
          </p>
          <div style={{ display: "inline-flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href={cta.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#1a0a14",
                color: "#fdf9f4",
                padding: "14px 30px",
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.02em",
              }}
            >
              {cta.label}
              <ArrowRight size={15} strokeWidth={2} />
            </Link>
            <Link
              href="/contact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 30px",
                border: "1px solid rgba(26,10,20,0.20)",
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 600,
                color: "#1a0a14",
                textDecoration: "none",
              }}
            >
              Speak to an advisor
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />

      <style>{`
        .about-reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.9s ease, transform 0.9s cubic-bezier(.2,.7,.2,1); }
        .about-reveal.in { opacity: 1; transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .about-reveal { opacity: 1; transform: none; transition: none; }
        }
      `}</style>
    </div>
  );
}

/* ── A row in the elsewhere/here comparison table ─────────────── */
function Row({ them, us, last }: { them: string; us: string; last: boolean }) {
  const border = last ? "none" : "1px solid rgba(255,220,180,0.10)";
  return (
    <>
      <div style={{ padding: "24px 24px 24px 0", borderBottom: border, borderRight: "1px solid rgba(255,220,180,0.10)" }}>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(253,249,244,0.62)", margin: 0 }}>
          {them}
        </p>
      </div>
      <div style={{ padding: "24px 0 24px 24px", borderBottom: border }}>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#fdf9f4", margin: 0, fontWeight: 500 }}>
          {us}
        </p>
      </div>
    </>
  );
}
