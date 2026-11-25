"use client";

/**
 * Small helpers shared by admin pages (private `_lib` folder — not a route).
 *
 *  usePersistentState  per-viewer "saved view": remembers a tab / filter in
 *                      localStorage. Every read/write is guarded — storage can
 *                      be unavailable (private mode, blocked site data).
 *  exportRowsToCsv     client-side CSV export of the rows currently on screen,
 *                      for lists that have no backend CSV endpoint.
 */

import { useEffect, useState } from "react";

export function usePersistentState<T>(key: string, initial: T, isValid?: (v: unknown) => v is T) {
  const storageKey = `m4m.admin.${key}`;
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw == null) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isValid || isValid(parsed)) setValue(parsed as T);
    } catch { /* storage unavailable — keep default */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* ignore */ }
  }, [storageKey, value]);

  return [value, setValue] as const;
}

/** Type guard factory for string-union persisted values. */
export function oneOf<T extends string>(values: readonly T[]) {
  return (v: unknown): v is T => typeof v === "string" && (values as readonly string[]).includes(v);
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportRowsToCsv<T>(
  filename: string,
  columns: Array<{ label: string; value: (row: T) => unknown }>,
  rows: T[],
): void {
  const lines = [
    columns.map((c) => csvCell(c.label)).join(","),
    ...rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(",")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
