"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminMembersApi } from "@/lib/api";
import { ErrorState, Select, SkeletonRows } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/Toast";
import { FormDialog, FormField, INPUT, REASON_MIN, ReasonField, errorMessage, humanize } from "./shared";

type FieldDef = {
  key: string; label: string; type: "text" | "date" | "number" | "select"; group: string;
  required?: boolean; max?: number; min?: number; options?: string[];
};
type Editable = {
  has_profile: boolean; is_deleted: boolean; version: number; fields: FieldDef[];
  values: Record<string, string | number | null>; not_editable_note: string;
};

const asText = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function isAdult(isoDate: string): boolean {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const t = new Date();
  const age = t.getFullYear() - d.getFullYear() - (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate()) ? 1 : 0);
  return age >= 18 && age <= 100;
}

/**
 * Correct a member's profile on their behalf (typo, wrong city…). Only the
 * safe subset the server allows; only changed fields are sent; a reason is
 * required and the edit is audit-logged with a before → after diff.
 */
export default function EditProfileDialog({ userId, memberName, open, onClose, onSaved }: {
  userId: string; memberName: string; open: boolean; onClose: () => void; onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<Editable | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(null); setLoadError(null);
    try {
      const res = await adminMembersApi.getEditableProfile(userId);
      const d = (res.data as any)?.data as Editable;
      setData(d);
      setValues(Object.fromEntries((d?.fields || []).map((f) => [f.key, asText(d.values?.[f.key])])));
    } catch (e) { setLoadError(errorMessage(e, "Couldn't load the profile")); }
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    setReason(""); setNotify(true); setTouched(false); setError(null);
    load();
  }, [open, load]);

  const changes = useMemo(() => {
    const out: Record<string, string | number | null> = {};
    if (!data) return out;
    for (const f of data.fields) {
      const before = asText(data.values?.[f.key]).trim();
      const after = (values[f.key] ?? "").trim();
      if (before === after) continue;
      out[f.key] = after === "" ? null : f.type === "number" ? Number(after) : after;
    }
    return out;
  }, [data, values]);
  const changedKeys = Object.keys(changes);

  const fieldError = (f: FieldDef): string | null => {
    if (!(f.key in changes)) return null;
    const v = changes[f.key];
    if (v === null) return f.required || f.key === "date_of_birth" || f.key === "gender" ? `${f.label} can't be blank.` : null;
    if (f.type === "number" && (!Number.isFinite(v as number) || (f.min !== undefined && (v as number) < f.min) || (f.max !== undefined && (v as number) > f.max)))
      return `Enter a number between ${f.min} and ${f.max}.`;
    if (f.type === "date" && f.key === "date_of_birth" && !isAdult(String(v))) return "Members must be at least 18 (and the date must be realistic).";
    return null;
  };
  const invalid = data ? data.fields.some((f) => fieldError(f)) : false;

  const submit = async () => {
    setTouched(true);
    if (changedKeys.length === 0) { setError("You haven't changed anything yet."); return; }
    if (invalid) { setError("Fix the highlighted fields first."); return; }
    if (reason.trim().length < REASON_MIN) { setError("Add a reason (at least 5 characters)."); return; }
    setBusy(true); setError(null);
    try {
      const res = await adminMembersApi.editProfile(userId, { changes, reason: reason.trim(), notify_member: notify });
      const changed: string[] = (res.data as any)?.data?.changed || [];
      toast("success", changed.length ? `Updated ${changed.map((k) => humanize(k).toLowerCase()).join(", ")} for ${memberName}` : "Nothing needed changing");
      onSaved?.();
      onClose();
    } catch (e) { setError(errorMessage(e, "The changes weren't saved")); }
    finally { setBusy(false); }
  };

  const groups = useMemo(() => {
    const m = new Map<string, FieldDef[]>();
    for (const f of data?.fields || []) m.set(f.group, [...(m.get(f.group) || []), f]);
    return Array.from(m.entries());
  }, [data]);

  const blocked = data ? (data.is_deleted ? "This account is deleted — its profile can't be edited." : !data.has_profile ? "This member hasn't created a profile yet, so there's nothing to edit." : null) : null;

  return (
    <FormDialog
      open={open} wide
      title={`Edit details — ${memberName}`}
      description="Correct a mistake on the member's behalf. Only changed fields are saved, and the member's own PATCH rules (including 18+) apply."
      onClose={() => { if (!busy) onClose(); }} onSubmit={submit} busy={busy} error={error}
      submitLabel={changedKeys.length ? `Save ${changedKeys.length} change${changedKeys.length === 1 ? "" : "s"}` : "Save changes"}
      submitDisabled={!data || !!blocked}
    >
      {loadError ? <ErrorState compact message={loadError} onRetry={load} /> : !data ? <SkeletonRows rows={5} /> : blocked ? (
        <ErrorState compact message={blocked} />
      ) : (
        <>
          {groups.map(([group, fields]) => (
            <fieldset key={group} className="space-y-2.5">
              <legend className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted2-foreground">{group}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((f) => {
                  const id = `edit-${f.key}`;
                  const err = fieldError(f);
                  const changed = f.key in changes;
                  return (
                    <FormField key={f.key} htmlFor={id} label={f.label} required={f.required} error={err}
                      hint={changed ? `Was: ${asText(data.values?.[f.key]) ? humanize(asText(data.values?.[f.key])) : "empty"}` : undefined}>
                      {f.type === "select" ? (
                        <Select id={id} value={values[f.key] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} className="w-full">
                          <option value="">—</option>
                          {(f.options || []).map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
                        </Select>
                      ) : (
                        <input
                          id={id} type={f.type} value={values[f.key] ?? ""}
                          maxLength={f.type === "text" ? f.max : undefined}
                          min={f.type === "number" ? f.min : undefined} max={f.type === "number" ? f.max : undefined}
                          onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                          aria-invalid={err ? true : undefined}
                          className={INPUT}
                        />
                      )}
                    </FormField>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <p className="rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-[12px] text-muted2-foreground">{data.not_editable_note}</p>
          <ReasonField id="edit-reason" value={reason} onChange={setReason} showError={touched} placeholder="e.g. Member emailed: city was misspelt" />
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]" />
            Tell the member what was changed (in-app notification)
          </label>
        </>
      )}
    </FormDialog>
  );
}
