"use client";

import { useState, useMemo } from "react";
import {
  Crown,
  CalendarPlus,
  ArrowUpCircle,
  XCircle,
  RotateCcw,
  Gift,
  Search,
  Download,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import DataTable from "@/components/admin/DataTable";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import {
  mockSubscriptions,
  type AdminSubscription,
} from "@/lib/admin-mock-data";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return `\u20B9${n.toLocaleString("en-IN")}`;
}

type FilterTab = "all" | "active" | "expired" | "cancelled";

const planBadgeClasses: Record<string, string> = {
  Silver: "bg-slate-100 text-slate-700",
  Gold: "bg-amber-100 text-amber-700",
  Diamond: "bg-purple-100 text-purple-700",
  Free: "bg-gray-100 text-gray-500",
};

const statusBadgeClasses: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  expired: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSubscriptionsPage() {
  const { toast } = useToast();

  // Filter tab
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Manual Grant state
  const [grantUser, setGrantUser] = useState("");
  const [grantPlan, setGrantPlan] = useState<"Silver" | "Gold" | "Diamond">("Silver");
  const [grantExpiry, setGrantExpiry] = useState("");

  // Extend modal
  const [extendModal, setExtendModal] = useState<AdminSubscription | null>(null);
  const [extendDays, setExtendDays] = useState("30");

  // Upgrade dropdown
  const [upgradeDropdown, setUpgradeDropdown] = useState<string | null>(null);

  // Cancel modal
  const [cancelModal, setCancelModal] = useState<AdminSubscription | null>(null);

  // Refund modal
  const [refundModal, setRefundModal] = useState<AdminSubscription | null>(null);

  // Bulk extend
  const [bulkExtendDays, setBulkExtendDays] = useState("30");
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[]>([]);

  // Filtered data
  const filteredData = useMemo(() => {
    if (activeTab === "all") return mockSubscriptions;
    return mockSubscriptions.filter((s) => s.status === activeTab);
  }, [activeTab]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGrant = () => {
    if (!grantUser.trim()) {
      toast("error", "Please enter a user name or ID");
      return;
    }
    if (!grantExpiry) {
      toast("error", "Please select an expiry date");
      return;
    }
    toast("success", `${grantPlan} plan granted to "${grantUser}" until ${grantExpiry}`);
    setGrantUser("");
    setGrantPlan("Silver");
    setGrantExpiry("");
  };

  const handleExtend = () => {
    if (!extendModal) return;
    const days = parseInt(extendDays, 10);
    if (isNaN(days) || days <= 0) {
      toast("error", "Please enter a valid number of days");
      return;
    }
    toast("success", `Subscription ${extendModal.id} extended by ${days} days`);
    setExtendModal(null);
    setExtendDays("30");
  };

  const handleUpgrade = (sub: AdminSubscription, newPlan: string) => {
    toast("success", `${sub.userName}'s plan upgraded to ${newPlan}`);
    setUpgradeDropdown(null);
  };

  const handleCancel = () => {
    if (!cancelModal) return;
    toast("success", `Subscription ${cancelModal.id} for ${cancelModal.userName} cancelled`);
    setCancelModal(null);
  };

  const handleRefund = () => {
    if (!refundModal) return;
    toast("success", `Refund of ${fmtCurrency(refundModal.amountPaid)} processed for ${refundModal.userName}`);
    setRefundModal(null);
  };

  const handleBulkExtend = () => {
    const days = parseInt(bulkExtendDays, 10);
    if (isNaN(days) || days <= 0) {
      toast("error", "Please enter a valid number of days");
      return;
    }
    toast("success", `${bulkIds.length} subscriptions extended by ${days} days`);
    setShowBulkInput(false);
    setBulkIds([]);
    setBulkExtendDays("30");
  };

  const handleExport = () => {
    toast("info", "Exporting subscriptions to CSV...");
  };

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns = [
    { key: "id", label: "ID", sortable: true },
    { key: "userName", label: "User Name", sortable: true },
    {
      key: "plan",
      label: "Plan",
      sortable: true,
      render: (row: AdminSubscription) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-body text-xs font-semibold ${
            planBadgeClasses[row.plan] || "bg-gray-100 text-gray-500"
          }`}
        >
          <Crown className="w-3 h-3" />
          {row.plan}
        </span>
      ),
    },
    { key: "startDate", label: "Start Date", sortable: true },
    { key: "expiryDate", label: "Expiry Date", sortable: true },
    {
      key: "amountPaid",
      label: "Amount Paid",
      sortable: true,
      render: (row: AdminSubscription) => (
        <span className="font-medium">{fmtCurrency(row.amountPaid)}</span>
      ),
    },
    { key: "gateway", label: "Gateway", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: AdminSubscription) => (
        <span
          className={`inline-flex px-2.5 py-1 rounded-lg font-body text-xs font-semibold capitalize ${
            statusBadgeClasses[row.status] || "bg-gray-100 text-gray-500"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: AdminSubscription) => (
        <div className="flex items-center gap-1.5 relative">
          <button
            onClick={() => { setExtendModal(row); setExtendDays("30"); }}
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
            title="Extend"
          >
            <CalendarPlus className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setUpgradeDropdown(upgradeDropdown === row.id ? null : row.id)}
              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
              title="Upgrade"
            >
              <ArrowUpCircle className="w-4 h-4" />
            </button>
            {upgradeDropdown === row.id && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gold/10 py-1 z-30 min-w-[120px]">
                {["Silver", "Gold", "Diamond"]
                  .filter((p) => p !== row.plan)
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => handleUpgrade(row, p)}
                      className="w-full text-left px-3 py-1.5 font-body text-sm hover:bg-blush transition-colors"
                    >
                      {p}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setCancelModal(row)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title="Cancel"
          >
            <XCircle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setRefundModal(row)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
            title="Refund"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ── Filter tabs (rendered inside DataTable filters slot) ───────────────────

  const filterTabs = (
    <div className="flex items-center gap-1 bg-blush/50 rounded-xl p-1">
      {(["all", "active", "expired", "cancelled"] as FilterTab[]).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-3 py-1.5 rounded-lg font-body text-xs font-medium capitalize transition-colors ${
            activeTab === tab
              ? "bg-white text-deep shadow-sm"
              : "text-muted hover:text-deep"
          }`}
        >
          {tab === "all" ? "All" : tab}
        </button>
      ))}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-blush">
      <TopBar title="Subscriptions" subtitle="Manage user subscription plans" />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Manual Grant Section ──────────────────────────────────── */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-rose" />
            <h2 className="font-display text-lg font-bold text-deep">
              Manual Grant
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="font-body text-xs font-medium text-muted mb-1 block">
                Search User
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={grantUser}
                  onChange={(e) => setGrantUser(e.target.value)}
                  placeholder="Enter user name or ID..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
            </div>
            <div className="min-w-[140px]">
              <label className="font-body text-xs font-medium text-muted mb-1 block">
                Plan
              </label>
              <select
                value={grantPlan}
                onChange={(e) => setGrantPlan(e.target.value as "Silver" | "Gold" | "Diamond")}
                className="w-full px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                style={{ borderColor: "rgba(201,149,74,0.2)" }}
              >
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Diamond">Diamond</option>
              </select>
            </div>
            <div className="min-w-[160px]">
              <label className="font-body text-xs font-medium text-muted mb-1 block">
                Expiry Date
              </label>
              <input
                type="date"
                value={grantExpiry}
                onChange={(e) => setGrantExpiry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                style={{ borderColor: "rgba(201,149,74,0.2)" }}
              />
            </div>
            <button onClick={handleGrant} className="btn-primary whitespace-nowrap">
              <Gift className="w-4 h-4" />
              Grant Plan
            </button>
          </div>
        </div>

        {/* ── Bulk Extend Input (shown when triggered) ──────────────── */}
        {showBulkInput && (
          <div className="glass-card p-4 flex items-center gap-4">
            <span className="font-body text-sm text-deep font-medium">
              Extend {bulkIds.length} subscription(s) by:
            </span>
            <input
              type="number"
              min={1}
              value={bulkExtendDays}
              onChange={(e) => setBulkExtendDays(e.target.value)}
              className="w-24 px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
              style={{ borderColor: "rgba(201,149,74,0.2)" }}
              placeholder="Days"
            />
            <span className="font-body text-sm text-muted">days</span>
            <button onClick={handleBulkExtend} className="btn-primary text-sm">
              Apply
            </button>
            <button
              onClick={() => { setShowBulkInput(false); setBulkIds([]); }}
              className="px-3 py-2 rounded-xl font-body text-sm text-muted hover:text-deep hover:bg-blush transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Data Table ────────────────────────────────────────────── */}
        <DataTable<AdminSubscription>
          columns={columns}
          data={filteredData}
          searchable
          searchKeys={["userName"]}
          searchPlaceholder="Search by user name..."
          rowKey={(row) => row.id}
          onExport={handleExport}
          filters={filterTabs}
          bulkActions={[
            {
              label: "Extend by X days",
              onClick: (ids) => {
                setBulkIds(ids);
                setShowBulkInput(true);
              },
            },
          ]}
          emptyMessage="No subscriptions found"
        />
      </div>

      {/* ── Extend Modal ──────────────────────────────────────────── */}
      {extendModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setExtendModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-float-in">
            <h3 className="font-display text-lg font-semibold text-deep mb-2">
              Extend Subscription
            </h3>
            <p className="font-body text-sm text-muted mb-4">
              Extend <span className="font-semibold text-deep">{extendModal.userName}</span>&apos;s{" "}
              {extendModal.plan} plan ({extendModal.id}).
            </p>
            <div className="flex items-center gap-3 mb-6">
              <input
                type="number"
                min={1}
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
                className="w-24 px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                style={{ borderColor: "rgba(201,149,74,0.2)" }}
              />
              <span className="font-body text-sm text-muted">days</span>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setExtendModal(null)}
                className="px-4 py-2 rounded-xl font-body text-sm font-medium text-deep/60 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button onClick={handleExtend} className="btn-primary text-sm">
                Extend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Modal ──────────────────────────────────────────── */}
      <ConfirmModal
        open={cancelModal !== null}
        title="Cancel Subscription"
        message={
          cancelModal
            ? `Are you sure you want to cancel ${cancelModal.userName}'s ${cancelModal.plan} subscription (${cancelModal.id})? This action cannot be undone.`
            : ""
        }
        confirmLabel="Cancel Subscription"
        cancelLabel="Keep Active"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setCancelModal(null)}
      />

      {/* ── Refund Modal ──────────────────────────────────────────── */}
      <ConfirmModal
        open={refundModal !== null}
        title="Process Refund"
        message={
          refundModal
            ? `Refund ${fmtCurrency(refundModal.amountPaid)} to ${refundModal.userName} for ${refundModal.plan} plan (${refundModal.id})?`
            : ""
        }
        confirmLabel="Process Refund"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleRefund}
        onCancel={() => setRefundModal(null)}
      />
    </div>
  );
}
