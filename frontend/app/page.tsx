"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase";
import { profileApi } from "@/lib/api";

/* ── Data ──────────────────────────────────────────────────────────── */

const profiles = [
  { name: "Priya S.", age: 26, profession: "Software Engineer", location: "Mumbai", religion: "Hindu", gender: "female", verified: true, premium: true },
  { name: "Rahul M.", age: 29, profession: "Doctor", location: "Delhi", religion: "Hindu", gender: "male", verified: true, premium: false },
  { name: "Ananya K.", age: 24, profession: "Architect", location: "Bangalore", religion: "Christian", gender: "female", verified: true, premium: true },
  { name: "Vikram R.", age: 31, profession: "Business Owner", location: "Pune", religion: "Sikh", gender: "male", verified: true, premium: false },
  { name: "Meera P.", age: 27, profession: "CA", location: "Chennai", religion: "Hindu", gender: "female", verified: true, premium: true },
  { name: "Arjun N.", age: 28, profession: "Civil Engineer", location: "Hyderabad", religion: "Muslim", gender: "male", verified: true, premium: false },
];

const stories = [
  {
    img: "/images/story1.png",
    names: "Priya & Karthik",
    location: "London & Chennai",
    year: "Married 2024",
    quote: "We had both given up on online matchmaking until Match4Marriage. Within weeks, we were introduced to each other, and within months, our families had met. We married in Chennai in December 2024.",
  },
  {
    img: "/images/story2.png",
    names: "Anitha & Vijay",
    location: "Birmingham & Coimbatore",
    year: "Married 2024",
    quote: "What set Match4Marriage apart was the personal touch. They didn't just send us a profile. They took time to understand what we were both looking for. We are so grateful for the care they showed.",
  },
  {
    img: "/images/story4.png",
    names: "Deepa & Suresh",
    location: "Manchester & Madurai",
    year: "Married 2023",
    quote: "Our families were in different cities and countries. Match4Marriage bridged that gap beautifully. The process was discreet, respectful, and exactly what we needed.",
  },
];

const features = [
  { title: "Hand-Picked Profiles Only", desc: "Every profile is personally reviewed and approved, not just registered" },
  { title: "Complete Discretion", desc: "Your details are handled with the utmost confidentiality at every step" },
  { title: "Elite Matching", desc: "We match on values, ambition, and compatibility, not just age and location" },
  { title: "UK-Based Service", desc: "Founded in the United Kingdom, serving the global Indian community" },
  { title: "Dedicated Guidance", desc: "Personal support from our relationship advisors, 7 days a week" },
  { title: "Secure & GDPR Compliant", desc: "SSL encrypted, fully compliant with UK data protection standards" },
];


const couples = [
  { url: "/images/banner1.png", name: "Priya & Rahul" },
  { url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=90&auto=format&fit=crop", name: "Anjali & Suresh" },
  { url: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=90&auto=format&fit=crop", name: "Meera & Vikram" },
  { url: "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=800&q=90&auto=format&fit=crop", name: "Kavya & Arjun" },
  { url: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=90&auto=format&fit=crop", name: "Divya & Rohit" },
  { url: "https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=800&q=90&auto=format&fit=crop", name: "Sneha & Kartik" },
  { url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&q=90&auto=format&fit=crop", name: "Nisha & Dev" },
  { url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=90&auto=format&fit=crop", name: "Pooja & Arun" },
];

const filterTabs = ["All", "Hindu", "Christian", "Sikh", "Muslim"];

/* ── Component ─────────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data;
        if (p && p.first_name && p.first_name.trim()) {
          router.replace("/dashboard");
        }
      } catch { /* ignore */ }
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll reveal: any element with class "reveal" fades up when visible
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
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

      {/* ── 1. Top Bar ───────────────────────────────────────────────── */}
      <div className="w-full text-white text-sm py-2 px-4" style={{ backgroundColor: "#dc1e3c" }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>💍 Elite Indian Matrimony, Established in the UK 🇬🇧</span>
          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <span>✉️ enquiry@match4marriage.com</span>
          </div>
        </div>
      </div>

      {/* ── 2. Navigation ────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white" style={{ borderBottom: "1px solid rgba(220,30,60,0.12)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img
              src="/images/logo.jpeg"
              alt="Match4Marriage"
              style={{ height: "52px", width: "auto", objectFit: "contain" }}
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-8">
            {[
              { label: "Home", href: "/" },
              { label: "Browse Profiles", href: "/profiles" },
              { label: "Success Stories", href: "/success-stories" },
              { label: "About Us", href: "/about" },
              { label: "Pricing", href: "/pricing" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium transition-colors duration-200 hover:text-[#dc1e3c]"
                style={{ color: "#333" }}
              >
                {item.label}
              </a>
            ))}

            {/* Help dropdown */}
            <div ref={helpRef} style={{ position: "relative" }}>
              <button
                onClick={() => setHelpOpen(!helpOpen)}
                className="text-sm font-medium transition-colors duration-200 hover:text-[#dc1e3c] flex items-center gap-1"
                style={{ color: helpOpen ? "#dc1e3c" : "#333", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Help
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: "transform 0.2s", transform: helpOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {helpOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 12px)", left: "50%", transform: "translateX(-50%)",
                  background: "#fff", borderRadius: "12px", minWidth: "180px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: "1px solid rgba(220,30,60,0.1)",
                  overflow: "hidden", zIndex: 100,
                }}>
                  {/* Arrow */}
                  <div style={{
                    position: "absolute", top: "-6px", left: "50%", transform: "translateX(-50%)",
                    width: "12px", height: "12px", background: "#fff",
                    borderTop: "1px solid rgba(220,30,60,0.1)", borderLeft: "1px solid rgba(220,30,60,0.1)",
                    rotate: "45deg",
                  }} />
                  {[
                    { label: "FAQ", href: "/faq" },
                    { label: "Contact Us", href: "/contact" },
                  ].map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setHelpOpen(false)}
                      style={{
                        display: "block", padding: "12px 20px",
                        fontSize: "13px", fontWeight: 500, color: "#333",
                        textDecoration: "none",
                        borderBottom: "1px solid rgba(220,30,60,0.06)",
                        transition: "background 0.15s",
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(220,30,60,0.05)"; e.currentTarget.style.color = "#dc1e3c"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#333"; }}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden sm:inline-block text-sm font-medium px-4 py-2 rounded-lg border transition-colors duration-200 hover:border-[#dc1e3c] hover:text-[#dc1e3c]" style={{ color: "#555", borderColor: "#e5e5e5" }}>
              Log In
            </Link>
            <Link href="/auth/register" className="btn-gold px-5 py-2 text-sm hidden sm:inline-block">
              Register Free
            </Link>
            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg width="24" height="24" fill="none" stroke="#1a0a14" strokeWidth="2" strokeLinecap="round">
                {mobileMenuOpen ? (
                  <>
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="6" y1="18" x2="18" y2="6" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t px-6 py-4 space-y-3" style={{ borderColor: "rgba(161,99,4,0.12)" }}>
            {[
              { label: "Home", href: "/" },
              { label: "Browse Profiles", href: "/profiles" },
              { label: "Success Stories", href: "/success-stories" },
              { label: "About Us", href: "/about" },
              { label: "Pricing", href: "/pricing" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block text-sm font-medium py-2"
                style={{ color: "#1a0a14" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            {/* Mobile Help submenu */}
            <div style={{ borderTop: "1px solid rgba(220,30,60,0.08)", paddingTop: "8px" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#bbb" }}>Help</p>
              <a href="#faq" className="block text-sm font-medium py-1.5 pl-3" style={{ color: "#1a0a14" }} onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <a href="#contact" className="block text-sm font-medium py-1.5 pl-3" style={{ color: "#1a0a14" }} onClick={() => setMobileMenuOpen(false)}>Contact Us</a>
            </div>
            <Link href="/auth/login" className="block text-center px-5 py-2 text-sm mt-2 rounded-lg border font-medium" style={{ color: "#dc1e3c", borderColor: "#dc1e3c" }}>
              Log In
            </Link>
            <Link href="/auth/register" className="btn-gold block text-center px-5 py-2 text-sm mt-2">
              Register Free
            </Link>
          </div>
        )}
      </nav>

      {/* ── 3. Hero Banner — Full-Width Image Carousel ──────────────── */}
      <section id="home" style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>

        {/* Background cycling images */}
        {[
          { src: "/images/Gemini_Generated_Image_xaa8o9xaa8o9xaa8.png", couple: "Priya & Rahul", time: "Matched in 2 weeks" },
          { src: "/images/Gemini_Generated_Image_n1v0xcn1v0xcn1v0.png", couple: "Anjali & Suresh", time: "Matched in 3 weeks" },
          { src: "/images/Gemini_Generated_Image_nnsmd2nnsmd2nnsm.png", couple: "Kavya & Vikram", time: "Matched in 1 month" },
          { src: "/images/Gemini_Generated_Image_rovssrovssrovssr.png", couple: "Meera & Arjun", time: "Matched in 10 days" },
        ].map((slide, idx) => (
          <div
            key={slide.src}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              animationName: `heroSlide${idx}`,
              animationDuration: "20s",
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
            }}
          >
            <img
              src={slide.src}
              alt={slide.couple}
              loading={idx === 0 ? "eager" : "lazy"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center 20%",
                animation: "kenBurns 20s ease-in-out infinite",
                transformOrigin: idx % 2 === 0 ? "center 30%" : "30% center",
              }}
            />
          </div>
        ))}

        {/* Dark gradient overlay for text readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.65) 100%)",
            zIndex: 2,
          }}
        />

        {/* Side vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)",
            zIndex: 2,
          }}
        />

        {/* Drifting petals */}
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

        {/* Content overlay */}
        <div
          className="hero-reveal"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            padding: "0 24px",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(220,30,60,0.9)",
              backdropFilter: "blur(8px)",
              borderRadius: "9999px",
              padding: "8px 22px",
              marginBottom: "28px",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <span style={{ color: "#fff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              🇬🇧 Elite Indian Matrimony, UK
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-playfair"
            style={{
              color: "#fff",
              fontSize: "clamp(38px, 5.5vw, 72px)",
              fontWeight: 700,
              lineHeight: 1.12,
              marginBottom: "20px",
              textShadow: "0 2px 30px rgba(0,0,0,0.4)",
            }}
          >
            Where Two Families<br />
            <span className="gold-shimmer" style={{ fontFamily: "var(--font-great-vibes)", fontSize: "clamp(48px, 7vw, 88px)", fontWeight: 400, display: "inline-block" }}>Become One</span>
          </h1>

          <p
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: "clamp(16px, 2vw, 20px)",
              marginBottom: "40px",
              maxWidth: "560px",
              lineHeight: 1.6,
              textShadow: "0 1px 10px rgba(0,0,0,0.3)",
            }}
          >
            A boutique matrimonial service for the global elite Indian community: hand-picked, personally verified profiles across the UK and worldwide.
          </p>

          {/* Search Widget */}
          <div
            style={{
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(16px)",
              borderRadius: "16px",
              padding: "20px 24px",
              marginBottom: "32px",
              boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
              maxWidth: "640px",
              width: "100%",
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#888" }}>Looking for</label>
                <select className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: "#e5e5e5", color: "#333" }}>
                  <option>Bride</option>
                  <option>Groom</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#888" }}>Age Range</label>
                <select className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: "#e5e5e5", color: "#333" }}>
                  <option>21 to 25</option>
                  <option>26 to 30</option>
                  <option>31 to 35</option>
                  <option>36+</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "#888" }}>Religion</label>
                <select className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{ borderColor: "#e5e5e5", color: "#333" }}>
                  <option value="">Any Religion</option>
                  <option>Hindu</option>
                  <option>Christian</option>
                  <option>Sikh</option>
                  <option>Muslim</option>
                  <option>Jain</option>
                  <option>Buddhist</option>
                  <option>Other</option>
                </select>
              </div>

              <a
                href="/auth/register"
                className="sheen-btn w-full py-2.5 text-sm font-semibold rounded-lg text-white text-center block"
                style={{ background: "linear-gradient(135deg, #dc1e3c, #a0153c)", letterSpacing: "0.04em" }}
              >
                Find Your Match
              </a>
            </div>
          </div>

          {/* Stats strip */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "24px",
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(8px)",
              borderRadius: "9999px",
              padding: "12px 32px",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            {[
              { val: "100+", label: "Elite Profiles" },
              { val: "UK 🇬🇧", label: "Headquarters" },
              { val: "Est.", label: "2020 🇬🇧" },
              { val: "4.9★", label: "Rated" },
            ].map((s, i, arr) => (
              <span key={s.label} style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                <span>
                  <span style={{ color: "#ffd87a", fontWeight: 700, fontSize: "16px" }}>{s.val}</span>
                  <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "12px", marginLeft: "4px" }}>{s.label}</span>
                </span>
                {i < arr.length - 1 && <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Slide dots — bottom center */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "10px",
            zIndex: 10,
          }}
        >
          {[0, 1, 2, 3].map((dot) => (
            <div
              key={dot}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.4)",
                animationName: `heroDot${dot}`,
                animationDuration: "20s",
                animationIterationCount: "infinite",
                animationTimingFunction: "ease-in-out",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>

        {/* Carousel keyframes — 4 slides, 5s each, 20s total */}
        <style>{`
          @keyframes heroSlide0 {
            0%, 22% { opacity: 1; }
            25%, 97% { opacity: 0; }
            100% { opacity: 1; }
          }
          @keyframes heroSlide1 {
            0%, 22% { opacity: 0; }
            25%, 47% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
          @keyframes heroSlide2 {
            0%, 47% { opacity: 0; }
            50%, 72% { opacity: 1; }
            75%, 100% { opacity: 0; }
          }
          @keyframes heroSlide3 {
            0%, 72% { opacity: 0; }
            75%, 97% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes heroDot0 {
            0%, 22% { background: #fff; transform: scale(1.3); }
            25%, 97% { background: rgba(255,255,255,0.35); transform: scale(1); }
            100% { background: #fff; transform: scale(1.3); }
          }
          @keyframes heroDot1 {
            0%, 22% { background: rgba(255,255,255,0.35); transform: scale(1); }
            25%, 47% { background: #fff; transform: scale(1.3); }
            50%, 100% { background: rgba(255,255,255,0.35); transform: scale(1); }
          }
          @keyframes heroDot2 {
            0%, 47% { background: rgba(255,255,255,0.35); transform: scale(1); }
            50%, 72% { background: #fff; transform: scale(1.3); }
            75%, 100% { background: rgba(255,255,255,0.35); transform: scale(1); }
          }
          @keyframes heroDot3 {
            0%, 72% { background: rgba(255,255,255,0.35); transform: scale(1); }
            75%, 97% { background: #fff; transform: scale(1.3); }
            100% { background: rgba(255,255,255,0.35); transform: scale(1); }
          }

          /* Cinematic Ken Burns zoom on hero images */
          @keyframes kenBurns {
            0%   { transform: scale(1.08) translate3d(0,0,0); filter: saturate(1.05); }
            50%  { transform: scale(1.18) translate3d(-1%, -1%, 0); filter: saturate(1.12); }
            100% { transform: scale(1.08) translate3d(0,0,0); filter: saturate(1.05); }
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

      {/* ── 3b. Trust Strip ─────────────────────────────────────────── */}
      <section style={{ background: "#fff", borderBottom: "1px solid rgba(220,30,60,0.08)", padding: "0 24px" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4" >
          {[
            { icon: "✦", title: "Hand-Picked Profiles", desc: "Every member personally vetted" },
            { icon: "🇬🇧", title: "UK Registered", desc: "Based & regulated in the United Kingdom" },
            { icon: "🔒", title: "Discreet & Private", desc: "Your data is never shared without consent" },
            { icon: "🤝", title: "Personal Advisors", desc: "Real people guiding your journey" },
          ].map((item, i) => (
            <div key={item.title} style={{
              padding: "28px 20px",
              textAlign: "center",
              borderRight: i < 3 ? "1px solid rgba(220,30,60,0.07)" : "none",
            }}>
              <div style={{ fontSize: "22px", marginBottom: "10px" }}>{item.icon}</div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a0a14", marginBottom: "4px", fontFamily: "Playfair Display, serif" }}>{item.title}</p>
              <p style={{ fontSize: "11px", color: "#999", lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. How It Works ──────────────────────────────────────────── */}
      <section id="how-it-works" className="reveal" style={{ padding: "96px 24px", background: "#fdfbf9", position: "relative", overflow: "hidden" }}>
        {/* Subtle background motif */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "700px", height: "700px", borderRadius: "50%", background: "radial-gradient(circle, rgba(220,30,60,0.03) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div className="max-w-5xl mx-auto" style={{ position: "relative" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "72px", flexWrap: "wrap", gap: "24px" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.2em", display: "block", marginBottom: "12px" }}>Your Journey</span>
              <h2 className="font-playfair" style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, color: "#1a0a14", lineHeight: 1.1, margin: 0 }}>
                From First Step to <span style={{ color: "#dc1e3c", fontFamily: "var(--font-great-vibes)", fontSize: "clamp(40px, 5vw, 64px)", fontStyle: "normal", fontWeight: 400 }}>Forever</span>
              </h2>
            </div>
            <a href="/auth/register" style={{
              display: "inline-block", background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
              color: "#fff", padding: "14px 32px", borderRadius: "9999px",
              fontSize: "14px", fontWeight: 600, textDecoration: "none",
              boxShadow: "0 4px 20px rgba(220,30,60,0.25)", whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              Begin Your Journey →
            </a>
          </div>

          {/* Steps — horizontal layout */}
          <div style={{ position: "relative" }}>
            {/* Horizontal connecting line */}
            <div style={{
              position: "absolute",
              top: "32px",
              left: "calc(12.5%)",
              right: "calc(12.5%)",
              height: "1px",
              background: "linear-gradient(to right, rgba(220,30,60,0.2), rgba(220,30,60,0.5), rgba(220,30,60,0.2))",
            }} />

            <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: "0", position: "relative" }}>
              {[
                { num: "01", title: "Tell Us About You",       desc: "Create your profile. Every profile is personally reviewed before going live.", tag: "Profile" },
                { num: "02", title: "We Do the Matching",      desc: "Our advisors hand-pick compatible profiles. No algorithms, no endless swiping.", tag: "Matching" },
                { num: "03", title: "Connect with Discretion", desc: "Express interest privately. Your details are shared only with mutual consent.", tag: "Connection" },
                { num: "04", title: "Begin Forever",           desc: "Meet families and take the next step, with our advisors guiding you throughout.", tag: "Forever" },
              ].map((step, i) => (
                <div key={step.num} style={{ padding: "0 24px 0", textAlign: "center" }}>
                  {/* Circle */}
                  <div style={{
                    width: "64px", height: "64px", borderRadius: "50%",
                    background: "#fff",
                    border: "2px solid #dc1e3c",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 24px",
                    boxShadow: "0 4px 24px rgba(220,30,60,0.12)",
                    position: "relative", zIndex: 1,
                  }}>
                    <span className="font-playfair" style={{ fontSize: "18px", fontWeight: 700, color: "#dc1e3c" }}>{step.num}</span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.15em", display: "block", marginBottom: "8px" }}>{step.tag}</span>
                  <h3 className="font-playfair" style={{ fontSize: "18px", fontWeight: 700, color: "#1a0a14", marginBottom: "10px", lineHeight: 1.3 }}>{step.title}</h3>
                  <p style={{ fontSize: "13px", color: "#777", lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5b. Featured Profiles Teaser ─────────────────────────────── */}
      <section className="reveal" style={{ padding: "80px 24px", background: "#fff" }}>
        <div className="max-w-5xl mx-auto">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.15em" }}>Exclusively Curated</span>
            <h2 className="font-playfair" style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 700, color: "#1a0a14", marginTop: "12px", marginBottom: "12px" }}>A Glimpse of Our Members</h2>
            <p style={{ color: "#888", fontSize: "14px", maxWidth: "480px", margin: "0 auto" }}>Register to view full profiles. Every member is personally verified and approved by our team.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6" style={{ marginBottom: "40px" }}>
            {[
              { age: "28", city: "London", profession: "Doctor", religion: "Hindu", gender: "F" },
              { age: "31", city: "Birmingham", profession: "Barrister", religion: "Hindu", gender: "M" },
              { age: "26", city: "Manchester", profession: "Engineer", religion: "Muslim", gender: "F" },
            ].map((p, i) => (
              <div key={i} style={{
                background: "#fdfbf9",
                borderRadius: "20px",
                overflow: "hidden",
                border: "1px solid rgba(220,30,60,0.08)",
                boxShadow: "0 2px 20px rgba(26,10,20,0.05)",
                position: "relative",
              }}>
                {/* Blurred avatar */}
                <div style={{
                  height: "180px",
                  background: `linear-gradient(135deg, ${i === 1 ? "#3b3fa0" : "#dc1e3c"}22, ${i === 1 ? "#dc1e3c" : "#3b3fa0"}11)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}>
                  <div style={{
                    width: "80px", height: "80px", borderRadius: "50%",
                    background: `linear-gradient(135deg, ${i === 1 ? "#3b3fa0" : "#dc1e3c"}44, rgba(255,255,255,0.2))`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "32px",
                  }}>
                    {p.gender === "F" ? "👩" : "👨"}
                  </div>
                  {/* Blur overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    backdropFilter: "blur(8px)",
                    background: "rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      background: "rgba(255,255,255,0.9)",
                      borderRadius: "9999px",
                      padding: "6px 16px",
                      fontSize: "11px", fontWeight: 600, color: "#dc1e3c",
                      letterSpacing: "0.05em",
                    }}>
                      🔒 Register to View
                    </div>
                  </div>
                </div>
                <div style={{ padding: "20px" }}>
                  <p className="font-playfair" style={{ fontSize: "16px", fontWeight: 700, color: "#1a0a14", marginBottom: "6px" }}>
                    {p.age} yrs &nbsp;·&nbsp; {p.city}
                  </p>
                  <p style={{ fontSize: "13px", color: "#777", marginBottom: "4px" }}>🎓 {p.profession}</p>
                  <p style={{ fontSize: "13px", color: "#777" }}>🕊 {p.religion}</p>
                  <span style={{
                    display: "inline-block", marginTop: "10px",
                    fontSize: "11px", fontWeight: 600, color: "#dc1e3c",
                    background: "rgba(220,30,60,0.07)", borderRadius: "9999px",
                    padding: "3px 10px",
                  }}>✓ Verified</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <Link href="/auth/register" style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
              color: "#fff", padding: "14px 40px", borderRadius: "9999px",
              fontSize: "14px", fontWeight: 600, textDecoration: "none",
              boxShadow: "0 4px 20px rgba(220,30,60,0.25)",
            }}>
              Register to View Profiles
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. Success Stories ────────────────────────────────────────── */}
      <section id="success-stories" className="reveal py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-sm font-medium tracking-wide uppercase" style={{ color: "#dc1e3c" }}>Real Love Stories</span>
            <h2 className="font-playfair text-3xl sm:text-4xl font-bold mt-2" style={{ color: "#1a0a14" }}>They Found Each Other Here</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stories.map((story) => (
              <div key={story.names} className="warm-card overflow-hidden">
                <img
                  src={story.img}
                  alt={story.names}
                  className="w-full object-cover"
                  style={{ aspectRatio: "16/10", objectPosition: "top" }}
                />
                <div className="p-6">
                  <div className="flex items-center gap-1 mb-3">
                    {[1,2,3,4,5].map((s) => (
                      <span key={s} style={{ color: "#f59e0b", fontSize: "14px" }}>★</span>
                    ))}
                  </div>
                  <p className="text-sm italic mb-4" style={{ color: "#666", lineHeight: 1.8 }}>
                    &ldquo;{story.quote}&rdquo;
                  </p>
                  <p className="font-playfair font-semibold" style={{ color: "#1a0a14", fontSize: "17px" }}>{story.names}</p>
                  <p style={{ fontSize: "12px", color: "#999", marginTop: "2px" }}>📍 {story.location}</p>
                  <span className="inline-block mt-3 text-xs px-3 py-1 rounded-full font-medium" style={{ backgroundColor: "rgba(220,30,60,0.08)", color: "#dc1e3c" }}>
                    {story.year}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Why Us / Features ──────────────────────────────────────── */}
      <section className="reveal py-20 px-4 sm:px-6 section-cream">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-sm font-medium tracking-wide uppercase" style={{ color: "#dc1e3c" }}>Why We Are Different</span>
            <h2 className="font-playfair text-3xl sm:text-4xl font-bold mt-2" style={{ color: "#1a0a14" }}>The Elite Difference</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <img
              src="/images/why-different.jpg"
              alt="Why We Are Different"
              className="w-full rounded-2xl object-cover"
              style={{ aspectRatio: "4/3", boxShadow: "0 12px 40px rgba(102,69,28,0.1)" }}
            />

            <div className="space-y-6">
              {features.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: "#dc1e3c" }}
                  >
                    ✓
                  </div>
                  <div>
                    <h3 className="font-playfair font-semibold text-lg" style={{ color: "#1a0a14" }}>{f.title}</h3>
                    <p className="text-sm mt-1" style={{ color: "#555" }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 8b. Trusted By ───────────────────────────────────────────── */}
      <section style={{ padding: "48px 24px", background: "#fdfbf9", borderTop: "1px solid rgba(220,30,60,0.06)" }}>
        <div className="max-w-5xl mx-auto">
          <p style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "28px" }}>
            Trusted by families across the world
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px 32px" }}>
            {["🇬🇧 United Kingdom", "🇺🇸 United States", "🇮🇳 India", "🇨🇦 Canada", "🇩🇪 Germany", "🇦🇺 Australia", "🇦🇪 UAE", "🇸🇬 Singapore", "🇳🇿 New Zealand", "🇫🇷 France"].map((city) => (
              <span key={city} style={{
                fontSize: "13px", fontWeight: 600, color: "#999",
                padding: "6px 16px",
                border: "1px solid rgba(220,30,60,0.12)",
                borderRadius: "9999px",
                background: "#fff",
              }}>
                {city}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8c. FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="reveal" style={{ padding: "80px 24px", background: "#fff" }}>
        <div className="max-w-3xl mx-auto">
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.15em" }}>Common Questions</span>
            <h2 className="font-playfair" style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 700, color: "#1a0a14", marginTop: "12px" }}>Frequently Asked</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              {
                q: "How is Match4Marriage different from other matrimony sites?",
                a: "We are a boutique service, not a mass-market platform. Every profile is hand-picked and personally vetted by our team. We focus on quality introductions, not volume.",
              },
              {
                q: "How does the matching process work?",
                a: "Once you register, our advisors review your profile and preferences. We personally curate compatible introductions for you. No swiping, no endless browsing. Just meaningful, considered matches.",
              },
              {
                q: "Is my information kept private?",
                a: "Absolutely. Your contact details and personal information are never shared without your explicit consent. All data is handled in compliance with UK GDPR regulations.",
              },
              {
                q: "How long does it typically take to find a match?",
                a: "Every journey is unique. Some of our members have found their match within weeks; others take a few months. We guide you at every stage and never rush the process.",
              },
              {
                q: "Do you serve families outside the UK?",
                a: "Yes. While our primary focus is the British Indian community, we connect families globally, including India, UAE, Canada, Australia, and the USA.",
              },
            ].map((faq, i) => (
              <details key={i} style={{
                borderBottom: "1px solid rgba(220,30,60,0.08)",
                padding: "0",
              }}>
                <summary style={{
                  padding: "20px 0",
                  fontSize: "15px", fontWeight: 600, color: "#1a0a14",
                  cursor: "pointer", listStyle: "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  {faq.q}
                  <span style={{ color: "#dc1e3c", fontSize: "20px", flexShrink: 0, marginLeft: "16px" }}>+</span>
                </summary>
                <p style={{ padding: "0 0 20px", fontSize: "14px", color: "#777", lineHeight: 1.8, margin: 0 }}>
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>



      {/* ── 8d. Contact / Enquiry ────────────────────────────────────── */}
      <section id="contact" className="reveal" style={{ padding: "80px 24px", background: "#fdfbf9" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.15em" }}>Get in Touch</span>
            <h2 className="font-playfair" style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 700, color: "#1a0a14", marginTop: "12px", marginBottom: "16px" }}>
              Speak to Our Team
            </h2>
            <p style={{ color: "#777", fontSize: "15px", lineHeight: 1.8, marginBottom: "32px" }}>
              Have a question? Want to learn more before registering? Our advisors are here to help, no pressure, just a friendly conversation.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { icon: "✉️", label: "Email Us", value: "enquiry@match4marriage.com", href: "mailto:enquiry@match4marriage.com" },
                { icon: "📞", label: "Call Us", value: "+44 7476 212655", href: "tel:+447476212655" },
                { icon: "💬", label: "WhatsApp", value: "Message us on WhatsApp", href: "https://wa.me/447476212655" },
              ].map((c) => (
                <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "16px", textDecoration: "none" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "12px",
                    background: c.label === "WhatsApp" ? "rgba(37,211,102,0.1)" : "rgba(220,30,60,0.07)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", flexShrink: 0,
                  }}>
                    {c.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{c.label}</p>
                    <p style={{ fontSize: "14px", color: c.label === "WhatsApp" ? "#25d366" : "#1a0a14", fontWeight: 600, margin: 0 }}>{c.value}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
          <div style={{
            background: "#fff",
            borderRadius: "20px",
            padding: "36px",
            boxShadow: "0 4px 32px rgba(26,10,20,0.08)",
            border: "1px solid rgba(220,30,60,0.08)",
          }}>
            <h3 className="font-playfair" style={{ fontSize: "20px", fontWeight: 700, color: "#1a0a14", marginBottom: "24px" }}>Send an Enquiry</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {["Your Name", "Email Address", "Phone Number"].map((field) => (
                <input
                  key={field}
                  type="text"
                  placeholder={field}
                  style={{
                    width: "100%", padding: "12px 16px",
                    border: "1px solid rgba(220,30,60,0.15)",
                    borderRadius: "10px", fontSize: "14px",
                    color: "#1a0a14", background: "#fdfbf9",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              ))}
              <textarea
                placeholder="Your message (optional)"
                rows={3}
                style={{
                  width: "100%", padding: "12px 16px",
                  border: "1px solid rgba(220,30,60,0.15)",
                  borderRadius: "10px", fontSize: "14px",
                  color: "#1a0a14", background: "#fdfbf9",
                  outline: "none", resize: "none", boxSizing: "border-box",
                }}
              />
              <button style={{
                background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                color: "#fff", padding: "14px",
                borderRadius: "10px", fontSize: "14px",
                fontWeight: 600, border: "none", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(220,30,60,0.25)",
              }}>
                Send Enquiry
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Community Stats Banner ────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6" style={{ background: "linear-gradient(to right, #dc1e3c, #3b3fa0)" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          {[
            { num: "100+", label: "Elite Verified Profiles" },
            { num: "🇬🇧 UK", label: "Headquarters" },
            { num: "Est. 2020", label: "Established" },
            { num: "4.9★", label: "Client Satisfaction" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl sm:text-4xl font-bold font-playfair">{stat.num}</p>
              <p className="text-sm mt-1 opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 10. CTA Section ──────────────────────────────────────────── */}
      <section className="reveal py-24 px-4 sm:px-6 section-cream text-center relative overflow-hidden">
        {/* Decorative rings */}
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full border-2 opacity-10 pointer-events-none" style={{ borderColor: "#dc1e3c" }} />
        <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full border-2 opacity-10 pointer-events-none" style={{ borderColor: "#dc1e3c" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border opacity-5 pointer-events-none" style={{ borderColor: "#dc1e3c" }} />

        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="font-playfair text-3xl sm:text-5xl font-bold mb-4" style={{ color: "#1a0a14" }}>
            Begin Your Journey Today
          </h2>
          <p className="text-lg mb-8" style={{ color: "#555" }}>
            Join the UK&apos;s most trusted boutique Indian matrimonial service, where every connection is personal, verified, and meaningful.
          </p>
          <div className="flex justify-center">
            <Link href="/auth/register" className="btn-gold px-10 py-3 text-base">
              Register to View Profiles
            </Link>
          </div>
        </div>
      </section>

      {/* ── 11. Footer ───────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: "#1a0a14", padding: "48px 24px 24px" }}>
        <div style={{ maxWidth: "1152px", margin: "0 auto" }}>

          {/* Main row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "48px", marginBottom: "36px", alignItems: "start" }}>

            {/* Brand */}
            <div>
              <span className="font-playfair" style={{ fontSize: "22px", fontWeight: 700, color: "#fff" }}>
                Match<span style={{ color: "#dc1e3c" }}>4</span>Marriage
              </span>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, margin: "12px 0 16px", maxWidth: "280px" }}>
                Elite Indian Matrimony, UK registered, connecting the global Indian community with trust and discretion.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                {[
                  { label: "Facebook", icon: "f", href: "https://www.facebook.com/profile.php?id=61579547022417" },
                  { label: "Instagram", icon: "ig", href: "https://www.instagram.com/match4marriage_uk_matrimony" },
                ].map((s) => (
                  <a key={s.label} href={s.href} title={s.label} target="_blank" rel="noopener noreferrer" style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)",
                    textDecoration: "none",
                  }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "14px" }}>Links</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Home", href: "/" },
                  { label: "Browse Profiles", href: "/profiles" },
                  { label: "Success Stories", href: "/success-stories" },
                  { label: "About Us", href: "/about" },
              { label: "Pricing", href: "/pricing" },
                ].map((link) => (
                  <a key={link.label} href={link.href} style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "14px" }}>Legal</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Cookie Policy", href: "#" },
                  { label: "GDPR", href: "#" },
                ].map((link) => (
                  <a key={link.label} href={link.href} style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "14px" }}>Contact</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <a href="mailto:enquiry@match4marriage.com" style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>✉️ enquiry@match4marriage.com</a>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", margin: 0 }}>📍 Solihull, England, B92 7AF</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", margin: 0 }}>Co. No. 15272378</p>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "20px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", margin: 0 }}>
              © 2026 Match4Marriage Limited. All rights reserved. Registered in England & Wales.
            </p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", margin: 0 }}>🔒 SSL Secured · GDPR Compliant</p>
          </div>

        </div>
      </footer>
    </div>
  );
}
