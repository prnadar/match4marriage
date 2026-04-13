"use client";

import { useState, useMemo } from "react";
import {
  IndianRupee,
  TrendingUp,
  Calendar,
  CreditCard,
  RotateCcw,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import DataTable from "@/components/admin/DataTable";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import {
  mockPayments,
  type AdminPayment,
} from "@/lib/admin-mock-data";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return `\u20B9${n.toLocaleString("en-IN")}`;
}

type StatusFilter = "all" | "success" | "failed" | "refunded";
type GatewayFilter = "all" | "Razorpay" | "Stripe";

const statusBadgeClasses: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-amber-100 text-amber-700",
};

const gatewayBadgeClasses: Record<string, string> = {
  Razorpay: "bg-blue-100 text-blue-700",
  Stripe: "bg-purple-100 text-purple-700",
};

// ── Revenue Cards Data ───────────────────────────────────────────────────────

const revenueCards = [
  {
    label: "Today",
    value: 45990,
    icon: IndianRupee,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    label: "This Week",
    value: 324500,
    icon: TrendingUp,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    label: "This Month",
    value: 1847500,
    icon: Calendar,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    label: "All Time",
    value: 12456000,
    icon: CreditCard,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [gatewayFilter, setGatewayFilter] = useState<GatewayFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Refund modal
  const [refundModal, setRefundModal] = useState<AdminPayment | null>(null);

  // Filtered data
  const filteredData = useMemo(() => {
    let result = mockPayments;

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (gatewayFilter !== "all") {
      result = result.filter((p) => p.gateway === gatewayFilter);
    }
    if (dateFrom) {
      result = result.filter((p) => p.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((p) => p.date <= dateTo);
    }

    return result;
  }, [statusFilter, gatewayFilter, dateFrom, dateTo]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRefund = () => {
    if (!refundModal) return;
    toast(
      "success",
      `Refund of ${fmtCurrency(refundModal.amount)} processed for ${refundModal.userName} (${refundModal.transactionId})`
    );
    setRefundModal(null);
  };

  const handleExport = () => {
    toast("info", "Exporting payments to CSV...");
  };

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns = [
    { key: "transactionId", label: "Transaction ID", sortable: true },
    { key: "userName", label: "User Name", sortable: true },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (row: AdminPayment) => (
        <span className="font-medium">{fmtCurrency(row.amount)}</span>
      ),
    },
    { key: "plan", label: "Plan", sortable: true },
    {
      key: "gateway",
      label: "Gateway",
      sortable: true,
      render: (row: AdminPayment) => (
        <span
          className={`inline-flex px-2.5 py-1 rounded-lg font-body text-xs font-semibold ${
            gatewayBadgeClasses[row.gateway] || "bg-gray-100 text-gray-500"
          }`}
        >
          {row.gateway}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: AdminPayment) => (
        <span
          className={`inline-flex px-2.5 py-1 rounded-lg font-body text-xs font-semibold capitalize ${
            statusBadgeClasses[row.status] || "bg-gray-100 text-gray-500"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    { key: "date", label: "Date", sortable: true },
    {
      key: "actions",
      label: "Actions",
      render: (row: AdminPayment) =>
        row.status === "success" ? (
          <button
            onClick={() => setRefundModal(row)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refund
          </button>
        ) : (
          <span className="font-body text-xs text-muted">--</span>
        ),
    },
  ];

  // ── Filter Bar (rendered inside DataTable filters slot) ────────────────────

  const filterBar = (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status filter */}
      <div className="flex items-center gap-1 bg-blush/50 rounded-xl p-1">
        {(["all", "success", "failed", "refunded"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg font-body text-xs font-medium capitalize transition-colors ${
              statusFilter === s
                ? "bg-white text-deep shadow-sm"
                : "text-muted hover:text-deep"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border font-body text-xs text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
          style={{ borderColor: "rgba(201,149,74,0.2)" }}
          placeholder="From"
        />
        <span className="font-body text-xs text-muted">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border font-body text-xs text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
          style={{ borderColor: "rgba(201,149,74,0.2)" }}
          placeholder="To"
        />
      </div>

      {/* Gateway filter */}
      <select
        value={gatewayFilter}
        onChange={(e) => setGatewayFilter(e.target.value as GatewayFilter)}
        className="px-3 py-1.5 rounded-lg border font-body text-xs text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
        style={{ borderColor: "rgba(201,149,74,0.2)" }}
      >
        <option value="all">All Gateways</option>
        <option value="Razorpay">Razorpay</option>
        <option value="Stripe">Stripe</option>
      </select>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-blush">
      <TopBar title="Payments" subtitle="Payment transactions and revenue" />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Revenue Summary Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {revenueCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="glass-card p-5">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                  <div>
                    <p className="font-body text-xs text-muted">{card.label}</p>
                    <p className="font-display text-xl font-bold text-deep">
                      {fmtCurrency(card.value)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Data Table ────────────────────────────────────────────── */}
        <DataTable<AdminPayment>
          columns={columns}
          data={filteredData}
          searchable
          searchKeys={["userName", "transactionId"]}
          searchPlaceholder="Search by user name or transaction ID..."
          rowKey={(row) => row.id}
          onExport={handleExport}
          filters={filterBar}
          emptyMessage="No payments found"
        />
      </div>

      {/* ── Refund Modal ──────────────────────────────────────────── */}
      <ConfirmModal
        open={refundModal !== null}
        title="Process Refund"
        message={
          refundModal
            ? `Refund ${fmtCurrency(refundModal.amount)} to ${refundModal.userName} for the ${refundModal.plan} plan (${refundModal.transactionId})? This action cannot be undone.`
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
