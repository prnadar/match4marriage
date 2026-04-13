"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Eye, ExternalLink, CheckCircle, XCircle, Download } from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import DataTable from "@/components/admin/DataTable";
import ConfirmModal from "@/components/admin/ConfirmModal";
import ProfileModal from "@/components/admin/ProfileModal";
import { useToast } from "@/components/admin/Toast";
import { mockUsers, type AdminUser } from "@/lib/admin-mock-data";

type Tab = "pending" | "approved" | "rejected" | "incomplete";

const tabs: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "incomplete", label: "Incomplete" },
];

const statusMap: Record<Tab, AdminUser["status"]> = {
  pending: "pending",
  approved: "active",
  rejected: "banned",
  incomplete: "suspended",
};

export default function ProfilesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [previewUser, setPreviewUser] = useState<AdminUser | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ open: false, title: "", message: "", action: () => {} });

  const filteredUsers = useMemo(
    () => mockUsers.filter((u) => u.status === statusMap[activeTab]),
    [activeTab]
  );

  const handleApprove = (id: string) => {
    toast("success", `Profile ${id} approved successfully`);
    setPreviewUser(null);
  };

  const handleReject = (id: string) => {
    toast("success", `Profile ${id} rejected`);
    setPreviewUser(null);
  };

  const handleBulkApprove = (ids: string[]) => {
    setConfirmModal({
      open: true,
      title: "Approve Selected Profiles",
      message: `Are you sure you want to approve ${ids.length} selected profiles?`,
      action: () => {
        toast("success", `${ids.length} profiles approved successfully`);
        setConfirmModal((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleBulkReject = (ids: string[]) => {
    setConfirmModal({
      open: true,
      title: "Reject Selected Profiles",
      message: `Are you sure you want to reject ${ids.length} selected profiles? This action cannot be undone.`,
      action: () => {
        toast("success", `${ids.length} profiles rejected`);
        setConfirmModal((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const columns = [
    {
      key: "photo",
      label: "Photo",
      render: () => (
        <div className="w-10 h-10 rounded-xl bg-blush flex items-center justify-center text-rose/40 font-body text-xs">
          IMG
        </div>
      ),
    },
    { key: "name", label: "Name", sortable: true },
    { key: "age", label: "Age", sortable: true },
    { key: "city", label: "City", sortable: true },
    { key: "religion", label: "Religion", sortable: true },
    { key: "caste", label: "Caste", sortable: true },
    { key: "education", label: "Education", sortable: true },
    {
      key: "joined",
      label: "Submitted",
      sortable: true,
      render: (row: AdminUser) => (
        <span className="font-body text-xs text-muted">{row.joined}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: AdminUser) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewUser(row)}
            title="Quick Preview"
            className="p-1.5 rounded-lg hover:bg-blush text-muted hover:text-deep transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <Link
            href={`/admin/profiles/${row.id}`}
            title="Full View"
            className="p-1.5 rounded-lg hover:bg-blush text-muted hover:text-deep transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
          <button
            onClick={() => handleApprove(row.id)}
            title="Approve"
            className="p-1.5 rounded-lg hover:bg-emerald-50 text-muted hover:text-emerald-600 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleReject(row.id)}
            title="Reject"
            className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <TopBar
        title="Profiles"
        subtitle="Review and manage user profiles"
        actions={
          <button
            onClick={() => toast("info", "Exporting profiles...")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-body text-xs font-medium text-muted hover:text-deep hover:bg-white/10 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl bg-blush/50 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-xl font-body text-sm font-medium transition-all duration-150 ${
                activeTab === tab.key
                  ? "bg-rose text-white shadow-sm"
                  : "text-muted hover:text-deep hover:bg-white/60"
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 px-1.5 py-0.5 rounded-md text-xs ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-white/80 text-muted"
                }`}
              >
                {mockUsers.filter((u) => u.status === statusMap[tab.key]).length}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={filteredUsers as any[]}
          searchable
          searchKeys={["name", "city", "religion", "caste", "education"]}
          bulkActions={[
            { label: "Approve Selected", onClick: handleBulkApprove },
            { label: "Reject Selected", onClick: handleBulkReject, variant: "danger" },
          ]}
          rowKey={(row) => String(row.id)}
          onExport={() => toast("info", "Exporting filtered profiles as CSV...")}
        />
      </div>

      {/* Quick Preview Modal */}
      <ProfileModal
        open={previewUser !== null}
        user={previewUser}
        onClose={() => setPreviewUser(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {/* Bulk Action Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="Yes, proceed"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={confirmModal.action}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}
