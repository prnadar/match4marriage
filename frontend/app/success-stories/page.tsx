"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, MapPin, AlertCircle, Loader2, Quote,
} from "lucide-react";
import { successStoriesApi } from "@/lib/api";
import { featuredStories, monogramFor } from "@/lib/featured-stories";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

interface RemoteStory {
  id: string;
  couple_names: string;
  location?: string | null;
  year_married: number;
  headline: string;
  body: string;
  quote?: string | null;
  photo_url?: string | null;
  sort_order: number;
}

// Convert the shared featured list into the RemoteStory shape so the same
// card markup renders both. Featured ones get negative sort_order so they
// always appear first.
const FEATURED_AS_REMOTE: RemoteStory[] = featuredStories.map((s, i) => ({
  id: `featured-${i}`,
  couple_names: s.names,
  location: s.location,
  year_married: s.yearNumber,
  headline: "",
  body: "",
  quote: s.quote,
  photo_url: s.img,
  sort_order: -1000 + i,
}));

export default function SuccessStoriesPage() {
  const [stories, setStories] = useState<RemoteStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await successStoriesApi.listPublic(24);
      const list = ((res.data as any)?.data ?? res.data ?? []) as RemoteStory[];
      // Skip backend entries that duplicate a featured couple's name.
      const featuredNames = new Set(FEATURED_AS_REMOTE.map((s) => s.couple_names));
      const remoteOnly = list.filter((s) => !featuredNames.has(s.couple_names));
      setStories([...FEATURED_AS_REMOTE, ...remoteOnly]);
    } catch {
      // API unavailable — still show the featured stories so the page is
      // never empty.
      setStories(FEATURED_AS_REMOTE);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Editorial reveal
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
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [stories]);

  return (
    <main style={{ minHeight: "100vh", background: "#fdf9f4", color: "#1a0a14" }}>
      <PublicHeader />

      {/* ── Editorial hero ───────────────────────────────────── */}
      <section style={{ padding: "clamp(64px, 9vw, 120px) 24px clamp(48px, 6vw, 72px)", background: "linear-gradient(180deg, #fdf9f4 0%, #faf3eb 100%)" }}>
        <div className="max-w-4xl mx-auto" style={{ textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#a78a8f", marginBottom: 24 }}>
            <span style={{ width: 28, height: 1, background: "rgba(220,30,60,0.4)" }} />
            Real love stories
            <span style={{ width: 28, height: 1, background: "rgba(220,30,60,0.4)" }} />
          </span>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(28px, 4vw, 52px)",
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              marginBottom: 20,
            }}
          >
            Stories told by{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              the couples themselves.
            </span>
          </h1>
          <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", lineHeight: 1.7, color: "#4a3a40", maxWidth: 580, margin: "0 auto" }}>
            We honour our members&apos; privacy. Every story is shared with
            explicit consent. A glimpse of journeys that began here.
          </p>
        </div>
      </section>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <section style={{ padding: "0 24px clamp(72px, 9vw, 112px)" }}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 32 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                <div className="m4m-skeleton" style={{ aspectRatio: "4 / 5", borderRadius: 4, marginBottom: 20 }} />
                <div className="m4m-skeleton" style={{ height: 12, width: "40%", marginBottom: 12 }} />
                <div className="m4m-skeleton" style={{ height: 22, width: "70%", marginBottom: 14 }} />
                <div className="m4m-skeleton" style={{ height: 14, width: "100%", marginBottom: 8 }} />
                <div className="m4m-skeleton" style={{ height: 14, width: "85%" }} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {!loading && error && (
        <section style={{ padding: "0 24px clamp(72px, 9vw, 112px)" }}>
          <div className="max-w-2xl mx-auto" style={{
            padding: "40px 32px",
            border: "1px solid rgba(26,10,20,0.10)",
            borderRadius: 4,
            background: "#fdf9f4",
            textAlign: "center",
          }}>
            <AlertCircle size={28} strokeWidth={1.4} style={{ color: "#dc1e3c", margin: "0 auto 12px", opacity: 0.7 }} />
            <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "#1a0a14", marginBottom: 8, letterSpacing: "-0.01em" }}>
              We couldn&apos;t load the stories
            </h3>
            <p style={{ fontSize: 14, color: "#88787f", lineHeight: 1.6, marginBottom: 20 }}>{error}</p>
            <button
              onClick={load}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#1a0a14", color: "#fdf9f4",
                padding: "12px 24px", borderRadius: 9999,
                fontSize: 13, fontWeight: 600, border: 0, cursor: "pointer", letterSpacing: "0.02em",
              }}
            >
              <Loader2 size={14} strokeWidth={2} /> Retry
            </button>
          </div>
        </section>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!loading && !error && stories.length === 0 && (
        <section style={{ padding: "0 24px clamp(72px, 9vw, 120px)" }}>
          <div className="max-w-2xl mx-auto" style={{ textAlign: "center", padding: "48px 24px" }}>
            <Quote size={32} strokeWidth={1} style={{ color: "#dc1e3c", opacity: 0.4, margin: "0 auto 16px" }} />
            <h3
              className="font-display-alt"
              style={{
                fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                fontStyle: "italic",
                fontSize: "clamp(22px, 2.6vw, 30px)",
                color: "#1a0a14",
                lineHeight: 1.5,
                marginBottom: 24,
                fontWeight: 500,
              }}
            >
              The first stories are being written.
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "#4a3a40", marginBottom: 32, maxWidth: 540, margin: "0 auto 32px" }}>
              We&apos;re collecting stories from couples who found each other here, with their consent. New ones arrive every month. Our advisors can also connect you with members who have offered to share their experience on a private call.
            </p>
            <div style={{ display: "inline-flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/contact" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#1a0a14", color: "#fdf9f4",
                padding: "14px 28px", borderRadius: 9999,
                fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em",
              }}>
                Speak to an advisor <ArrowRight size={15} strokeWidth={2} />
              </Link>
              <Link href="/auth/register" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 28px",
                border: "1px solid rgba(26,10,20,0.20)",
                borderRadius: 9999,
                fontSize: 14, fontWeight: 600, color: "#1a0a14", textDecoration: "none",
              }}>
                Find your forever
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Stories grid ─────────────────────────────────────── */}
      {!loading && !error && stories.length > 0 && (
        <section style={{ padding: "0 24px clamp(72px, 9vw, 120px)" }}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 48 }}>
            {stories.map((s) => (
              <article key={s.id} className="editorial-reveal" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 4, marginBottom: 20, background: "linear-gradient(135deg, #faf3eb 0%, #f4e0e6 100%)", position: "relative" }}>
                  {/* Monogram tile shows through if photo is missing or fails to load. */}
                  <div aria-hidden style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                    fontStyle: "italic", fontSize: 72, fontWeight: 500,
                    color: "rgba(220,30,60,0.30)", letterSpacing: "0.04em",
                  }}>
                    {monogramFor(s.couple_names)}
                  </div>
                  {s.photo_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={s.photo_url}
                      alt={s.couple_names}
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }}
                    />
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#a78a8f", marginBottom: 10 }}>
                  Married {s.year_married}{s.location ? ` · ${s.location}` : ""}
                </span>
                <h3 className="font-display" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em", color: "#1a0a14", marginBottom: 14 }}>
                  {s.couple_names}
                </h3>
                {s.headline && (
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#dc1e3c", letterSpacing: "0.04em", marginBottom: 12 }}>
                    {s.headline}
                  </p>
                )}
                {s.quote && (
                  <>
                    <Quote size={18} strokeWidth={1} style={{ color: "#dc1e3c", opacity: 0.55, marginBottom: 8 }} />
                    <p
                      className="font-display-alt"
                      style={{
                        fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                        fontStyle: "italic",
                        fontSize: 17,
                        lineHeight: 1.65,
                        color: "#1a0a14",
                        margin: 0,
                        fontWeight: 500,
                      }}
                    >
                      {s.quote}
                    </p>
                  </>
                )}
                {s.body && (
                  <p style={{ fontSize: 14, color: "#4a3a40", lineHeight: 1.7, marginTop: 12 }}>
                    {s.body}
                  </p>
                )}
                {s.location && (
                  <p style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#88787f", marginTop: 16 }}>
                    <MapPin size={12} strokeWidth={1.8} /> {s.location}
                  </p>
                )}
              </article>
            ))}
          </div>

          <div style={{ marginTop: 80, textAlign: "center" }}>
            <Link href="/auth/register" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#1a0a14", color: "#fdf9f4",
              padding: "14px 32px", borderRadius: 9999,
              fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em",
            }}>
              Begin your story <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>
        </section>
      )}

      <PublicFooter />
    </main>
  );
}
