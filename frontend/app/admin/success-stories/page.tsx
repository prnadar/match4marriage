"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye, EyeOff, HeartHandshake, PencilLine, Plus, Trash2 } from "lucide-react";
import { PageShell, Button, StatCard } from "@/components/admin/PageShell";
import ConfirmModal from "@/components/admin/ConfirmModal";
import DataTable from "@/components/admin/DataTable";
import { Avatar, EmptyState, ErrorState, Pill, Segmented, formatDate } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/Toast";
import { FormDialog, FormField, INPUT, TEXTAREA, errorMessage } from "@/components/admin/member/shared";
import { successStoriesApi } from "@/lib/api";

type Story = {
  id: string; couple_names: string; location: string | null; year_married: number; headline: string; body: string;
  quote: string | null; photo_url: string | null; photo_key: string | null; is_published: boolean; sort_order: number;
  consent_signed_at: string | null; notes: string | null; created_at: string; updated_at: string;
};
type Filter = "all" | "published" | "draft" | "no_consent";
type Form = {
  couple_names: string; location: string; year_married: string; headline: string; body: string; quote: string;
  photo_url: string; sort_order: string; consent_date: string; notes: string; is_published: boolean;
};

const THIS_YEAR = new Date().getFullYear();
const EMPTY: Form = {
  couple_names: "", location: "", year_married: String(THIS_YEAR), headline: "", body: "", quote: "",
  photo_url: "", sort_order: "0", consent_date: "", notes: "", is_published: false,
};

function toForm(s: Story): Form {
  return {
    couple_names: s.couple_names, location: s.location || "", year_married: String(s.year_married), headline: s.headline,
    body: s.body, quote: s.quote || "", photo_url: s.photo_url || "", sort_order: String(s.sort_order ?? 0),
    consent_date: s.consent_signed_at ? s.consent_signed_at.slice(0, 10) : "", notes: s.notes || "", is_published: s.is_published,
  };
}

function validUrl(v: string): boolean {
  try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}

export default function SuccessStoriesPage() {
  const { toast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const [editing, setEditing] = useState<Story | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "unpublish" | "delete"; story: Story } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await successStoriesApi.listAdmin();
      const rows = (res.data as any)?.data;
      setStories(Array.isArray(rows) ? rows : []);
    } catch (e) { setError(errorMessage(e, "Couldn't load success stories")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all: stories.length,
    published: stories.filter((s) => s.is_published).length,
    draft: stories.filter((s) => !s.is_published).length,
    no_consent: stories.filter((s) => !s.consent_signed_at).length,
  }), [stories]);
  const rows = useMemo(() => stories.filter((s) =>
    filter === "all" ? true : filter === "published" ? s.is_published : filter === "draft" ? !s.is_published : !s.consent_signed_at,
  ), [stories, filter]);

  const openNew = () => { setForm(EMPTY); setTouched(false); setFormError(null); setEditing("new"); };
  const openEdit = (s: Story) => { setForm(toForm(s)); setTouched(false); setFormError(null); setEditing(s); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const year = Number(form.year_married);
  const errs = {
    couple_names: !form.couple_names.trim() ? "Add the couple's names." : null,
    headline: !form.headline.trim() ? "Add a headline." : null,
    body: !form.body.trim() ? "Tell their story." : null,
    year_married: !Number.isInteger(year) || year < 1950 || year > THIS_YEAR + 1 ? `Enter a year between 1950 and ${THIS_YEAR + 1}.` : null,
    photo_url: form.photo_url.trim() && !validUrl(form.photo_url.trim()) ? "Enter a full web address (https://…)." : null,
    consent_date: form.consent_date && form.consent_date > new Date().toISOString().slice(0, 10) ? "The consent date can't be in the future." : null,
    is_published: form.is_published && !form.consent_date ? "Record the date the couple gave written consent before publishing." : null,
  };
  const firstError = Object.values(errs).find(Boolean) || null;
  const show = (k: keyof typeof errs) => (touched ? errs[k] : null);

  const save = async () => {
    setTouched(true);
    if (firstError) { setFormError("Fix the highlighted fields first."); return; }
    setBusy(true); setFormError(null);
    const body = {
      couple_names: form.couple_names.trim(),
      location: form.location.trim() || null,
      year_married: year,
      headline: form.headline.trim(),
      body: form.body.trim(),
      quote: form.quote.trim() || null,
      photo_url: form.photo_url.trim() || null,
      sort_order: Math.max(0, Math.min(9999, Number(form.sort_order) || 0)),
      // Noon UTC so the date reads the same in every timezone.
      consent_signed_at: form.consent_date ? `${form.consent_date}T12:00:00Z` : null,
      notes: form.notes.trim() || null,
      is_published: form.is_published,
    };
    try {
      if (editing === "new") await successStoriesApi.create(body);
      else if (editing) await successStoriesApi.update(editing.id, body);
      toast("success", editing === "new" ? (body.is_published ? "Story published" : "Story saved as a draft") : "Story updated");
      setEditing(null);
      await load();
    } catch (e) { setFormError(errorMessage(e, "The story wasn't saved")); }
    finally { setBusy(false); }
  };

  const publish = async (s: Story) => {
    if (!s.consent_signed_at) {
      toast("warning", "Record the couple's written consent before publishing.");
      openEdit(s);
      return;
    }
    setRowBusy(s.id);
    try { await successStoriesApi.togglePublish(s.id); toast("success", `“${s.couple_names}” is now live on the website`); await load(); }
    catch (e) { toast("error", errorMessage(e, "Couldn't publish the story")); }
    finally { setRowBusy(null); }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, story } = confirm;
    setConfirm(null); setRowBusy(story.id);
    try {
      if (kind === "unpublish") { await successStoriesApi.togglePublish(story.id); toast("success", `“${story.couple_names}” was taken off the website`); }
      else { await successStoriesApi.delete(story.id); toast("success", `“${story.couple_names}” was deleted`); }
      await load();
    } catch (e) { toast("error", errorMessage(e, "That didn't work")); }
    finally { setRowBusy(null); }
  };

  return (
    <PageShell
      title="Success stories"
      subtitle="The couples shown on the public Success Stories page. A story can only go live once the couple's written consent is recorded."
      meta={!loading ? <Pill>{stories.length}</Pill> : undefined}
      actions={
        <>
          <Link href="/success-stories" target="_blank" rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> View public page
          </Link>
          <Button size="sm" variant="primary" onClick={openNew}><Plus className="h-3.5 w-3.5" aria-hidden /> New story</Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Live on the website" value={counts.published} icon={Eye} tone="good" onClick={() => setFilter("published")} />
        <StatCard label="Drafts" value={counts.draft} icon={PencilLine} onClick={() => setFilter("draft")} />
        <StatCard label="Waiting for consent" value={counts.no_consent} icon={HeartHandshake} tone={counts.no_consent > 0 ? "warn" : "neutral"}
          hint="Can't be published yet" onClick={() => setFilter("no_consent")} />
      </div>

      {error ? (
        <ErrorState title="Couldn't load success stories" message={error} onRetry={load} />
      ) : (
        <DataTable<Story>
          data={rows}
          loading={loading}
          rowKey={(s) => s.id}
          searchPlaceholder="Search couple, place or headline…"
          searchKeys={["couple_names", "location", "headline"]}
          filters={
            <Segmented<Filter>
              layoutId="story-filter" ariaLabel="Filter stories" size="sm" value={filter} onChange={setFilter}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "published", label: "Published", count: counts.published },
                { value: "draft", label: "Drafts", count: counts.draft },
                { value: "no_consent", label: "No consent yet", count: counts.no_consent },
              ]}
            />
          }
          emptyState={
            <EmptyState icon={HeartHandshake}
              title={stories.length === 0 ? "No success stories yet" : "Nothing in this group"}
              description={stories.length === 0 ? "Add your first couple. It stays a draft until you record their consent and publish it." : undefined}
              action={stories.length === 0 ? <Button size="sm" variant="primary" onClick={openNew}><Plus className="h-3.5 w-3.5" aria-hidden /> New story</Button> : undefined} />
          }
          columns={[
            {
              key: "couple_names", label: "Couple", sortable: true,
              render: (s) => (
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={s.couple_names} url={s.photo_url} size={36} />
                  <div className="min-w-0">
                    <button type="button" onClick={() => openEdit(s)} className="block max-w-[240px] truncate text-left font-medium text-foreground underline-offset-2 hover:underline">{s.couple_names}</button>
                    <div className="text-[11.5px] text-muted2-foreground">{[s.location, `Married ${s.year_married}`].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              ),
            },
            { key: "headline", label: "Headline", className: "max-w-[320px]", render: (s) => <span className="line-clamp-2 text-[12.5px] text-muted2-foreground">{s.headline}</span> },
            {
              key: "consent_signed_at", label: "Consent", sortable: true, sortValue: (s) => s.consent_signed_at || "",
              render: (s) => s.consent_signed_at
                ? <Pill tone="good">Recorded {formatDate(s.consent_signed_at)}</Pill>
                : <Pill tone="warn">Not recorded</Pill>,
            },
            {
              key: "is_published", label: "Status", sortable: true, sortValue: (s) => (s.is_published ? 1 : 0),
              render: (s) => <Pill tone={s.is_published ? "good" : "neutral"} dot>{s.is_published ? "Published" : "Draft"}</Pill>,
            },
            { key: "sort_order", label: "Order", sortable: true, align: "right" },
            {
              key: "actions", label: "Actions", align: "right",
              render: (s) => (
                <div className="flex justify-end gap-1.5">
                  {s.is_published ? (
                    <Button size="sm" variant="secondary" loading={rowBusy === s.id} onClick={() => setConfirm({ kind: "unpublish", story: s })}>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden /> Unpublish
                    </Button>
                  ) : (
                    <Button size="sm" variant={s.consent_signed_at ? "success" : "secondary"} loading={rowBusy === s.id} onClick={() => publish(s)}
                      title={s.consent_signed_at ? "Show this story on the website" : "Record consent first"}>
                      <Eye className="h-3.5 w-3.5" aria-hidden /> Publish
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)} ariaLabel={`Edit ${s.couple_names}`}><PencilLine className="h-3.5 w-3.5" aria-hidden /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "delete", story: s })} ariaLabel={`Delete ${s.couple_names}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <FormDialog
        open={!!editing} wide
        title={editing === "new" ? "New success story" : "Edit success story"}
        description="Use first names only unless the couple has agreed otherwise."
        onClose={() => { if (!busy) setEditing(null); }} onSubmit={save} busy={busy} error={formError}
        submitLabel={form.is_published ? (editing !== "new" && editing?.is_published ? "Save changes" : "Save & publish") : "Save draft"}
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Couple's names" htmlFor="ss-names" required error={show("couple_names")}>
            <input id="ss-names" value={form.couple_names} maxLength={160} onChange={(e) => set("couple_names", e.target.value)} placeholder="Priya & Arjun" className={INPUT} />
          </FormField>
          <FormField label="Where they live" htmlFor="ss-location">
            <input id="ss-location" value={form.location} maxLength={160} onChange={(e) => set("location", e.target.value)} placeholder="Leicester" className={INPUT} />
          </FormField>
          <FormField label="Year married" htmlFor="ss-year" required error={show("year_married")}>
            <input id="ss-year" type="number" inputMode="numeric" value={form.year_married} min={1950} max={THIS_YEAR + 1} onChange={(e) => set("year_married", e.target.value)} className={INPUT} />
          </FormField>
          <FormField label="Position on the page" htmlFor="ss-order" hint="Lower numbers appear first.">
            <input id="ss-order" type="number" inputMode="numeric" value={form.sort_order} min={0} max={9999} onChange={(e) => set("sort_order", e.target.value)} className={INPUT} />
          </FormField>
        </div>
        <FormField label="Headline" htmlFor="ss-headline" required error={show("headline")}>
          <input id="ss-headline" value={form.headline} maxLength={220} onChange={(e) => set("headline", e.target.value)} placeholder="Two families, one very long first phone call" className={INPUT} />
        </FormField>
        <FormField label="Their story" htmlFor="ss-body" required error={show("body")}>
          <textarea id="ss-body" value={form.body} onChange={(e) => set("body", e.target.value)} className={`${TEXTAREA} min-h-[140px]`} />
        </FormField>
        <FormField label="Quote" htmlFor="ss-quote" hint="A line in the couple's own words — optional.">
          <textarea id="ss-quote" value={form.quote} onChange={(e) => set("quote", e.target.value)} className={TEXTAREA} />
        </FormField>
        <FormField label="Photo web address" htmlFor="ss-photo" error={show("photo_url")} hint="Paste the link to a photo the couple has approved.">
          <div className="flex items-center gap-3">
            <input id="ss-photo" type="url" value={form.photo_url} maxLength={900} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…" className={INPUT} />
            {form.photo_url.trim() && validUrl(form.photo_url.trim()) && <Avatar name={form.couple_names || "?"} url={form.photo_url.trim()} size={36} />}
          </div>
        </FormField>

        <div className="rounded-lg border border-border/70 bg-secondary/30 p-3">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Written consent received on" htmlFor="ss-consent" error={show("consent_date")} hint="Needed before the story can be published.">
              <input id="ss-consent" type="date" value={form.consent_date} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => { set("consent_date", e.target.value); if (!e.target.value) set("is_published", false); }} className={INPUT} />
            </FormField>
            <div className="min-w-0">
              <span className="mb-1 block text-[12px] font-medium text-foreground">Visibility</span>
              <label className="flex items-start gap-2 text-[13px] text-foreground">
                <input type="checkbox" checked={form.is_published} disabled={!form.consent_date}
                  onChange={(e) => set("is_published", e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))] disabled:opacity-50" />
                <span>Show on the public website
                  <span className="block text-[11.5px] text-muted2-foreground">{form.consent_date ? "Untick to keep it as a draft." : "Add the consent date first."}</span></span>
              </label>
              {show("is_published") && <p role="alert" className="adm-fg-bad mt-1 text-[11.5px]">{errs.is_published}</p>}
            </div>
          </div>
        </div>

        <FormField label="Internal notes" htmlFor="ss-notes" hint="Only staff see this — e.g. where the consent form is filed.">
          <textarea id="ss-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} className={TEXTAREA} />
        </FormField>
      </FormDialog>

      <ConfirmModal
        open={!!confirm}
        variant={confirm?.kind === "delete" ? "danger" : "warning"}
        title={confirm?.kind === "delete" ? `Delete “${confirm.story.couple_names}”?` : `Unpublish “${confirm?.story.couple_names || ""}”?`}
        message={confirm?.kind === "delete"
          ? "The story is removed from the website and from this list. This can't be undone from the console."
          : "The story comes off the public website straight away. It stays here as a draft and can be published again."}
        confirmLabel={confirm?.kind === "delete" ? "Delete story" : "Unpublish"}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </PageShell>
  );
}
