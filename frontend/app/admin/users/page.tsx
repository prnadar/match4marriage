"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Eye, Edit2, Ban, ShieldOff, Trash2, MoreHorizontal,
  UserCheck, UserX, Download, Filter,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import DataTable from "@/components/admin/DataTable";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import { mockUsers, type AdminUser } from "@/lib/admin-mock-data";

// ── Constants ───────────────────────────────────────────────────────────────

const RELIGIONS = ["Hindu", "Sikh", "Christian", "Jain", "Buddhist", "Parsi", "Muslim"];
const CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow", "Chandigarh", "Indore", "Surat", "Nagpur", "Bhopal"];
const SUBSCRIPTIONS: AdminUser["subscription"][] = ["Free", "Silver", "Gold", "Diamond"];
const STATUSES: AdminUser["status"][] = ["active", "suspended", "banned", "pending"];

const STATUS_BADGES: Record<AdminUser["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-amber-100 text-amber-700",
  banned: "bg-red-100 text-red-700",
  pending: "bg-blue-100 text-blue-700",
};

const SUB_BADGES: Record<AdminUser["subscription"], string> = {
  Free: "bg-gray-100 text-gray-600",
  Silver: "bg-slate-200 text-slate-700",
  Gold: "bg-amber-100 text-amber-700",
  Diamond: "bg-purple-100 text-purple-700",
};

// ── Types ───────────────────────────────────────────────────────────────────

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  variant: "danger" | "warning" | "default";
  confirmLabel: string;
  onConfirm: () => void;
}

const INITIAL_CONFIRM: ConfirmState = {
  open: false,
  title: "",
  message: "",
  variant: "danger",
  confirmLabel: "Confirm",
  onConfirm: () => {},
};

// ── Row Actions Menu ────────────────────────────────────────────────────────

function RowActions({
  user,
  onSuspend,
  onBan,
  onDelete,
}: {
  user: AdminUser;
  onSuspend: (u: AdminUser) => void;
  onBan: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg hover:bg-blush transition-colors"
      >
        <MoreHorizontal className="w-4 h-4 text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 w-44 bg-white rounded-xl shadow-xl border border-gold/10 py-1 animate-float-in">
            <Link
              href={`/admin/users/${user.id}`}
              className="flex items-center gap-2 px-3 py-2 font-body text-sm text-deep hover:bg-blush transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> View Profile
            </Link>
            <Link
              href={`/admin/users/${user.id}`}
              className="flex items-center gap-2 px-3 py-2 font-body text-sm text-deep hover:bg-blush transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Link>
            <button
              onClick={() => { setOpen(false); onSuspend(user); }}
              className="flex items-center gap-2 w-full px-3 py-2 font-body text-sm text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <ShieldOff className="w-3.5 h-3.5" /> Suspend
            </button>
            <button
              onClick={() => { setOpen(false); onBan(user); }}
              className="flex items-center gap-2 w-full px-3 py-2 font-body text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" /> Ban
            </button>
            <div className="border-t border-gold/10 my-1" />
            <button
              onClick={() => { setOpen(false); onDelete(user); }}
              className="flex items-center gap-2 w-full px-3 py-2 font-body text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Filter Select ───────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border px-3 py-2 font-body text-xs text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
      style={{ borderColor: "rgba(201,149,74,0.2)" }}
      aria-label={label}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { toast } = useToast();

  // Filter state
  const [statusFilter, setStatusFilter] = useState("all");
  const [religionFilter, setReligionFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");

  // Users state (mutable copy for actions)
  const [users, setUsers] = useState<AdminUser[]>(mockUsers);

  // Confirm modal
  const [confirm, setConfirm] = useState<ConfirmState>(INITIAL_CONFIRM);

  // Filtered data
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (religionFilter !== "all" && u.religion !== religionFilter) return false;
      if (cityFilter !== "all" && u.city !== cityFilter) return false;
      if (subFilter !== "all" && u.subscription !== subFilter) return false;
      return true;
    });
  }, [users, statusFilter, religionFilter, cityFilter, subFilter]);

  // ── Action handlers ─────────────────────────────────────────────────────

  const changeStatus = useCallback(
    (ids: string[], newStatus: AdminUser["status"], label: string) => {
      setUsers((prev) =>
        prev.map((u) =>
          ids.includes(u.id) ? { ...u, status: newStatus } : u
        )
      );
      toast("success", `${ids.length} user(s) ${label} successfully`);
    },
    [toast]
  );

  const promptSuspend = useCallback(
    (target: AdminUser | string[]) => {
      const ids = Array.isArray(target) ? target : [target.id];
      const name = Array.isArray(target) ? `${ids.length} user(s)` : target.name;
      setConfirm({
        open: true,
        title: "Suspend User",
        message: `Are you sure you want to suspend ${name}? They will not be able to access their account.`,
        variant: "warning",
        confirmLabel: "Suspend",
        onConfirm: () => {
          changeStatus(ids, "suspended", "suspended");
          setConfirm(INITIAL_CONFIRM);
        },
      });
    },
    [changeStatus]
  );

  const promptBan = useCallback(
    (target: AdminUser | string[]) => {
      const ids = Array.isArray(target) ? target : [target.id];
      const name = Array.isArray(target) ? `${ids.length} user(s)` : target.name;
      setConfirm({
        open: true,
        title: "Ban User",
        message: `Are you sure you want to ban ${name}? This action will permanently restrict their account.`,
        variant: "danger",
        confirmLabel: "Ban",
        onConfirm: () => {
          changeStatus(ids, "banned", "banned");
          setConfirm(INITIAL_CONFIRM);
        },
      });
    },
    [changeStatus]
  );

  const promptDelete = useCallback(
    (target: AdminUser | string[]) => {
      const ids = Array.isArray(target) ? target : [target.id];
      const name = Array.isArray(target) ? `${ids.length} user(s)` : target.name;
      setConfirm({
        open: true,
        title: "Delete User",
        message: `Are you sure you want to permanently delete ${name}? This action cannot be undone.`,
        variant: "danger",
        confirmLabel: "Delete",
        onConfirm: () => {
          setUsers((prev) => prev.filter((u) => !ids.includes(u.id)));
          toast("success", `${ids.length} user(s) deleted successfully`);
          setConfirm(INITIAL_CONFIRM);
        },
      });
    },
    [toast]
  );

  const handleExport = useCallback(() => {
    const headers = ["ID", "Name", "Email", "Phone", "City", "Religion", "Status", "Subscription", "Joined", "Last Active"];
    const rows = filteredUsers.map((u) => [u.id, u.name, u.email, u.phone, u.city, u.religion, u.status, u.subscription, u.joined, u.lastActive]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "CSV exported successfully");
  }, [filteredUsers, toast]);

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: "id",
        label: "ID",
        sortable: true,
        className: "whitespace-nowrap",
        render: (row: AdminUser) => (
          <span className="font-mono text-xs text-muted">{row.id}</span>
        ),
      },
      {
        key: "name",
        label: "Name",
        sortable: true,
        render: (row: AdminUser) => (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose/10 flex items-center justify-center flex-shrink-0">
              <span className="font-display text-xs font-bold text-rose">
                {row.name.charAt(0)}
              </span>
            </div>
            <Link
              href={`/admin/users/${row.id}`}
              className="font-medium text-deep hover:text-rose transition-colors"
            >
              {row.name}
            </Link>
          </div>
        ),
      },
      {
        key: "email",
        label: "Email",
        sortable: true,
        className: "whitespace-nowrap",
      },
      {
        key: "phone",
        label: "Phone",
        sortable: false,
        className: "whitespace-nowrap",
      },
      {
        key: "city",
        label: "City",
        sortable: true,
      },
      {
        key: "religion",
        label: "Religion",
        sortable: true,
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (row: AdminUser) => (
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGES[row.status]}`}
          >
            {row.status}
          </span>
        ),
      },
      {
        key: "subscription",
        label: "Plan",
        sortable: true,
        render: (row: AdminUser) => (
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${SUB_BADGES[row.subscription]}`}
          >
            {row.subscription}
          </span>
        ),
      },
      {
        key: "joined",
        label: "Joined",
        sortable: true,
        className: "whitespace-nowrap",
      },
      {
        key: "lastActive",
        label: "Last Active",
        sortable: true,
        className: "whitespace-nowrap",
      },
      {
        key: "_actions",
        label: "",
        render: (row: AdminUser) => (
          <RowActions
            user={row}
            onSuspend={(u) => promptSuspend(u)}
            onBan={(u) => promptBan(u)}
            onDelete={(u) => promptDelete(u)}
          />
        ),
      },
    ],
    [promptSuspend, promptBan, promptDelete]
  );

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const bulkActions = useMemo(
    () => [
      {
        label: "Activate",
        onClick: (ids: string[]) => changeStatus(ids, "active", "activated"),
      },
      {
        label: "Suspend",
        onClick: (ids: string[]) => promptSuspend(ids),
      },
      {
        label: "Ban",
        onClick: (ids: string[]) => promptBan(ids),
      },
      {
        label: "Delete",
        variant: "danger" as const,
        onClick: (ids: string[]) => promptDelete(ids),
      },
      {
        label: "Export CSV",
        onClick: () => handleExport(),
      },
    ],
    [changeStatus, promptSuspend, promptBan, promptDelete, handleExport]
  );

  // ── Filter bar ────────────────────────────────────────────────────────────

  const filterBar = (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="w-3.5 h-3.5 text-muted" />
      <FilterSelect
        label="Status"
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: "all", label: "All Status" },
          ...STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
        ]}
      />
      <FilterSelect
        label="Religion"
        value={religionFilter}
        onChange={setReligionFilter}
        options={[
          { value: "all", label: "All Religions" },
          ...RELIGIONS.map((r) => ({ value: r, label: r })),
        ]}
      />
      <FilterSelect
        label="City"
        value={cityFilter}
        onChange={setCityFilter}
        options={[
          { value: "all", label: "All Cities" },
          ...CITIES.map((c) => ({ value: c, label: c })),
        ]}
      />
      <FilterSelect
        label="Subscription"
        value={subFilter}
        onChange={setSubFilter}
        options={[
          { value: "all", label: "All Plans" },
          ...SUBSCRIPTIONS.map((s) => ({ value: s, label: s })),
        ]}
      />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <TopBar title="Users" subtitle="Manage all registered users" />

      <div className="p-6 space-y-4">
        <DataTable<AdminUser>
          columns={columns}
          data={filteredUsers}
          searchable
          searchPlaceholder="Search by name, email, or phone..."
          searchKeys={["name", "email", "phone"]}
          pageSizes={[25, 50, 100]}
          bulkActions={bulkActions}
          rowKey={(row) => row.id}
          onExport={handleExport}
          filters={filterBar}
          emptyMessage="No users match the current filters"
        />
      </div>

      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        variant={confirm.variant}
        confirmLabel={confirm.confirmLabel}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(INITIAL_CONFIRM)}
      />
    </div>
  );
}
