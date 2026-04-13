"use client";

import { useState, useMemo } from "react";
import {
  User,
  Check,
  X,
  Flag,
  ArrowUpDown,
  CheckSquare,
  Square,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import { mockPhotos, type AdminPhoto } from "@/lib/admin-mock-data";

type FilterTab = "all" | "pending" | "approved" | "rejected" | "flagged";
type SortOption = "newest" | "oldest" | "most-flagged";

const STATUS_COLORS: Record<AdminPhoto["status"], string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  flagged: "bg-orange-100 text-orange-700 border-orange-200",
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "flagged", label: "Flagged" },
];

export default function PhotosPage() {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<AdminPhoto[]>(mockPhotos);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    photoIds: string[];
    action: "reject" | "reject-bulk";
  }>({ open: false, photoIds: [], action: "reject" });

  const filtered = useMemo(() => {
    const base =
      activeTab === "all"
        ? photos
        : photos.filter((p) => p.status === activeTab);

    const sorted = [...base].sort((a, b) => {
      if (sortBy === "newest")
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      if (sortBy === "oldest")
        return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      return b.flagCount - a.flagCount;
    });

    return sorted;
  }, [photos, activeTab, sortBy]);

  const handleApprove = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "approved" as const } : p))
    );
    toast("success", "Photo approved successfully");
  };

  const handleReject = (id: string) => {
    setConfirmModal({ open: true, photoIds: [id], action: "reject" });
  };

  const confirmReject = () => {
    const ids = new Set(confirmModal.photoIds);
    setPhotos((prev) =>
      prev.map((p) => (ids.has(p.id) ? { ...p, status: "rejected" as const } : p))
    );
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setConfirmModal({ open: false, photoIds: [], action: "reject" });
    toast("success", `${ids.size} photo(s) rejected`);
  };

  const handleBulkApprove = () => {
    setPhotos((prev) =>
      prev.map((p) =>
        selected.has(p.id) ? { ...p, status: "approved" as const } : p
      )
    );
    toast("success", `${selected.size} photos approved`);
    setSelected(new Set());
  };

  const handleBulkReject = () => {
    setConfirmModal({
      open: true,
      photoIds: Array.from(selected),
      action: "reject-bulk",
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar
        title="Photos"
        subtitle="Review and moderate profile photos"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none pl-8 pr-4 py-2 rounded-xl border font-body text-xs text-deep bg-white/90 focus:outline-none focus:ring-2 focus:ring-gold/30 cursor-pointer"
                style={{ borderColor: "rgba(201,149,74,0.2)" }}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="most-flagged">Most Flagged</option>
              </select>
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            </div>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? photos.length
                : photos.filter((p) => p.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelected(new Set());
                }}
                className={`px-4 py-2 rounded-xl font-body text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-rose text-white shadow-sm"
                    : "bg-white/80 text-deep/60 hover:bg-blush hover:text-deep"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Bulk Action Bar */}
        {selected.size > 0 && (
          <div className="glass-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 font-body text-sm text-deep/70 hover:text-deep transition-colors"
              >
                {selected.size === filtered.length ? (
                  <CheckSquare className="w-4 h-4 text-rose" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {selected.size} selected
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                className="px-4 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-body text-xs font-medium hover:bg-emerald-100 transition-colors"
              >
                <Check className="w-3.5 h-3.5 inline mr-1" />
                Approve All
              </button>
              <button
                onClick={handleBulkReject}
                className="px-4 py-1.5 rounded-lg bg-red-50 text-red-600 font-body text-xs font-medium hover:bg-red-100 transition-colors"
              >
                <X className="w-3.5 h-3.5 inline mr-1" />
                Reject All
              </button>
            </div>
          </div>
        )}

        {/* Photo Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((photo) => (
            <div
              key={photo.id}
              className="glass-card overflow-hidden group relative"
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleSelect(photo.id)}
                className="absolute top-2 left-2 z-10 w-6 h-6 rounded-md bg-white/90 border border-gold/20 flex items-center justify-center transition-colors hover:bg-white"
              >
                {selected.has(photo.id) ? (
                  <Check className="w-4 h-4 text-rose" />
                ) : (
                  <span className="w-3 h-3 rounded-sm border border-deep/20" />
                )}
              </button>

              {/* Status Badge */}
              <div className="absolute top-2 right-2 z-10">
                <span
                  className={`px-2 py-0.5 rounded-full font-body text-[10px] font-semibold uppercase tracking-wider border ${
                    STATUS_COLORS[photo.status]
                  }`}
                >
                  {photo.status}
                </span>
              </div>

              {/* Placeholder Photo */}
              <div className="relative w-full aspect-square bg-blush flex items-center justify-center">
                <User className="w-16 h-16 text-rose/30" />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-deep/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleApprove(photo.id)}
                    className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors shadow-lg"
                    title="Approve"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleReject(photo.id)}
                    className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg"
                    title="Reject"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-body text-sm font-medium text-deep truncate">
                  {photo.userName}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="font-body text-xs text-muted">
                    {new Date(photo.uploadedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {photo.flagCount > 0 && (
                    <span className="flex items-center gap-0.5 text-orange-500 font-body text-xs font-medium">
                      <Flag className="w-3 h-3" />
                      {photo.flagCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="glass-card p-12 text-center">
            <User className="w-12 h-12 text-muted/30 mx-auto mb-3" />
            <p className="font-body text-sm text-muted">
              No photos found for this filter.
            </p>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title="Reject Photo"
        message={
          confirmModal.photoIds.length === 1
            ? "Are you sure you want to reject this photo? The user will be notified."
            : `Are you sure you want to reject ${confirmModal.photoIds.length} photos? The users will be notified.`
        }
        confirmLabel="Reject"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmReject}
        onCancel={() =>
          setConfirmModal({ open: false, photoIds: [], action: "reject" })
        }
      />
    </div>
  );
}
