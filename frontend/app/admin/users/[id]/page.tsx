"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit2, ShieldOff, Ban, Trash2, Crown, KeyRound,
  User, Briefcase, GraduationCap, Heart, Users, Calendar,
  MapPin, Phone, Mail, Clock, MessageSquare, Activity,
  ChevronDown,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import { mockUsers, type AdminUser } from "@/lib/admin-mock-data";

// ── Constants ───────────────────────────────────────────────────────────────

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

const MOCK_ACTIVITY_LOG = [
  { id: "a1", type: "login", description: "Logged in from Mumbai, Chrome/Win", time: "2 hours ago" },
  { id: "a2", type: "login", description: "Logged in from Mumbai, Mobile App", time: "1 day ago" },
  { id: "a3", type: "match", description: "Matched with Priya Sharma (USR0002)", time: "2 days ago" },
  { id: "a4", type: "message", description: "Sent 4 messages to Kavya Patel", time: "2 days ago" },
  { id: "a5", type: "login", description: "Logged in from Pune, Safari/Mac", time: "3 days ago" },
  { id: "a6", type: "match", description: "Matched with Sneha Kumar (USR0006)", time: "5 days ago" },
  { id: "a7", type: "message", description: "Sent 6 messages to Ishita Singh", time: "5 days ago" },
  { id: "a8", type: "login", description: "Logged in from Mumbai, Mobile App", time: "1 week ago" },
  { id: "a9", type: "match", description: "Matched with Ananya Gupta (USR0004)", time: "1 week ago" },
  { id: "a10", type: "login", description: "Logged in from Delhi, Chrome/Android", time: "2 weeks ago" },
  { id: "a11", type: "message", description: "Received 3 messages from Nisha Verma", time: "2 weeks ago" },
  { id: "a12", type: "message", description: "Sent 7 messages to Riya Jain", time: "2 weeks ago" },
  { id: "a13", type: "message", description: "Sent 2 messages to Meera Reddy", time: "3 weeks ago" },
];

const ACTIVITY_ICONS: Record<string, typeof Activity> = {
  login: Clock,
  match: Heart,
  message: MessageSquare,
};

const ACTIVITY_COLORS: Record<string, string> = {
  login: "text-blue-500 bg-blue-50",
  match: "text-rose bg-rose/10",
  message: "text-emerald-500 bg-emerald-50",
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

// ── Info Row helper ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gold/5 last:border-0">
      <span className="font-body text-xs text-muted">{label}</span>
      <span className="font-body text-sm text-deep font-medium text-right">{value}</span>
    </div>
  );
}

// ── Section Card ────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-rose/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-rose" />
        </div>
        <h3 className="font-display text-sm font-semibold text-deep">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Status Dropdown ─────────────────────────────────────────────────────────

function StatusDropdown({
  current,
  onChange,
}: {
  current: AdminUser["status"];
  onChange: (status: AdminUser["status"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const statuses: AdminUser["status"][] = ["active", "suspended", "banned", "pending"];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border font-body text-sm text-deep hover:bg-blush transition-colors"
        style={{ borderColor: "rgba(201,149,74,0.2)" }}
      >
        <ShieldOff className="w-3.5 h-3.5" />
        Change Status
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-40 w-40 bg-white rounded-xl shadow-xl border border-gold/10 py-1 animate-float-in">
            {statuses
              .filter((s) => s !== current)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 font-body text-sm text-deep hover:bg-blush transition-colors capitalize"
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_BADGES[s].split(" ")[0]}`} />
                  {s}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const { toast } = useToast();

  const [confirm, setConfirm] = useState<ConfirmState>(INITIAL_CONFIRM);
  const [user, setUser] = useState<AdminUser | undefined>(() =>
    mockUsers.find((u) => u.id === userId)
  );

  // Build subscription history mock based on current user
  const subscriptionHistory = useMemo(() => {
    if (!user) return [];
    return [
      {
        plan: user.subscription,
        startDate: "2026-01-15",
        endDate: user.subscription === "Free" ? "N/A" : "2026-07-15",
        status: "Active" as const,
        amount: user.subscription === "Free" ? 0 : user.subscription === "Silver" ? 1999 : user.subscription === "Gold" ? 4999 : 9999,
      },
      {
        plan: "Silver",
        startDate: "2025-07-10",
        endDate: "2025-10-10",
        status: "Expired" as const,
        amount: 1999,
      },
      {
        plan: "Free",
        startDate: "2025-01-01",
        endDate: "2025-07-10",
        status: "Upgraded" as const,
        amount: 0,
      },
    ];
  }, [user]);

  const handleChangeStatus = useCallback(
    (newStatus: AdminUser["status"]) => {
      if (!user) return;
      const needsConfirm = newStatus === "suspended" || newStatus === "banned";
      if (needsConfirm) {
        setConfirm({
          open: true,
          title: `${newStatus === "suspended" ? "Suspend" : "Ban"} User`,
          message: `Are you sure you want to ${newStatus === "suspended" ? "suspend" : "ban"} ${user.name}?`,
          variant: newStatus === "banned" ? "danger" : "warning",
          confirmLabel: newStatus === "suspended" ? "Suspend" : "Ban",
          onConfirm: () => {
            setUser((prev) => (prev ? { ...prev, status: newStatus } : prev));
            toast("success", `User ${newStatus} successfully`);
            setConfirm(INITIAL_CONFIRM);
          },
        });
      } else {
        setUser((prev) => (prev ? { ...prev, status: newStatus } : prev));
        toast("success", `User status changed to ${newStatus}`);
      }
    },
    [user, toast]
  );

  const handleGrantPremium = useCallback(() => {
    if (!user) return;
    setUser((prev) => (prev ? { ...prev, subscription: "Diamond" } : prev));
    toast("success", `Diamond subscription granted to ${user.name}`);
  }, [user, toast]);

  const handleResetPassword = useCallback(() => {
    if (!user) return;
    toast("success", `Password reset link sent to ${user.email}`);
  }, [user, toast]);

  const handleDelete = useCallback(() => {
    if (!user) return;
    setConfirm({
      open: true,
      title: "Delete User",
      message: `Are you sure you want to permanently delete ${user.name}? This action cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: () => {
        toast("success", `User ${user.name} deleted`);
        setConfirm(INITIAL_CONFIRM);
        // In production, redirect after delete
      },
    });
  }, [user, toast]);

  // ── Not Found ─────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="min-h-screen">
        <TopBar title="User Not Found" />
        <div className="p-6">
          <div className="glass-card p-12 text-center">
            <User className="w-12 h-12 text-muted mx-auto mb-4" />
            <h2 className="font-display text-lg font-semibold text-deep mb-2">User Not Found</h2>
            <p className="font-body text-sm text-muted mb-6">
              No user exists with ID &quot;{userId}&quot;.
            </p>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose text-white font-body text-sm font-medium hover:bg-rose/90 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Users
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <TopBar
        title={user.name}
        subtitle={`${user.id} / ${user.city}, ${user.state}`}
        actions={
          <Link
            href="/admin/users"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-body text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Profile Header Card */}
        <div className="glass-card p-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Photo Placeholder */}
            <div className="w-28 h-28 rounded-2xl bg-rose/10 flex items-center justify-center flex-shrink-0">
              <span className="font-display text-3xl font-bold text-rose">
                {user.name.charAt(0)}
              </span>
            </div>

            {/* Basic Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-display text-2xl font-bold text-deep">{user.name}</h2>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGES[user.status]}`}>
                  {user.status}
                </span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${SUB_BADGES[user.subscription]}`}>
                  {user.subscription}
                </span>
              </div>
              <p className="font-body text-sm text-muted mt-1">
                {user.age} years, {user.gender} &middot; {user.maritalStatus}
              </p>
              <p className="font-body text-sm text-muted mt-0.5">
                {user.bio}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-muted">
                <span className="flex items-center gap-1 font-body text-xs">
                  <Mail className="w-3.5 h-3.5" /> {user.email}
                </span>
                <span className="flex items-center gap-1 font-body text-xs">
                  <Phone className="w-3.5 h-3.5" /> {user.phone}
                </span>
                <span className="flex items-center gap-1 font-body text-xs">
                  <MapPin className="w-3.5 h-3.5" /> {user.city}, {user.state}
                </span>
                <span className="flex items-center gap-1 font-body text-xs">
                  <Calendar className="w-3.5 h-3.5" /> Joined {user.joined}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-gold/10">
            <button
              onClick={() => toast("info", "Edit mode not available in demo")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border font-body text-sm text-deep hover:bg-blush transition-colors"
              style={{ borderColor: "rgba(201,149,74,0.2)" }}
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit Profile
            </button>
            <StatusDropdown current={user.status} onChange={handleChangeStatus} />
            <button
              onClick={handleGrantPremium}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 font-body text-sm text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <Crown className="w-3.5 h-3.5" /> Grant Premium
            </button>
            <button
              onClick={handleResetPassword}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border font-body text-sm text-deep hover:bg-blush transition-colors"
              style={{ borderColor: "rgba(201,149,74,0.2)" }}
            >
              <KeyRound className="w-3.5 h-3.5" /> Reset Password
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 font-body text-sm text-red-600 hover:bg-red-100 transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Account
            </button>
          </div>
        </div>

        {/* Info Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Info */}
          <SectionCard title="Personal Info" icon={User}>
            <InfoRow label="Full Name" value={user.name} />
            <InfoRow label="Age" value={`${user.age} years`} />
            <InfoRow label="Gender" value={user.gender} />
            <InfoRow label="Height" value={user.height} />
            <InfoRow label="Marital Status" value={user.maritalStatus} />
            <InfoRow label="Mother Tongue" value={user.motherTongue} />
            <InfoRow label="Manglik" value={user.manglik} />
            <InfoRow label="City" value={user.city} />
            <InfoRow label="State" value={user.state} />
          </SectionCard>

          {/* Religion & Community */}
          <SectionCard title="Religion & Community" icon={Heart}>
            <InfoRow label="Religion" value={user.religion} />
            <InfoRow label="Caste" value={user.caste} />
            <InfoRow label="Gotra" value={user.gotra} />
          </SectionCard>

          {/* Education & Career */}
          <SectionCard title="Education & Career" icon={GraduationCap}>
            <InfoRow label="Education" value={user.education} />
            <InfoRow label="Occupation" value={user.occupation} />
            <InfoRow label="Income" value={user.income} />
          </SectionCard>

          {/* Family Details */}
          <SectionCard title="Family Details" icon={Users}>
            <InfoRow label="Family Type" value={user.familyType} />
            <InfoRow label="Father's Occupation" value={user.fatherOccupation} />
            <InfoRow label="Mother's Occupation" value={user.motherOccupation} />
            <InfoRow label="Siblings" value={user.siblings} />
          </SectionCard>
        </div>

        {/* Activity & Subscription Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Log */}
          <div className="lg:col-span-2 glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-rose" />
              </div>
              <h3 className="font-display text-sm font-semibold text-deep">Activity Log</h3>
              <span className="ml-auto font-body text-xs text-muted">
                5 logins &middot; 3 matches &middot; 10 messages
              </span>
            </div>
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {MOCK_ACTIVITY_LOG.map((entry) => {
                const Icon = ACTIVITY_ICONS[entry.type] || Activity;
                const color = ACTIVITY_COLORS[entry.type] || "text-muted bg-gray-50";
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-blush/30 transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-deep">{entry.description}</p>
                      <p className="font-body text-xs text-muted mt-0.5">{entry.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subscription History */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose/10 flex items-center justify-center">
                <Crown className="w-4 h-4 text-rose" />
              </div>
              <h3 className="font-display text-sm font-semibold text-deep">Subscription History</h3>
            </div>
            <div className="space-y-3">
              {subscriptionHistory.map((sub, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border ${
                    i === 0
                      ? "border-rose/20 bg-rose/5"
                      : "border-gold/10 bg-white/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      SUB_BADGES[sub.plan as AdminUser["subscription"]] || "bg-gray-100 text-gray-600"
                    }`}>
                      {sub.plan}
                    </span>
                    <span className={`font-body text-xs font-medium ${
                      sub.status === "Active"
                        ? "text-emerald-600"
                        : sub.status === "Expired"
                        ? "text-red-500"
                        : "text-blue-500"
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                  <div className="font-body text-xs text-muted mt-1">
                    {sub.startDate} &mdash; {sub.endDate}
                  </div>
                  {sub.amount > 0 && (
                    <div className="font-body text-sm font-medium text-deep mt-1">
                      &#8377;{sub.amount.toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
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
