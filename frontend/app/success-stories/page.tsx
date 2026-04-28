"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Heart, ArrowRight, Sparkles, Star, MapPin, AlertCircle, Loader2,
} from "lucide-react";
import { successStoriesApi, ApiError } from "@/lib/api";
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

export default function SuccessStoriesPage() {
  const [stories, setStories] = useState<RemoteStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await successStoriesApi.listPublic(24);
      const list = ((res.data as any)?.data ?? res.data ?? []) as RemoteStory[];
      setStories(list);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : "Could not load stories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="min-h-screen" style={{ background: "#fdfbf9" }}>
      <PublicHeader />

      {/* Editorial hero */}
      <section className="px-6 pb-10 pt-16 lg:pt-24">
        <div className="mx-auto max-w-[760px] text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 ring-1 ring-rose-100">
            <Heart className="h-6 w-6 text-rose-700" strokeWidth={1.6} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700/80">
            Real love stories
          </p>
          <h1 className="font-display mt-2 text-[34px] font-semibold leading-tight text-[#1a0a14] sm:text-[44px]">
            Stories told by the couples themselves
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#6a5560]">
            We honour our members' privacy — every story below is shared with explicit consent. A glimpse of journeys that began here.
          </p>
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <section className="px-6 pb-20">
          <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-rose-100/70 bg-white shadow-[0_2px_14px_rgba(220,30,60,0.05)]">
                <div className="m4m-skeleton h-[220px] rounded-none" />
                <div className="p-5">
                  <div className="m4m-skeleton mb-2 h-4 w-2/3" />
                  <div className="m4m-skeleton mb-2 h-3 w-full" />
                  <div className="m4m-skeleton h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Error */}
      {!loading && error && (
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-[680px] rounded-3xl border border-rose-100/70 bg-white px-6 py-12 text-center shadow-[0_2px_14px_rgba(220,30,60,0.05)]">
            <AlertCircle className="mx-auto h-9 w-9 text-rose-700/60" />
            <h3 className="font-display mt-3 text-[18px] font-semibold text-[#1a0a14]">Couldn't load success stories</h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#6a5560]">{error}</p>
            <button
              onClick={load}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(220,30,60,0.28)] hover:shadow-[0_10px_26px_rgba(220,30,60,0.38)]"
            >
              <Loader2 className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </section>
      )}

      {/* Empty state — backend is wired but admin hasn't published any yet */}
      {!loading && !error && stories.length === 0 && (
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-[680px] rounded-3xl border border-rose-100/70 bg-white px-6 py-16 text-center shadow-[0_2px_14px_rgba(220,30,60,0.05)]">
            <Sparkles className="mx-auto h-9 w-9 text-rose-700/60" />
            <h3 className="font-display mt-3 text-[20px] font-semibold text-[#1a0a14]">
              Stories arriving soon
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#6a5560]">
              We're collecting stories from couples who've found each other here, with their consent. New stories arrive every month. Our advisors can also connect you with members who've offered to share their experience on a private call.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(220,30,60,0.28)] hover:shadow-[0_10px_26px_rgba(220,30,60,0.38)]"
              >
                <Sparkles className="h-3.5 w-3.5" /> Speak to an advisor
              </Link>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-100 hover:bg-rose-50"
              >
                Begin private intake <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Stories grid */}
      {!loading && !error && stories.length > 0 && (
        <section className="px-6 pb-24">
          <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((s, i) => (
              <article
                key={s.id}
                className="fade-in-up group flex flex-col overflow-hidden rounded-3xl border border-rose-100/70 bg-white shadow-[0_2px_14px_rgba(220,30,60,0.05)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(160,21,60,0.16)]"
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                {/* Photo */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-rose-50 to-amber-50">
                  {s.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={s.photo_url}
                      alt={s.couple_names}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Heart className="h-10 w-10 text-rose-300" strokeWidth={1.4} />
                    </div>
                  )}
                  {/* Bottom darken for overlay legibility */}
                  <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 55%, rgba(20,8,14,0.55) 100%)" }} />
                  {/* Year badge */}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-rose-700 backdrop-blur" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}>
                    <Sparkles className="h-3 w-3" /> Married {s.year_married}
                  </span>
                  {/* Five stars over photo bottom — universal at this product tier */}
                  <div className="absolute bottom-3 left-3 inline-flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-3 w-3 text-[#f0b340]" fill="#f0b340" />
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-5">
                  {s.quote && (
                    <p className="font-display-alt mb-3 text-[14.5px] italic leading-[1.7] text-[#1a0a14]/80">
                      &ldquo;{s.quote}&rdquo;
                    </p>
                  )}
                  <p className="font-display text-[18px] font-semibold leading-tight text-[#1a0a14]">
                    {s.couple_names}
                  </p>
                  {s.location && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-[#6a5560]">
                      <MapPin className="h-3 w-3" /> {s.location}
                    </p>
                  )}
                  {/* Headline as kicker */}
                  <p className="mt-2 text-[13px] font-medium uppercase tracking-[0.12em] text-rose-700/70">
                    {s.headline}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_8px_22px_rgba(220,30,60,0.32)] transition-all hover:shadow-[0_12px_28px_rgba(220,30,60,0.40)]"
            >
              <Sparkles className="h-4 w-4" /> Begin your story
            </Link>
          </div>
        </section>
      )}

      <PublicFooter />
    </main>
  );
}
