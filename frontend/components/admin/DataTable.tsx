"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
  Download, Inbox,
} from "lucide-react";
import { EmptyState, SearchField, SkeletonRows } from "./primitives";

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
  /** Optional: right-align numeric columns. */
  align?: "left" | "right" | "center";
  /** Optional: value used for sorting when it differs from row[key]. */
  sortValue?: (row: T) => string | number | null | undefined;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  pageSizes?: number[];
  bulkActions?: { label: string; onClick: (ids: string[]) => void; variant?: "danger" | "default" }[];
  rowKey?: (row: T) => string;
  onExport?: () => void;
  filters?: React.ReactNode;
  emptyMessage?: string;
  // ── Optional additions (backwards compatible) ──
  /** Click a row to open it (adds hover + keyboard Enter). */
  onRowClick?: (row: T) => void;
  /** Rich empty state; overrides emptyMessage. */
  emptyState?: React.ReactNode;
  /** Compact row height for dense lists. */
  dense?: boolean;
  /** Initial sort. */
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** Highlight a row (e.g. the one open in a side panel). */
  activeRowKey?: string | null;
  /** Called whenever the selection changes. */
  onSelectionChange?: (ids: string[]) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search…",
  searchKeys = [],
  pageSizes = [25, 50, 100],
  bulkActions,
  rowKey = (row) => String(row.id || row.Id || ""),
  onExport,
  filters,
  emptyMessage = "No data found",
  onRowClick,
  emptyState,
  dense = false,
  initialSort,
  activeRowKey,
  onSelectionChange,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(initialSort?.key || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSort?.dir || "asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { onSelectionChange?.(Array.from(selected)); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) => {
      const keys = searchKeys.length ? searchKeys : Object.keys(row);
      return keys.some((k) => {
        const v = row[k];
        return v != null && String(v).toLowerCase().includes(q);
      });
    });
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    const get = (r: T) => (col?.sortValue ? col.sortValue(r) : r[sortKey]);
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const allOnPage = pageData.length > 0 && pageData.every((r) => selected.has(rowKey(r)));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPage) pageData.forEach((r) => next.delete(rowKey(r)));
    else pageData.forEach((r) => next.add(rowKey(r)));
    setSelected(next);
  };
  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const cellPad = dense ? "px-3 py-2" : "px-4 py-3";
  const alignCls = (a?: "left" | "right" | "center") =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  const showToolbar = searchable || filters || onExport || (bulkActions && selected.size > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[var(--adm-shadow-card)]">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2.5">
          {searchable && (
            <SearchField
              value={search}
              onChange={(v) => { setSearch(v); setPage(0); }}
              placeholder={searchPlaceholder}
              className="min-w-[200px] max-w-sm flex-1"
            />
          )}
          {filters}
          <div className="ml-auto flex items-center gap-2">
            {bulkActions && selected.size > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-secondary/70 py-1 pl-2.5 pr-1">
                <span className="text-[12px] font-medium text-foreground tabular-nums">{selected.size} selected</span>
                {bulkActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => action.onClick(Array.from(selected))}
                    className={`h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                      action.variant === "danger"
                        ? "bg-card adm-fg-bad hover:bg-[color:var(--adm-bad-bg)]"
                        : "bg-card text-foreground hover:bg-border/50"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
                <button type="button" onClick={() => setSelected(new Set())}
                  className="h-7 rounded-md px-2 text-[12px] text-muted2-foreground hover:text-foreground">Clear</button>
              </div>
            )}
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export CSV
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-3"><SkeletonRows rows={8} /></div>
      ) : (
        <div className="overflow-x-auto" data-admin-scroll>
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-secondary/50">
                {bulkActions && (
                  <th className={`${cellPad} w-10`}>
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allOnPage}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]"
                    />
                  </th>
                )}
                {columns.map((col) => {
                  const sortedHere = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={sortedHere ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                      className={`${cellPad} ${alignCls(col.align)} whitespace-nowrap text-[11.5px] font-medium text-muted2-foreground ${col.className || ""}`}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className={`inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${sortedHere ? "text-foreground" : ""}`}
                        >
                          {col.label}
                          {sortedHere
                            ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                            : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      ) : col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (bulkActions ? 1 : 0)}>
                    {emptyState || (
                      <EmptyState
                        icon={Inbox}
                        title={search ? `No results for “${search}”` : emptyMessage}
                        description={search ? "Try a different search or clear the filters." : undefined}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                pageData.map((row) => {
                  const id = rowKey(row);
                  const isSel = selected.has(id);
                  const isActive = activeRowKey != null && activeRowKey === id;
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(row); } : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-selected={bulkActions ? isSel : undefined}
                      className={[
                        "border-b border-border/50 last:border-0 transition-colors",
                        isActive ? "bg-primary/[0.05]" : isSel ? "bg-secondary/60" : "hover:bg-secondary/40",
                        onRowClick ? "cursor-pointer focus-visible:outline-none focus-visible:bg-secondary/60 focus-visible:shadow-[inset_2px_0_0_hsl(var(--primary))]" : "",
                      ].join(" ")}
                    >
                      {bulkActions && (
                        <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={isSel}
                            onChange={() => toggleRow(id)}
                            className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key} className={`${cellPad} ${alignCls(col.align)} text-[13px] text-foreground ${col.align === "right" ? "tabular-nums" : ""} ${col.className || ""}`}>
                          {col.render ? col.render(row) : String(row[col.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-3 py-2">
          <div className="flex items-center gap-2 text-[12px] text-muted2-foreground">
            <label className="flex items-center gap-2">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                className="h-7 rounded-md border border-border bg-card px-1.5 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {pageSizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <span className="tabular-nums">
              {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of {sorted.length.toLocaleString("en-GB")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="grid h-7 w-7 place-items-center rounded-md text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let n: number;
              if (totalPages <= 5) n = i;
              else if (safePage < 3) n = i;
              else if (safePage > totalPages - 4) n = totalPages - 5 + i;
              else n = safePage - 2 + i;
              return (
                <button
                  key={n}
                  type="button"
                  aria-current={safePage === n ? "page" : undefined}
                  onClick={() => setPage(n)}
                  className={`h-7 min-w-[28px] rounded-md px-1.5 text-[12px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                    safePage === n ? "bg-foreground text-background" : "text-muted2-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {n + 1}
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Next page"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="grid h-7 w-7 place-items-center rounded-md text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
