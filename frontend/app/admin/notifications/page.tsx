"use client";

import { useState } from "react";
import {
  Bell,
  Send,
  Clock,
  Users,
  User,
  Filter,
  Mail,
  Smartphone,
  MessageSquare,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import DataTable from "@/components/admin/DataTable";
import { useToast } from "@/components/admin/Toast";
import { mockNotifications, type AdminNotification } from "@/lib/admin-mock-data";

// ── Types ────────────────────────────────────────────────────────────────────

type TargetType = "all" | "specific" | "segment";
type NotificationType = "push" | "email" | "in-app";
type Segment = "Premium" | "Free" | "City" | "Religion";

// ── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: AdminNotification["type"] }) {
  const map: Record<string, { bg: string; icon: typeof Bell }> = {
    push: { bg: "bg-blue-50 text-blue-600 border-blue-200", icon: Smartphone },
    email: { bg: "bg-amber-50 text-amber-600 border-amber-200", icon: Mail },
    "in-app": { bg: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: MessageSquare },
  };
  const config = map[type];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg}`}>
      <Icon className="w-3 h-3" />
      {type}
    </span>
  );
}

// ── Preview Section ──────────────────────────────────────────────────────────

function NotificationPreview({
  type,
  title,
  message,
}: {
  type: NotificationType;
  title: string;
  message: string;
}) {
  if (!title && !message) {
    return (
      <div className="border border-dashed rounded-xl p-6 text-center" style={{ borderColor: "rgba(201,149,74,0.2)" }}>
        <Bell className="w-8 h-8 text-muted/30 mx-auto mb-2" />
        <p className="font-body text-sm text-muted">Fill in the fields to see a preview</p>
      </div>
    );
  }

  if (type === "push") {
    return (
      <div className="bg-gray-900 rounded-2xl p-4 max-w-xs mx-auto shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4 text-rose" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{title || "Notification Title"}</p>
            <p className="text-white/60 text-xs mt-0.5 line-clamp-2">{message || "Message body..."}</p>
            <p className="text-white/30 text-[10px] mt-1">Match4Marriage &middot; now</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === "email") {
    return (
      <div className="bg-white border rounded-xl overflow-hidden max-w-sm mx-auto shadow-sm" style={{ borderColor: "rgba(201,149,74,0.2)" }}>
        <div className="bg-gradient-to-r from-rose to-gold p-3">
          <p className="text-white text-xs font-semibold">Match4Marriage</p>
        </div>
        <div className="p-4">
          <h4 className="font-display text-sm font-semibold text-deep">{title || "Email Subject"}</h4>
          <p className="font-body text-xs text-muted mt-2 whitespace-pre-wrap">{message || "Email body..."}</p>
        </div>
        <div className="border-t p-3 text-center" style={{ borderColor: "rgba(201,149,74,0.1)" }}>
          <p className="text-[10px] text-muted">Match4Marriage &middot; The Sacred Bond</p>
        </div>
      </div>
    );
  }

  // in-app
  return (
    <div className="bg-blush/50 border rounded-xl p-4 max-w-sm mx-auto" style={{ borderColor: "rgba(201,149,74,0.15)" }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-rose/10 flex items-center justify-center flex-shrink-0">
          <Bell className="w-4 h-4 text-rose" />
        </div>
        <div className="flex-1">
          <p className="font-body text-sm font-semibold text-deep">{title || "Notification"}</p>
          <p className="font-body text-xs text-muted mt-1">{message || "Message..."}</p>
          <p className="font-body text-[10px] text-muted/60 mt-2">Just now</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { toast } = useToast();

  // Form state
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [specificUser, setSpecificUser] = useState("");
  const [segment, setSegment] = useState<Segment>("Premium");
  const [notifType, setNotifType] = useState<NotificationType>("push");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  // Notification history
  const [notifications, setNotifications] = useState<AdminNotification[]>(mockNotifications);

  const resetForm = () => {
    setTargetType("all");
    setSpecificUser("");
    setSegment("Premium");
    setNotifType("push");
    setTitle("");
    setMessage("");
    setScheduleEnabled(false);
    setScheduleDate("");
  };

  const handleSend = () => {
    if (!title.trim()) {
      toast("error", "Title is required");
      return;
    }
    if (!message.trim()) {
      toast("error", "Message is required");
      return;
    }
    if (targetType === "specific" && !specificUser.trim()) {
      toast("error", "Please enter a user to target");
      return;
    }
    if (scheduleEnabled && !scheduleDate) {
      toast("error", "Please select a schedule date and time");
      return;
    }

    const targetLabel =
      targetType === "all"
        ? "All Users"
        : targetType === "specific"
        ? specificUser
        : `Segment: ${segment}`;

    const newNotification: AdminNotification = {
      id: `N${Date.now()}`,
      title,
      message,
      type: notifType,
      target: targetLabel,
      sentAt: scheduleEnabled ? scheduleDate : new Date().toISOString().split("T")[0],
      sentBy: "Admin",
      deliveredCount: 0,
    };

    setNotifications((prev) => [newNotification, ...prev]);

    if (scheduleEnabled) {
      toast("success", `Notification scheduled for ${scheduleDate}`);
    } else {
      toast("success", "Notification sent successfully");
    }

    resetForm();
  };

  // ── Table columns ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: { key: string; label: string; sortable?: boolean; render?: (row: any) => React.ReactNode }[] = [
    { key: "title", label: "Title", sortable: true },
    {
      key: "message",
      label: "Message",
      render: (row: AdminNotification) => (
        <span className="font-body text-xs text-muted line-clamp-1 max-w-[200px] block">
          {row.message}
        </span>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (row: AdminNotification) => <TypeBadge type={row.type} />,
    },
    { key: "target", label: "Target", sortable: true },
    { key: "sentAt", label: "Sent At", sortable: true },
    {
      key: "deliveredCount",
      label: "Delivered",
      sortable: true,
      render: (row: AdminNotification) => (
        <span className="font-body text-sm font-medium text-deep">
          {row.deliveredCount.toLocaleString("en-IN")}
        </span>
      ),
    },
    { key: "sentBy", label: "Sent By" },
  ];

  // ── Radio Button helper ────────────────────────────────────────────────────

  const RadioOption = ({
    name,
    value,
    checked,
    onChange,
    label,
    icon: Icon,
  }: {
    name: string;
    value: string;
    checked: boolean;
    onChange: () => void;
    label: string;
    icon?: typeof Bell;
  }) => (
    <label
      className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors border ${
        checked ? "bg-rose/5 border-rose/30 text-deep" : "border-transparent text-muted hover:bg-blush/50"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="accent-rose w-3.5 h-3.5"
      />
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span className="font-body text-sm">{label}</span>
    </label>
  );

  return (
    <div className="min-h-screen">
      <TopBar
        title="Notifications"
        subtitle="Send and manage notifications"
        actions={
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-rose" />
            <span className="font-body text-xs text-white/60">
              {notifications.length} sent
            </span>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Send Notification Form */}
        <div className="glass-card p-6">
          <h3 className="font-display text-sm font-semibold text-deep mb-5 flex items-center gap-2">
            <Send className="w-4 h-4 text-rose" />
            Send Notification
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form fields */}
            <div className="space-y-5">
              {/* Target */}
              <div>
                <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-2">
                  Target Audience
                </label>
                <div className="flex flex-wrap gap-2">
                  <RadioOption name="target" value="all" checked={targetType === "all"} onChange={() => setTargetType("all")} label="All Users" icon={Users} />
                  <RadioOption name="target" value="specific" checked={targetType === "specific"} onChange={() => setTargetType("specific")} label="Specific User" icon={User} />
                  <RadioOption name="target" value="segment" checked={targetType === "segment"} onChange={() => setTargetType("segment")} label="Segment" icon={Filter} />
                </div>
                {targetType === "specific" && (
                  <input
                    type="text"
                    value={specificUser}
                    onChange={(e) => setSpecificUser(e.target.value)}
                    placeholder="Search user by name or email..."
                    className="mt-3 w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                    style={{ borderColor: "rgba(201,149,74,0.2)" }}
                  />
                )}
                {targetType === "segment" && (
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value as Segment)}
                    className="mt-3 w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                    style={{ borderColor: "rgba(201,149,74,0.2)" }}
                  >
                    <option value="Premium">Premium Users</option>
                    <option value="Free">Free Users</option>
                    <option value="City">By City</option>
                    <option value="Religion">By Religion</option>
                  </select>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-2">
                  Notification Type
                </label>
                <div className="flex flex-wrap gap-2">
                  <RadioOption name="type" value="push" checked={notifType === "push"} onChange={() => setNotifType("push")} label="Push" icon={Smartphone} />
                  <RadioOption name="type" value="email" checked={notifType === "email"} onChange={() => setNotifType("email")} label="Email" icon={Mail} />
                  <RadioOption name="type" value="in-app" checked={notifType === "in-app"} onChange={() => setNotifType("in-app")} label="In-App" icon={MessageSquare} />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Notification title..."
                  className="w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>

              {/* Message */}
              <div>
                <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Notification message..."
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors resize-none"
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>

              {/* Schedule */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="rounded border-gold/30 text-rose focus:ring-rose/30"
                  />
                  <Clock className="w-3.5 h-3.5 text-muted" />
                  <span className="font-body text-sm text-deep">Schedule for later</span>
                </label>
                {scheduleEnabled && (
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="mt-3 w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                    style={{ borderColor: "rgba(201,149,74,0.2)" }}
                  />
                )}
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl font-body text-sm font-semibold"
              >
                <Send className="w-4 h-4" />
                {scheduleEnabled ? "Schedule" : "Send Now"}
              </button>
            </div>

            {/* Preview */}
            <div>
              <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-3">
                Preview
              </label>
              <NotificationPreview type={notifType} title={title} message={message} />
            </div>
          </div>
        </div>

        {/* Notification History */}
        <div className="glass-card p-1">
          <div className="p-5 pb-0">
            <h3 className="font-display text-sm font-semibold text-deep flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold" />
              Notification History
            </h3>
          </div>
          <DataTable
            columns={columns}
            data={notifications as any[]}
            searchable
            searchPlaceholder="Search notifications..."
            searchKeys={["title", "message", "target", "sentBy"]}
            emptyMessage="No notifications sent yet"
          />
        </div>
      </div>
    </div>
  );
}
