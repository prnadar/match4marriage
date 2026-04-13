"use client";

import { useState, useMemo } from "react";
import {
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
  Search, Download, Loader2,
} from "lucide-react";

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  searchKeys = [],
  pageSizes = [25, 50, 100],
  bulkActions,
  rowKey = (row) => String(row.id || row.Id || ""),
  onExport,
  filters,
  emptyMessage = "No data found",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filter
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

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null || bv == null) return 0;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleAll = () => {
    if (selected.size === pageData.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageData.map(rowKey)));
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  // Skeleton rows
  if (loading) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 bg-blush rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-gold/10 flex flex-wrap items-center gap-3">
        {searchable && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
              style={{ borderColor: "rgba(201,149,74,0.2)" }}
            />
          </div>
        )}
        {filters}
        <div className="flex items-center gap-2 ml-auto">
          {bulkActions && selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-body text-xs text-muted">{selected.size} selected</span>
              {bulkActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => action.onClick(Array.from(selected))}
                  className={`px-3 py-1.5 rounded-lg font-body text-xs font-medium transition-colors ${
                    action.variant === "danger"
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-rose-50 text-rose hover:bg-rose-100"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-xs font-medium text-muted hover:text-deep hover:bg-blush transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gold/10 bg-blush/50">
              {bulkActions && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={pageData.length > 0 && selected.size === pageData.length}
                    onChange={toggleAll}
                    className="rounded border-gold/30 text-rose focus:ring-rose/30"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-body text-xs font-semibold text-muted uppercase tracking-wider ${col.className || ""} ${
                    col.sortable ? "cursor-pointer select-none hover:text-deep" : ""
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="inline-flex flex-col">
                        {sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (bulkActions ? 1 : 0)}
                  className="px-4 py-12 text-center font-body text-sm text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageData.map((row) => {
                const id = rowKey(row);
                return (
                  <tr
                    key={id}
                    className="border-b border-gold/5 hover:bg-blush/30 transition-colors"
                  >
                    {bulkActions && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(id)}
                          onChange={() => toggleRow(id)}
                          className="rounded border-gold/30 text-rose focus:ring-rose/30"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 font-body text-sm text-deep ${col.className || ""}`}>
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

      {/* Pagination */}
      <div className="p-4 border-t border-gold/10 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="font-body text-xs text-muted">Show</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="rounded-lg border px-2 py-1 font-body text-xs text-deep bg-white"
            style={{ borderColor: "rgba(201,149,74,0.2)" }}
          >
            {pageSizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="font-body text-xs text-muted">
            of {sorted.length} results
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded-lg hover:bg-blush disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-deep" />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i;
            } else if (page < 3) {
              pageNum = i;
            } else if (page > totalPages - 4) {
              pageNum = totalPages - 5 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 rounded-lg font-body text-xs font-medium transition-colors ${
                  page === pageNum
                    ? "bg-rose text-white"
                    : "text-deep/60 hover:bg-blush"
                }`}
              >
                {pageNum + 1}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded-lg hover:bg-blush disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-deep" />
          </button>
        </div>
      </div>
    </div>
  );
}
