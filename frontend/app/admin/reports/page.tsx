"use client";

import { useState, useMemo } from "react";
import {
  Flag,
  Eye,
  AlertTriangle,
  ShieldBan,
  ShieldOff,
  CheckCircle,
  XCircle,
  MessageSquare,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import DataTable from "@/components/admin/DataTable";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import { mockReports, type AdminReport } from "@/lib/admin-mock-data";

// ── Types ────────────────────────────────────────────────────────────────────

type TabStatus = "pending" | "resolved" | "dismissed";

interface ConfirmAction {
  type: "warn" | "suspend" | "ban";
  reportId: string;
  userName: string;
}

// ── Reason badge colors ──────────────────────────────────────────────────────

const reasonColors: Record<string, string> = {
  "Fake Profile": "bg-red-50 text-red-600 border-red-200",
  "Inappropriate Photos": "bg-amber-50 text-amber-600 border-amber-200",
  Harassment: "bg-rose-50 text-rose border-rose-200",
  Spam: "bg-orange-50 text-orange-600 border-orange-200",
  "Underage User": "bg-purple-50 text-purple-600 border-purple-200",
  "Already Married": "bg-blue-50 text-blue-600 border-blue-200",
  "Wrong Information": "bg-slate-50 text-slate-600 border-slate-200",
};

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AdminReport["status"] }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-600 border-amber-200",
    resolved: "bg-emerald-50 text-emerald-600 border-emerald-200",
    dismissed: "bg-slate-50 text-slate-500 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  report,
  notes,
  onNotesChange,
  onClose,
}: {
  report: AdminReport;
  notes: string;
  onNotesChange: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-float-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-deep/30 hover:text-deep transition-colors"
        >
          <XCircle className="w-5 h-5" />
        </button>

        <h3 className="font-display text-lg font-semibold text-deep mb-4">
          Report Detail &mdash; {report.id}
        </h3>

        <div className="space-y-3 font-body text-sm text-deep">
          <div className="flex gap-3">
            <span className="text-muted w-28 flex-shrink-0">Reporter:</span>
            <span className="font-medium">{report.reporter.name}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-muted w-28 flex-shrink-0">Reported User:</span>
            <span className="font-medium">{report.reportedUser.name}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-muted w-28 flex-shrink-0">Reason:</span>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                reasonColors[report.reason] || "bg-gray-50 text-gray-600 border-gray-200"
              }`}
            >
              {report.reason}
            </span>
          </div>
          <div className="flex gap-3">
            <span className="text-muted w-28 flex-shrink-0">Date:</span>
            <span>{report.date}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-muted w-28 flex-shrink-0">Status:</span>
            <StatusBadge status={report.status} />
          </div>
          <div>
            <span className="text-muted block mb-1">Description:</span>
            <p className="text-deep/80 bg-blush/50 rounded-xl p-3">{report.description}</p>
          </div>
          <div>
            <span className="text-muted block mb-1">Internal Notes:</span>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add internal notes about this report..."
              rows={3}
              className="w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors resize-none"
              style={{ borderColor: "rgba(201,149,74,0.2)" }}
            />
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-body text-sm font-medium text-deep/60 hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { toast } = useToast();

  const [reports, setReports] = useState<AdminReport[]>(mockReports);
  const [activeTab, setActiveTab] = useState<TabStatus>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [detailReport, setDetailReport] = useState<AdminReport | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // Filter reports by active tab
  const filteredReports = useMemo(
    () => reports.filter((r) => r.status === activeTab),
    [reports, activeTab],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const updateReportStatus = (id: string, status: AdminReport["status"]) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const handleResolve = (id: string) => {
    updateReportStatus(id, "resolved");
    toast("success", "Report marked as resolved");
  };

  const handleDismiss = (id: string) => {
    updateReportStatus(id, "dismissed");
    toast("info", "Report dismissed");
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const { type, reportId, userName } = confirmAction;
    const labels: Record<string, string> = {
      warn: "Warning sent",
      suspend: "User suspended",
      ban: "User banned",
    };
    updateReportStatus(reportId, "resolved");
    toast("success", `${labels[type]}: ${userName}`);
    setConfirmAction(null);
  };

  const handleNotesChange = (reportId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [reportId]: value }));
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────

  const tabs: { key: TabStatus; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: reports.filter((r) => r.status === "pending").length },
    { key: "resolved", label: "Resolved", count: reports.filter((r) => r.status === "resolved").length },
    { key: "dismissed", label: "Dismissed", count: reports.filter((r) => r.status === "dismissed").length },
  ];

  // ── Confirm modal config ─────────────────────────────────────────────────

  const confirmConfig: Record<string, { title: string; message: string; label: string; variant: "danger" | "warning" }> = {
    warn: {
      title: "Warn User",
      message: `Send a warning to ${confirmAction?.userName}? They will be notified about policy violations.`,
      label: "Send Warning",
      variant: "warning",
    },
    suspend: {
      title: "Suspend User",
      message: `Suspend ${confirmAction?.userName}? Their profile will be hidden and they won't be able to log in.`,
      label: "Suspend",
      variant: "danger",
    },
    ban: {
      title: "Ban User",
      message: `Permanently ban ${confirmAction?.userName}? This action cannot be easily undone.`,
      label: "Ban User",
      variant: "danger",
    },
  };

  // ── Table columns ────────────────────────────────────────────────────────

  const columns = [
    { key: "id", label: "ID", sortable: true },
    {
      key: "reporter",
      label: "Reporter",
      sortable: true,
      render: (row: AdminReport) => (
        <span className="font-medium">{row.reporter.name}</span>
      ),
    },
    {
      key: "reportedUser",
      label: "Reported User",
      sortable: true,
      render: (row: AdminReport) => (
        <span className="font-medium">{row.reportedUser.name}</span>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      sortable: true,
      render: (row: AdminReport) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
            reasonColors[row.reason] || "bg-gray-50 text-gray-600 border-gray-200"
          }`}
        >
          {row.reason}
        </span>
      ),
    },
    { key: "date", label: "Date", sortable: true },
    {
      key: "status",
      label: "Status",
      render: (row: AdminReport) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: AdminReport) => (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setDetailReport(row)}
            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
            title="View Detail"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === "pending" && (
            <>
              <button
                onClick={() =>
                  setConfirmAction({ type: "warn", reportId: row.id, userName: row.reportedUser.name })
                }
                className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                title="Warn User"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setConfirmAction({ type: "suspend", reportId: row.id, userName: row.reportedUser.name })
                }
                className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 transition-colors"
                title="Suspend User"
              >
                <ShieldOff className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setConfirmAction({ type: "ban", reportId: row.id, userName: row.reportedUser.name })
                }
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                title="Ban User"
              >
                <ShieldBan className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDismiss(row.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors"
                title="Dismiss"
              >
                <XCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleResolve(row.id)}
                className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
                title="Resolve"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      <TopBar
        title="Reports"
        subtitle="Handle reported content and users"
        actions={
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-rose" />
            <span className="font-body text-xs text-white/60">
              {reports.filter((r) => r.status === "pending").length} pending
            </span>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-blush/50 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg font-body text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-deep shadow-sm"
                  : "text-muted hover:text-deep"
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${
                  activeTab === tab.key ? "bg-rose text-white" : "bg-blush text-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Notes Section (inline per report) */}
        <DataTable
          columns={columns}
          data={filteredReports as any[]}
          searchable
          searchPlaceholder="Search reports..."
          searchKeys={["id", "reason", "date"]}
          emptyMessage={`No ${activeTab} reports`}
        />

        {/* Inline notes for each visible report */}
        {filteredReports.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-semibold text-deep mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gold" />
              Internal Notes
            </h3>
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <div key={report.id} className="flex items-start gap-3">
                  <span className="font-body text-xs text-muted w-20 flex-shrink-0 pt-2">
                    {report.id}
                  </span>
                  <textarea
                    value={notes[report.id] ?? report.notes}
                    onChange={(e) => handleNotesChange(report.id, e.target.value)}
                    placeholder="Add internal notes..."
                    rows={2}
                    className="flex-1 rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors resize-none"
                    style={{ borderColor: "rgba(201,149,74,0.2)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailReport && (
        <DetailModal
          report={detailReport}
          notes={notes[detailReport.id] ?? detailReport.notes}
          onNotesChange={(value) => handleNotesChange(detailReport.id, value)}
          onClose={() => setDetailReport(null)}
        />
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          open
          title={confirmConfig[confirmAction.type].title}
          message={confirmConfig[confirmAction.type].message}
          confirmLabel={confirmConfig[confirmAction.type].label}
          variant={confirmConfig[confirmAction.type].variant}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
