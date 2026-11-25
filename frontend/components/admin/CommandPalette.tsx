"use client";

/**
 * ⌘K command palette for the admin console.
 *
 *  - Jump to any console page (fuzzy-ish match on label + keywords).
 *  - Find members by name, email, phone or membership number (server search,
 *    debounced) and open them, or jump straight to matchmaking for them.
 *  - Find enquiries.
 *  - Remembers the last few members opened from here (per browser).
 *
 * Keyboard: ↑/↓ move, ↵ open, ⌥↵ (or the "Match" button) opens matchmaking for
 * a member, Esc closes. Focus is trapped inside while open.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Heart, Inbox, Loader2, Search, User, type LucideIcon } from "lucide-react";
import { adminOpsApi } from "@/lib/api";
import { planLabel } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Avatar, Kbd, Pill, relTime, type Tone } from "./primitives";

export type PaletteNavItem = { href: string; label: string; icon: LucideIcon; keywords?: string; section?: string };

type Member = {
  id: string; name: string; email: string | null; phone: string | null; membership_number: string | null;
  photo_url: string | null; city: string | null; verification_status: string; subscription_tier: string;
  is_active: boolean; is_deleted: boolean;
};
type EnquiryHit = { id: string; name: string; email: string | null; subject: string | null; status: string; created_at: string | null };

type Item =
  | { kind: "nav"; id: string; nav: PaletteNavItem }
  | { kind: "member"; id: string; member: Member }
  | { kind: "enquiry"; id: string; enquiry: EnquiryHit };

const RECENT_KEY = "m4m-admin-palette-recent";

function readRecent(): Member[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, 5) : [];
  } catch { return []; }
}
function pushRecent(m: Member) {
  try {
    const next = [m, ...readRecent().filter((x) => x.id !== m.id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage unavailable */ }
}

const STATUS_TONE: Record<string, { tone: Tone; label: string }> = {
  approved:  { tone: "good", label: "Approved" },
  submitted: { tone: "warn", label: "Pending" },
  rejected:  { tone: "bad", label: "Rejected" },
  draft:     { tone: "neutral", label: "Draft" },
};

function score(label: string, q: string): number {
  const l = label.toLowerCase();
  if (!q) return 1;
  if (l.startsWith(q)) return 3;
  if (l.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  if (l.includes(q)) return 1;
  return 0;
}

export default function CommandPalette({
  open, onClose, navItems,
}: {
  open: boolean;
  onClose: () => void;
  navItems: PaletteNavItem[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryHit[]>([]);
  const [recent, setRecent] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQ(""); setMembers([]); setEnquiries([]); setActive(0); setError(null);
    setRecent(readRecent());
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  // Debounced server search
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setMembers([]); setEnquiries([]); setLoading(false); return; }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await adminOpsApi.search(term, 8);
        if (cancelled) return;
        const d = (res.data as any)?.data || {};
        setMembers(Array.isArray(d.users) ? d.users : []);
        setEnquiries(Array.isArray(d.enquiries) ? d.enquiries : []);
        setError(null);
      } catch {
        if (!cancelled) setError("Search is unavailable right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const nav = navItems
      .map((n) => ({ n, s: Math.max(score(n.label, term), n.keywords ? score(n.keywords, term) * 0.9 : 0) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, term ? 5 : 8)
      .map(({ n }) => ({ kind: "nav" as const, id: `nav:${n.href}`, nav: n }));
    const out: Array<{ label: string; items: Item[] }> = [];
    if (!term && recent.length) out.push({ label: "Recent members", items: recent.map((m) => ({ kind: "member" as const, id: `recent:${m.id}`, member: m })) });
    if (members.length) out.push({ label: "Members", items: members.map((m) => ({ kind: "member" as const, id: `m:${m.id}`, member: m })) });
    if (enquiries.length) out.push({ label: "Enquiries", items: enquiries.map((e) => ({ kind: "enquiry" as const, id: `e:${e.id}`, enquiry: e })) });
    if (nav.length) out.push({ label: term ? "Pages" : "Go to", items: nav });
    return out;
  }, [q, navItems, members, enquiries, recent]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  useEffect(() => { setActive(0); }, [q, members.length, enquiries.length]);

  const run = useCallback((item: Item, alt = false) => {
    if (item.kind === "nav") router.push(item.nav.href);
    else if (item.kind === "member") {
      pushRecent(item.member);
      router.push(alt ? `/admin/matchmaking?member=${item.member.id}` : `/admin/users/${item.member.id}`);
    } else router.push(`/admin/enquiries?q=${encodeURIComponent(item.enquiry.email || item.enquiry.name)}`);
    onClose();
  }, [router, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = flat[active]; if (it) run(it, e.altKey); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "Tab") { e.preventDefault(); inputRef.current?.focus(); }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let idx = -1;
  const term = q.trim();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]" onKeyDown={onKeyDown}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#1A0A14]/30"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto mt-[10vh] w-[calc(100%-32px)] max-w-[640px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-12px_rgba(26,10,20,0.35)]"
          >
            <div className="flex items-center gap-3 border-b border-border/70 px-4">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted2-foreground" aria-hidden /> : <Search className="h-4 w-4 text-muted2-foreground" aria-hidden />}
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search members, enquiries or jump to a page…"
                aria-label="Search"
                aria-controls="palette-list"
                aria-activedescendant={flat[active] ? `pal-${flat[active].id}` : undefined}
                className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted2-foreground/80"
              />
              <Kbd>Esc</Kbd>
            </div>

            <div ref={listRef} id="palette-list" role="listbox" data-admin-scroll className="max-h-[min(60vh,460px)] overflow-y-auto p-2">
              {error && <p className="px-3 py-2 text-[12.5px] text-[#B42343]">{error}</p>}
              {groups.length === 0 && !loading && (
                <div className="px-3 py-10 text-center">
                  <p className="text-[13px] font-medium text-foreground">No results for “{term}”</p>
                  <p className="mt-1 text-[12px] text-muted2-foreground">Search by full name, email, phone number or membership number (e.g. M4M-2026-12).</p>
                </div>
              )}
              {groups.map((g) => (
                <div key={g.label} className="mb-1">
                  <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-muted2-foreground">{g.label}</div>
                  {g.items.map((it) => {
                    idx += 1;
                    const i = idx;
                    const isActive = i === active;
                    return (
                      <div
                        key={it.id}
                        id={`pal-${it.id}`}
                        data-idx={i}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => setActive(i)}
                        onClick={() => run(it)}
                        className={cn(
                          "group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                          isActive ? "bg-secondary" : "",
                        )}
                      >
                        {it.kind === "nav" && (
                          <>
                            <span className="grid h-7 w-7 place-items-center rounded-md border border-border/70 bg-card text-muted2-foreground">
                              <it.nav.icon className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <span className="flex-1 text-[13.5px] text-foreground">{it.nav.label}</span>
                            {it.nav.section && <span className="text-[11.5px] text-muted2-foreground">{it.nav.section}</span>}
                          </>
                        )}
                        {it.kind === "member" && (
                          <>
                            <Avatar name={it.member.name} url={it.member.photo_url} size={30} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13.5px] font-medium text-foreground">{it.member.name}</span>
                                {it.member.membership_number && (
                                  <span className="shrink-0 text-[11.5px] tabular-nums text-muted2-foreground">{it.member.membership_number}</span>
                                )}
                              </div>
                              <div className="truncate text-[12px] text-muted2-foreground">
                                {[it.member.email, it.member.phone, it.member.city].filter(Boolean).join(" · ") || "No contact details"}
                              </div>
                            </div>
                            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                              {it.member.is_deleted
                                ? <Pill tone="bad">Deleted</Pill>
                                : !it.member.is_active
                                  ? <Pill tone="bad">Suspended</Pill>
                                  : <Pill tone={(STATUS_TONE[it.member.verification_status] || STATUS_TONE.draft).tone}>
                                      {(STATUS_TONE[it.member.verification_status] || STATUS_TONE.draft).label}
                                    </Pill>}
                              {it.member.subscription_tier && it.member.subscription_tier !== "free" && (
                                <Pill tone="brand">{planLabel(it.member.subscription_tier)}</Pill>
                              )}
                            </div>
                            <button
                              type="button"
                              title="Suggest matches for this member (⌥↵)"
                              aria-label={`Suggest matches for ${it.member.name}`}
                              onClick={(e) => { e.stopPropagation(); run(it, true); }}
                              className={cn(
                                "hidden h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11.5px] font-medium text-foreground hover:bg-secondary sm:inline-flex",
                                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                              )}
                            >
                              <Heart className="h-3 w-3" aria-hidden /> Match
                            </button>
                          </>
                        )}
                        {it.kind === "enquiry" && (
                          <>
                            <span className="grid h-7 w-7 place-items-center rounded-md border border-border/70 bg-card text-muted2-foreground">
                              <Inbox className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13.5px] text-foreground">{it.enquiry.name}{it.enquiry.subject ? ` — ${it.enquiry.subject}` : ""}</div>
                              <div className="truncate text-[12px] text-muted2-foreground">{[it.enquiry.email, relTime(it.enquiry.created_at)].filter(Boolean).join(" · ")}</div>
                            </div>
                            <Pill tone={it.enquiry.status === "new" ? "warn" : "neutral"}>{it.enquiry.status.replace(/_/g, " ")}</Pill>
                          </>
                        )}
                        {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted2-foreground" aria-hidden />}
                      </div>
                    );
                  })}
                </div>
              ))}
              {term.length === 1 && (
                <p className="px-3 py-2 text-[12px] text-muted2-foreground">Keep typing to search members…</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 bg-secondary/40 px-4 py-2 text-[11.5px] text-muted2-foreground">
              <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
              <span className="inline-flex items-center gap-1"><Kbd><CornerDownLeft className="h-3 w-3" /></Kbd> open</span>
              <span className="inline-flex items-center gap-1"><Kbd>⌥</Kbd><Kbd><CornerDownLeft className="h-3 w-3" /></Kbd> suggest matches</span>
              <span className="ml-auto hidden items-center gap-1 sm:inline-flex"><User className="h-3 w-3" aria-hidden /> <Kbd>G</Kbd> then <Kbd>V</Kbd> verifications · <Kbd>M</Kbd> matchmaking</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
