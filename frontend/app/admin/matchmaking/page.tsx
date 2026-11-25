"use client";

/**
 * Bureau matchmaking.
 *
 * 1. Pick a member → see their top suggested matches (approved, active,
 *    opposite gender), ranked by mutual compatibility from the platform's
 *    matching engine (read-only).
 * 2. Pick a second member (from suggestions or search) → side-by-side
 *    comparison: mutual score, factor breakdown both ways, existing contact.
 * 3. Introduce them: both receive an in-app notification linking to the
 *    other's profile, with an optional personal note. Logged in the audit
 *    log and listed under "Recent introductions" with its outcome.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeftRight, Check, ExternalLink, HeartHandshake, Loader2, MessageCircle,
  Search, Send, Sparkles, X,
} from "lucide-react";
import { PageShell, Button } from "@/components/admin/PageShell";
import { Avatar, EmptyState, Panel, Pill, SkeletonRows, relTime, type Tone } from "@/components/admin/primitives";
import { adminOpsApi, ApiError } from "@/lib/api";
import { planLabel } from "@/lib/plans";
import { useToast } from "@/components/admin/Toast";
import { cn } from "@/lib/utils";

type Member = {
  id: string; name: string; email: string | null; phone: string | null; membership_number: string | null;
  photo_url: string | null; city: string | null; country: string | null; gender: string | null; age: number | null;
  religion: string | null; occupation: string | null; verification_status: string; subscription_tier: string;
  is_active: boolean; is_deleted: boolean;
};
type Suggestion = Member & {
  score: number; a_to_b: number; b_to_a: number; breakdown: Record<string, number>;
  already_interacted: boolean; introduced_at: string | null;
};
type CompareProfile = Member & {
  height_cm: number | null; marital_status: string | null; education_level: string | null; mother_tongue: string | null;
  caste: string | null; diet: string | null; bio: string | null; partner_prefs: Record<string, unknown>;
};
type Compare = {
  a: CompareProfile; b: CompareProfile;
  compatibility: {
    score: number; a_to_b: number; b_to_a: number;
    breakdown_a_to_b: Record<string, number>; breakdown_b_to_a: Record<string, number>;
    breakdown_max: Record<string, number>;
  };
  context: { interests: Array<{ from: string; to: string; status: string; created_at: string | null }>; is_mutual_match: boolean; has_chat: boolean; introduced_at: string | null };
};
type Intro = {
  id: string; created_at: string | null; actor_email: string | null; user_a: string; user_b: string;
  user_a_name: string | null; user_b_name: string | null; score: number | null; note: string | null;
  outcome: "pending" | "interest_sent" | "connected";
};

const FACTOR_LABEL: Record<string, string> = {
  age_preference: "Age vs preference",
  religion: "Religion",
  location: "Location",
  education: "Education",
  marital_status: "Marital status",
  diet_lifestyle: "Diet & lifestyle",
  height_preference: "Height vs preference",
};

const errMsg = (e: unknown) =>
  e instanceof ApiError ? (typeof e.detail === "string" ? e.detail : e.message) : e instanceof Error ? e.message : "Something went wrong";

function scoreTone(s: number): Tone { return s >= 75 ? "good" : s >= 55 ? "warn" : "neutral"; }
function scoreWord(s: number): string { return s >= 80 ? "Excellent" : s >= 70 ? "Strong" : s >= 55 ? "Promising" : "Weak"; }

export default function MatchmakingPage() {
  const { toast } = useToast();
  const [a, setA] = useState<Member | null>(null);
  const [b, setB] = useState<Member | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [poolSize, setPoolSize] = useState(0);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugError, setSugError] = useState<string | null>(null);
  const [includeIntroduced, setIncludeIntroduced] = useState(false);
  const [compare, setCompare] = useState<Compare | null>(null);
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpError, setCmpError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [intros, setIntros] = useState<Intro[] | null>(null);

  const loadIntros = useCallback(async () => {
    try {
      const res = await adminOpsApi.introductions(30);
      setIntros(((res.data as any)?.data) || []);
    } catch { setIntros([]); }
  }, []);
  useEffect(() => { loadIntros(); }, [loadIntros]);

  // Deep link: /admin/matchmaking?member=<id> (from the ⌘K palette).
  useEffect(() => {
    let id: string | null = null;
    try { id = new URLSearchParams(window.location.search).get("member"); } catch { /* ignore */ }
    if (!id) return;
    adminOpsApi.matchSuggestions(id, { limit: 1 })
      .then((res) => { const m = (res.data as any)?.data?.member; if (m) setA(m); })
      .catch((e) => toast("error", errMsg(e)));
  }, [toast]);

  // Suggestions for A
  useEffect(() => {
    if (!a) { setSuggestions(null); return; }
    let cancelled = false;
    setSugLoading(true); setSugError(null);
    adminOpsApi.matchSuggestions(a.id, { limit: 15, include_introduced: includeIntroduced })
      .then((res) => {
        if (cancelled) return;
        const d = (res.data as any)?.data || {};
        setSuggestions(d.suggestions || []);
        setPoolSize(d.pool_size || 0);
      })
      .catch((e) => { if (!cancelled) { setSugError(errMsg(e)); setSuggestions([]); } })
      .finally(() => { if (!cancelled) setSugLoading(false); });
    return () => { cancelled = true; };
  }, [a, includeIntroduced]);

  // Compare A + B
  useEffect(() => {
    setCompare(null); setCmpError(null); setNote("");
    if (!a || !b) return;
    let cancelled = false;
    setCmpLoading(true);
    adminOpsApi.matchCompare(a.id, b.id)
      .then((res) => { if (!cancelled) setCompare((res.data as any)?.data || null); })
      .catch((e) => { if (!cancelled) setCmpError(errMsg(e)); })
      .finally(() => { if (!cancelled) setCmpLoading(false); });
    return () => { cancelled = true; };
  }, [a, b]);

  const introduce = async () => {
    if (!a || !b) return;
    setSending(true);
    try {
      await adminOpsApi.introduce(a.id, b.id, note.trim() || undefined);
      toast("success", `Introduced ${a.name} and ${b.name}`);
      setNote("");
      setCompare((c) => c && { ...c, context: { ...c.context, introduced_at: new Date().toISOString() } });
      setSuggestions((s) => s && s.map((x) => x.id === b.id ? { ...x, introduced_at: new Date().toISOString() } : x));
      loadIntros();
    } catch (e) { toast("error", errMsg(e)); }
    finally { setSending(false); }
  };

  const blockers = useMemo(() => {
    if (!compare) return [] as string[];
    const out: string[] = [];
    for (const p of [compare.a, compare.b]) {
      if (p.verification_status !== "approved") out.push(`${p.name}'s profile isn't approved yet`);
      if (!p.is_active) out.push(`${p.name} is suspended`);
    }
    return out;
  }, [compare]);

  return (
    <PageShell
      title="Matchmaking"
      subtitle="Find strong pairings across the membership and introduce members on the bureau's behalf."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* ── Left: member + suggestions ───────────────────────────────── */}
        <div className="space-y-4">
          <Panel title="Member" description="Who are you finding a match for?">
            {a ? (
              <SelectedMember m={a} onClear={() => { setA(null); setB(null); }} />
            ) : (
              <MemberPicker placeholder="Search by name, email, phone or M4M number" onPick={(m) => { setA(m); if (b?.id === m.id) setB(null); }} autoFocus />
            )}
          </Panel>

          <Panel
            title="Suggested matches"
            description={a ? `Ranked from ${poolSize.toLocaleString("en-GB")} approved, active members` : "Pick a member to see ranked suggestions"}
            actions={a ? (
              <label className="flex items-center gap-1.5 text-[12px] text-muted2-foreground">
                <input type="checkbox" checked={includeIntroduced} onChange={(e) => setIncludeIntroduced(e.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
                Show introduced
              </label>
            ) : undefined}
            bodyClassName="px-2 pb-2"
          >
            {!a ? (
              <EmptyState compact icon={Sparkles} title="No member selected" description="Suggestions use age, religion, location, education, marital status, diet and height preferences — scored both ways." />
            ) : sugLoading ? (
              <div className="px-3"><SkeletonRows rows={5} /></div>
            ) : sugError ? (
              <EmptyState compact icon={AlertTriangle} title="Couldn't load suggestions" description={sugError} />
            ) : !suggestions || suggestions.length === 0 ? (
              <EmptyState compact icon={HeartHandshake} title="No suggestions yet" description="There are no approved, active members of the opposite gender to compare with." />
            ) : (
              <ol className="max-h-[560px] overflow-y-auto" data-admin-scroll>
                {suggestions.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setB(s)}
                      aria-pressed={b?.id === s.id}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                        b?.id === s.id ? "bg-primary/[0.06]" : "hover:bg-secondary/60",
                      )}
                    >
                      <span className="w-4 shrink-0 text-right text-[11.5px] tabular-nums text-muted2-foreground">{i + 1}</span>
                      <Avatar name={s.name} url={s.photo_url} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-[13px] font-medium text-foreground">{s.name}</span>
                          {s.age !== null && <span className="shrink-0 text-[12px] text-muted2-foreground">{s.age}</span>}
                        </div>
                        <div className="truncate text-[12px] text-muted2-foreground">{[s.city || s.country, s.religion, s.occupation].filter(Boolean).join(" · ")}</div>
                        {(s.already_interacted || s.introduced_at) && (
                          <div className="mt-1 flex gap-1">
                            {s.already_interacted && <Pill tone="info">Already in contact</Pill>}
                            {s.introduced_at && <Pill tone="brand">Introduced {relTime(s.introduced_at)}</Pill>}
                          </div>
                        )}
                      </div>
                      <ScoreChip score={s.score} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* ── Right: compare + introduce ──────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          <Panel
            title="Compare & introduce"
            description="Pick a suggestion, or search for any second member"
          >
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[1fr_auto_1fr]">
              <div>
                <div className="mb-1.5 text-[12px] font-medium text-muted2-foreground">Member A</div>
                {a ? <SelectedMember m={a} compact onClear={() => { setA(null); setB(null); }} /> : <MemberPicker placeholder="Search member A" onPick={setA} />}
              </div>
              <button
                type="button"
                onClick={() => { const x = a; setA(b); setB(x); }}
                disabled={!a || !b}
                aria-label="Swap members"
                title="Swap"
                className="mx-auto mt-6 grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-muted2-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
              <div>
                <div className="mb-1.5 text-[12px] font-medium text-muted2-foreground">Member B</div>
                {b ? <SelectedMember m={b} compact onClear={() => setB(null)} /> : <MemberPicker placeholder="Search member B" onPick={(m) => { if (m.id === a?.id) { toast("warning", "Pick a different member"); return; } setB(m); }} />}
              </div>
            </div>

            <div className="mt-5">
              {!a || !b ? (
                <EmptyState compact icon={HeartHandshake} title="Choose two members to compare" description="You'll see their mutual compatibility, how each fits the other's preferences, and whether they're already in touch." />
              ) : cmpLoading ? (
                <div className="flex items-center gap-2 py-10 text-[13px] text-muted2-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Comparing…</div>
              ) : cmpError ? (
                <EmptyState compact icon={AlertTriangle} title="Couldn't compare these members" description={cmpError} />
              ) : compare ? (
                <CompareView c={compare} />
              ) : null}
            </div>
          </Panel>

          {compare && (
            <Panel title="Send introduction" description="Both members get an in-app notification linking to the other's profile.">
              {compare.context.introduced_at && (
                <p className="mb-3 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-[12.5px] text-foreground">
                  These members were introduced {relTime(compare.context.introduced_at)}. Sending again will notify them a second time.
                </p>
              )}
              {blockers.length > 0 && (
                <ul className="mb-3 space-y-1 rounded-lg border border-[color:var(--adm-bad-line)] bg-[color:var(--adm-bad-bg)] px-3 py-2 text-[12.5px] text-foreground">
                  {blockers.map((x) => <li key={x} className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 adm-fg-bad" aria-hidden />{x}</li>)}
                </ul>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor="intro-note" className="mb-1.5 block text-[12px] font-medium text-muted2-foreground">Personal note (optional)</label>
                  <textarea
                    id="intro-note"
                    rows={4}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. You both value family and live in London — we think you'd get on wonderfully."
                    className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted2-foreground focus:border-primary/50 focus:ring-2 focus:ring-ring/20"
                  />
                  <div className="mt-1 text-right text-[11.5px] tabular-nums text-muted2-foreground">{note.length}/500</div>
                </div>
                <div>
                  <div className="mb-1.5 text-[12px] font-medium text-muted2-foreground">Preview · what {compare.a.name.split(" ")[0]} sees</div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <div className="flex gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><HeartHandshake className="h-4 w-4" aria-hidden /></span>
                      <div className="min-w-0 text-[12.5px]">
                        <div className="font-semibold text-foreground">We&apos;d like to introduce you to {compare.b.name.split(" ")[0]}</div>
                        <p className="mt-0.5 text-foreground/80">
                          Our matchmaking team thinks you and {compare.b.name.split(" ")[0]} could be a wonderful match ({compare.compatibility.score}% compatible). Take a look at their profile.
                        </p>
                        {note.trim() && <p className="mt-1.5 text-foreground/80">A note from the team: {note.trim()}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={introduce} loading={sending} disabled={blockers.length > 0}>
                  <Send className="h-3.5 w-3.5" aria-hidden /> Introduce {compare.a.name.split(" ")[0]} &amp; {compare.b.name.split(" ")[0]}
                </Button>
                <span className="text-[12px] text-muted2-foreground">Recorded in the audit log.</span>
              </div>
            </Panel>
          )}

          <Panel title="Recent introductions" description="Made by the team · outcome updates when either member sends an interest" bodyClassName="px-0 pb-0">
            {intros === null ? (
              <div className="px-5 pb-5"><SkeletonRows rows={3} /></div>
            ) : intros.length === 0 ? (
              <EmptyState compact icon={HeartHandshake} title="No introductions yet" description="Introductions you send will be tracked here." />
            ) : (
              <div className="overflow-x-auto" data-admin-scroll>
                <table className="w-full min-w-[620px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-y border-border/60 bg-secondary/40 text-left text-[11.5px] font-medium text-muted2-foreground">
                      <th scope="col" className="px-5 py-2">Members</th>
                      <th scope="col" className="px-3 py-2 text-right">Score</th>
                      <th scope="col" className="px-3 py-2">Outcome</th>
                      <th scope="col" className="px-3 py-2">By</th>
                      <th scope="col" className="px-5 py-2 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intros.map((it) => (
                      <tr key={it.id} className="border-b border-border/40 last:border-0">
                        <td className="px-5 py-2.5">
                          <Link href={`/admin/users/${it.user_a}`} className="text-foreground hover:underline">{it.user_a_name || "Member"}</Link>
                          <span className="text-muted2-foreground"> &amp; </span>
                          <Link href={`/admin/users/${it.user_b}`} className="text-foreground hover:underline">{it.user_b_name || "Member"}</Link>
                          {it.note && <div className="max-w-[360px] truncate text-[12px] text-muted2-foreground" title={it.note}>“{it.note}”</div>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{it.score ?? "—"}%</td>
                        <td className="px-3 py-2.5">
                          {it.outcome === "connected" ? <Pill tone="good"><Check className="h-3 w-3" aria-hidden />Connected</Pill>
                            : it.outcome === "interest_sent" ? <Pill tone="info"><MessageCircle className="h-3 w-3" aria-hidden />Interest sent</Pill>
                            : <Pill>Awaiting</Pill>}
                        </td>
                        <td className="px-3 py-2.5 text-muted2-foreground">{(it.actor_email || "—").split("@")[0]}</td>
                        <td className="px-5 py-2.5 text-right text-muted2-foreground">{relTime(it.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

// ─── Member picker (search combobox) ─────────────────────────────────────────

function MemberPicker({ placeholder, onPick, autoFocus }: { placeholder: string; onPick: (m: Member) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await adminOpsApi.search(term, 8);
        if (!cancelled) { setResults(((res.data as any)?.data?.users || []).filter((m: Member) => !m.is_deleted)); setActive(0); }
      } catch { if (!cancelled) setResults([]); }
      finally { if (!cancelled) setLoading(false); }
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (m: Member) => { onPick(m); setQ(""); setResults([]); setOpen(false); };

  return (
    <div ref={boxRef} className="relative">
      <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted2-foreground" aria-hidden /> : <Search className="h-4 w-4 text-muted2-foreground" aria-hidden />}
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((x) => Math.min(results.length - 1, x + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((x) => Math.max(0, x - 1)); }
            else if (e.key === "Enter" && results[active]) { e.preventDefault(); pick(results[active]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-controls={listId}
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted2-foreground"
        />
      </label>
      <AnimatePresence>
        {open && q.trim().length >= 2 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
            role="listbox"
            id={listId}
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-[0_12px_32px_rgba(26,10,20,0.14)]"
          >
            {!loading && results.length === 0 && <li className="px-3 py-3 text-[12.5px] text-muted2-foreground">No members found</li>}
            {results.map((m, i) => (
              <li key={m.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(m)}
                  className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left", i === active && "bg-secondary")}
                >
                  <Avatar name={m.name} url={m.photo_url} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-foreground">{m.name}{m.age !== null && <span className="text-muted2-foreground"> · {m.age}</span>}</div>
                    <div className="truncate text-[11.5px] text-muted2-foreground">{[m.membership_number, m.city || m.country, m.gender].filter(Boolean).join(" · ")}</div>
                  </div>
                  {m.verification_status !== "approved" && <Pill tone="warn">{m.verification_status === "submitted" ? "Pending" : "Not approved"}</Pill>}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function SelectedMember({ m, onClear, compact }: { m: Member; onClear: () => void; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5">
      <Avatar name={m.name} url={m.photo_url} size={compact ? 32 : 40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link href={`/admin/users/${m.id}`} className="truncate text-[13.5px] font-medium text-foreground hover:underline">{m.name}</Link>
          {m.age !== null && <span className="text-[12px] text-muted2-foreground">{m.age}</span>}
        </div>
        <div className="truncate text-[12px] text-muted2-foreground">
          {[m.gender, m.city || m.country, m.religion].filter(Boolean).join(" · ") || "—"}
        </div>
        {!compact && (
          <div className="mt-1 flex flex-wrap gap-1">
            <Pill tone={m.verification_status === "approved" ? "good" : "warn"}>{m.verification_status === "approved" ? "Approved" : m.verification_status === "submitted" ? "Pending review" : "Not approved"}</Pill>
            {m.subscription_tier !== "free" && <Pill tone="brand">{planLabel(m.subscription_tier)}</Pill>}
            {!m.is_active && <Pill tone="bad">Suspended</Pill>}
          </div>
        )}
      </div>
      <button type="button" onClick={onClear} aria-label={`Clear ${m.name}`} className="grid h-7 w-7 place-items-center rounded-md text-muted2-foreground hover:bg-secondary hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const t = scoreTone(score);
  return (
    <div className="flex w-12 shrink-0 flex-col items-end">
      <span className={cn("text-[15px] font-semibold tabular-nums", t === "good" ? "adm-fg-good" : t === "warn" ? "adm-fg-warn" : "text-muted2-foreground")}>{score}%</span>
      <span className="mt-1 h-1 w-full rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
      </span>
    </div>
  );
}

// ─── Comparison ──────────────────────────────────────────────────────────────

function CompareView({ c }: { c: Compare }) {
  const { compatibility: m } = c;
  const factors = Object.keys(m.breakdown_max);
  const interestsLine = c.context.interests.length
    ? c.context.interests.map((i) => `${i.from === c.a.id ? c.a.name.split(" ")[0] : c.b.name.split(" ")[0]} → ${i.status}`).join(", ")
    : null;

  return (
    <div className="space-y-5">
      {/* Score header */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-secondary/30 p-4 sm:flex-row sm:items-center">
        <div className="flex items-baseline gap-2">
          <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-foreground">{m.score}%</span>
          <Pill tone={scoreTone(m.score)}>{scoreWord(m.score)} match</Pill>
        </div>
        <div className="flex-1 text-[12.5px] text-muted2-foreground sm:text-right">
          <div>{c.a.name.split(" ")[0]} fits {c.b.name.split(" ")[0]}&apos;s preferences: <span className="font-medium tabular-nums text-foreground">{m.b_to_a}%</span></div>
          <div>{c.b.name.split(" ")[0]} fits {c.a.name.split(" ")[0]}&apos;s preferences: <span className="font-medium tabular-nums text-foreground">{m.a_to_b}%</span></div>
        </div>
      </div>

      {(c.context.is_mutual_match || c.context.has_chat || interestsLine) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="text-muted2-foreground">Already in touch:</span>
          {c.context.is_mutual_match && <Pill tone="good">Mutual match</Pill>}
          {c.context.has_chat && <Pill tone="info">Chat open</Pill>}
          {interestsLine && <Pill>{interestsLine}</Pill>}
        </div>
      )}

      {/* Side by side */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[c.a, c.b].map((p) => (
          <div key={p.id} className="rounded-xl border border-border/70 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={p.name} url={p.photo_url} size={44} />
              <div className="min-w-0">
                <Link href={`/admin/users/${p.id}`} className="inline-flex items-center gap-1 text-[14px] font-semibold text-foreground hover:underline">
                  {p.name}<ExternalLink className="h-3 w-3 text-muted2-foreground" aria-hidden />
                </Link>
                <div className="text-[12px] text-muted2-foreground">{[p.age && `${p.age} yrs`, p.gender, p.membership_number].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
              {([
                ["Location", [p.city, p.country].filter(Boolean).join(", ")],
                ["Religion", [p.religion, p.caste].filter(Boolean).join(" · ")],
                ["Marital status", p.marital_status?.replace(/_/g, " ")],
                ["Height", p.height_cm ? `${p.height_cm} cm` : null],
                ["Education", p.education_level],
                ["Occupation", p.occupation],
                ["Mother tongue", p.mother_tongue],
                ["Diet", p.diet],
              ] as Array<[string, string | null | undefined]>).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-muted2-foreground">{k}</dt>
                  <dd className={cn("truncate capitalize", v ? "text-foreground" : "text-muted2-foreground/60")} title={v || undefined}>{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {Object.keys(p.partner_prefs || {}).length > 0 && (
              <div className="mt-3 border-t border-border/60 pt-2 text-[12px] text-muted2-foreground">
                <span className="font-medium text-foreground">Looking for: </span>
                {Object.entries(p.partner_prefs).map(([k, v]) => `${k.replace(/_/g, " ")} ${Array.isArray(v) ? v.join("/") : String(v)}`).join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Factor breakdown */}
      <div className="overflow-x-auto" data-admin-scroll>
        <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
          <caption className="mb-2 text-left text-[12px] font-medium text-muted2-foreground">How the score is built (points earned of max)</caption>
          <thead>
            <tr className="border-b border-border/60 text-left text-[11.5px] text-muted2-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">Factor</th>
              <th scope="col" className="px-3 py-2 font-medium">{c.b.name.split(" ")[0]} for {c.a.name.split(" ")[0]}</th>
              <th scope="col" className="px-3 py-2 font-medium">{c.a.name.split(" ")[0]} for {c.b.name.split(" ")[0]}</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => {
              const max = m.breakdown_max[f] || 1;
              const ab = m.breakdown_a_to_b[f] ?? 0;
              const ba = m.breakdown_b_to_a[f] ?? 0;
              return (
                <tr key={f} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-3 text-foreground">{FACTOR_LABEL[f] || f.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2"><FactorBar value={ab} max={max} /></td>
                  <td className="px-3 py-2"><FactorBar value={ba} max={max} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FactorBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-muted2-foreground"><span className="font-medium text-foreground">{value}</span>/{max}</span>
    </div>
  );
}
