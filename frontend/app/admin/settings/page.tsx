"use client";

import { useState } from "react";
import {
  Settings,
  Globe,
  Mail,
  CreditCard,
  Shield,
  Users,
  Key,
  Save,
  Plus,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Trash2,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import { mockSettings } from "@/lib/admin-mock-data";

// ── Types ────────────────────────────────────────────────────────────────────

type TabKey = "site" | "email" | "plans" | "moderation" | "admins" | "apikeys";

interface AdminUserEntry {
  id: string;
  email: string;
  role: string;
  lastLogin: string;
}

// ── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-rose" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className="font-body text-sm text-deep">{label}</span>
    </label>
  );
}

// ── Input Field ──────────────────────────────────────────────────────────────

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
        style={{ borderColor: "rgba(201,149,74,0.2)" }}
      />
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("site");

  // Site Settings
  const [siteName, setSiteName] = useState(mockSettings.site.name);
  const [tagline, setTagline] = useState(mockSettings.site.tagline);
  const [maintenanceMode, setMaintenanceMode] = useState(mockSettings.site.maintenanceMode);
  const [registrationOpen, setRegistrationOpen] = useState(mockSettings.site.registrationOpen);

  // Email Templates
  const [templates, setTemplates] = useState(
    mockSettings.emailTemplates.map((t) => ({ ...t })),
  );
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  // Subscription Plans
  const [plans, setPlans] = useState(
    mockSettings.subscriptionPlans.map((p) => ({
      ...p,
      features: [...p.features],
    })),
  );

  // Moderation
  const [autoApprove, setAutoApprove] = useState(mockSettings.moderation.autoApproveProfiles);
  const [photoMod, setPhotoMod] = useState(mockSettings.moderation.photoModeration);
  const [maxPhotos, setMaxPhotos] = useState(mockSettings.moderation.maxPhotos);
  const [minAge, setMinAge] = useState(mockSettings.moderation.minAge);

  // Admin Users
  const [adminUsers, setAdminUsers] = useState<AdminUserEntry[]>(
    mockSettings.adminUsers.map((a) => ({ ...a })),
  );
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("Moderator");

  // API Keys
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [rotateKeyTarget, setRotateKeyTarget] = useState<string | null>(null);

  // ── Tabs ─────────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: typeof Settings }[] = [
    { key: "site", label: "Site Settings", icon: Globe },
    { key: "email", label: "Email Templates", icon: Mail },
    { key: "plans", label: "Subscription Plans", icon: CreditCard },
    { key: "moderation", label: "Moderation", icon: Shield },
    { key: "admins", label: "Admin Users", icon: Users },
    { key: "apikeys", label: "API Keys", icon: Key },
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveSite = () => {
    toast("success", "Site settings saved successfully");
  };

  const handleSaveTemplate = (id: string) => {
    toast("success", `Email template "${id}" saved`);
  };

  const updateTemplate = (id: string, field: "subject" | "body", value: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );
  };

  const handleSavePlan = (planId: string) => {
    toast("success", `Plan "${planId}" updated successfully`);
  };

  const updatePlanPrice = (planId: string, price: number) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, price } : p)),
    );
  };

  const updatePlanFeature = (planId: string, featureIdx: number, value: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? { ...p, features: p.features.map((f, i) => (i === featureIdx ? value : f)) }
          : p,
      ),
    );
  };

  const handleSaveModeration = () => {
    toast("success", "Moderation settings saved");
  };

  const handleAddAdmin = () => {
    if (!newAdminEmail.trim()) {
      toast("error", "Email is required");
      return;
    }
    const newUser: AdminUserEntry = {
      id: `A${Date.now()}`,
      email: newAdminEmail,
      role: newAdminRole,
      lastLogin: "Never",
    };
    setAdminUsers((prev) => [...prev, newUser]);
    setNewAdminEmail("");
    setNewAdminRole("Moderator");
    setShowAddAdmin(false);
    toast("success", `Admin user ${newAdminEmail} added`);
  };

  const handleRemoveAdmin = (id: string) => {
    setAdminUsers((prev) => prev.filter((a) => a.id !== id));
    toast("success", "Admin user removed");
  };

  const handleRotateKey = () => {
    toast("success", `API key "${rotateKeyTarget}" rotated successfully`);
    setRotateKeyTarget(null);
  };

  // ── API keys config ──────────────────────────────────────────────────────

  const apiKeys = [
    { name: "Resend", maskedKey: "res_****xxxx", fullKey: "res_live_abcdef1234xxxx" },
    { name: "Razorpay", maskedKey: "rzp_****xxxx", fullKey: "rzp_live_ghijk5678xxxx" },
  ];

  // ── Plan colors ──────────────────────────────────────────────────────────

  const planColors: Record<string, string> = {
    silver: "from-gray-100 to-gray-200 border-gray-300",
    gold: "from-amber-50 to-amber-100 border-amber-300",
    diamond: "from-rose-50 to-pink-100 border-rose-300",
  };

  return (
    <div className="min-h-screen">
      <TopBar
        title="Settings"
        subtitle="Platform configuration"
        actions={
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-rose" />
          </div>
        }
      />

      <div className="p-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-blush/50 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-white text-deep shadow-sm"
                    : "text-muted hover:text-deep"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Site Settings ─────────────────────────────────────────────── */}
        {activeTab === "site" && (
          <div className="glass-card p-6 space-y-5 max-w-2xl">
            <h3 className="font-display text-sm font-semibold text-deep flex items-center gap-2">
              <Globe className="w-4 h-4 text-gold" />
              Site Settings
            </h3>
            <FormInput label="Site Name" value={siteName} onChange={setSiteName} />
            <FormInput label="Tagline" value={tagline} onChange={setTagline} />
            <div className="space-y-3 pt-2">
              <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} label="Maintenance Mode" />
              <Toggle checked={registrationOpen} onChange={setRegistrationOpen} label="Registration Open" />
            </div>
            <button onClick={handleSaveSite} className="btn-primary flex items-center gap-2 px-5 py-2 rounded-xl font-body text-sm font-semibold">
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        )}

        {/* ── Email Templates ───────────────────────────────────────────── */}
        {activeTab === "email" && (
          <div className="space-y-4 max-w-3xl">
            <h3 className="font-display text-sm font-semibold text-deep flex items-center gap-2">
              <Mail className="w-4 h-4 text-gold" />
              Email Templates
            </h3>
            {templates.map((tmpl) => {
              const isExpanded = expandedTemplate === tmpl.id;
              return (
                <div key={tmpl.id} className="glass-card overflow-hidden">
                  <button
                    onClick={() => setExpandedTemplate(isExpanded ? null : tmpl.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-blush/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted" />
                      <span className="font-body text-sm font-medium text-deep">{tmpl.name}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: "rgba(201,149,74,0.1)" }}>
                      <div className="pt-4">
                        <FormInput
                          label="Subject"
                          value={tmpl.subject}
                          onChange={(val) => updateTemplate(tmpl.id, "subject", val)}
                        />
                      </div>
                      <div>
                        <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">
                          Body
                        </label>
                        <textarea
                          value={tmpl.body}
                          onChange={(e) => updateTemplate(tmpl.id, "body", e.target.value)}
                          rows={6}
                          className="w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors resize-none font-mono"
                          style={{ borderColor: "rgba(201,149,74,0.2)" }}
                        />
                      </div>
                      <button
                        onClick={() => handleSaveTemplate(tmpl.id)}
                        className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl font-body text-sm font-semibold"
                      >
                        <Save className="w-4 h-4" />
                        Save Template
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Subscription Plans ────────────────────────────────────────── */}
        {activeTab === "plans" && (
          <div className="space-y-4">
            <h3 className="font-display text-sm font-semibold text-deep flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gold" />
              Subscription Plans
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`glass-card overflow-hidden border-t-4 ${
                    plan.id === "silver"
                      ? "border-t-gray-400"
                      : plan.id === "gold"
                      ? "border-t-amber-400"
                      : "border-t-rose"
                  }`}
                >
                  <div className={`p-4 bg-gradient-to-b ${planColors[plan.id]}`}>
                    <h4 className="font-display text-lg font-bold text-deep">{plan.name}</h4>
                    <p className="font-body text-xs text-muted">{plan.duration} days</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">
                        Price (INR)
                      </label>
                      <input
                        type="number"
                        value={plan.price}
                        onChange={(e) => updatePlanPrice(plan.id, Number(e.target.value))}
                        className="w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                        style={{ borderColor: "rgba(201,149,74,0.2)" }}
                      />
                    </div>
                    <div>
                      <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">
                        Features
                      </label>
                      <div className="space-y-2">
                        {plan.features.map((feature, idx) => (
                          <input
                            key={idx}
                            type="text"
                            value={feature}
                            onChange={(e) => updatePlanFeature(plan.id, idx, e.target.value)}
                            className="w-full rounded-lg border px-3 py-1.5 font-body text-xs text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                            style={{ borderColor: "rgba(201,149,74,0.15)" }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSavePlan(plan.id)}
                      className="w-full btn-primary flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-body text-sm font-semibold"
                    >
                      <Save className="w-4 h-4" />
                      Save Plan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Moderation Settings ───────────────────────────────────────── */}
        {activeTab === "moderation" && (
          <div className="glass-card p-6 space-y-5 max-w-2xl">
            <h3 className="font-display text-sm font-semibold text-deep flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold" />
              Moderation Settings
            </h3>
            <div className="space-y-3">
              <Toggle checked={autoApprove} onChange={setAutoApprove} label="Auto-approve Profiles" />
              <Toggle checked={photoMod} onChange={setPhotoMod} label="Photo Moderation" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">
                  Max Photos per User
                </label>
                <input
                  type="number"
                  value={maxPhotos}
                  onChange={(e) => setMaxPhotos(Number(e.target.value))}
                  min={1}
                  max={20}
                  className="w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">
                  Minimum Age
                </label>
                <input
                  type="number"
                  value={minAge}
                  onChange={(e) => setMinAge(Number(e.target.value))}
                  min={18}
                  max={30}
                  className="w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
            </div>
            <button onClick={handleSaveModeration} className="btn-primary flex items-center gap-2 px-5 py-2 rounded-xl font-body text-sm font-semibold">
              <Save className="w-4 h-4" />
              Save Moderation Settings
            </button>
          </div>
        )}

        {/* ── Admin Users ───────────────────────────────────────────────── */}
        {activeTab === "admins" && (
          <div className="glass-card p-6 space-y-5 max-w-3xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-deep flex items-center gap-2">
                <Users className="w-4 h-4 text-gold" />
                Admin Users
              </h3>
              <button
                onClick={() => setShowAddAdmin(!showAddAdmin)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-xs font-medium text-rose hover:bg-rose/5 transition-colors border border-rose/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Admin
              </button>
            </div>

            {showAddAdmin && (
              <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: "rgba(201,149,74,0.15)", background: "rgba(255,245,247,0.5)" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormInput label="Email" value={newAdminEmail} onChange={setNewAdminEmail} placeholder="admin@example.com" />
                  <div>
                    <label className="font-body text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">
                      Role
                    </label>
                    <select
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                      style={{ borderColor: "rgba(201,149,74,0.2)" }}
                    >
                      <option value="Super Admin">Super Admin</option>
                      <option value="Moderator">Moderator</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddAdmin}
                    className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl font-body text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddAdmin(false)}
                    className="px-4 py-2 rounded-xl font-body text-sm font-medium text-deep/60 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Admin users table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gold/10">
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold text-muted uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold text-muted uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold text-muted uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-right font-body text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((admin) => (
                    <tr key={admin.id} className="border-b border-gold/5 hover:bg-blush/30 transition-colors">
                      <td className="px-4 py-3 font-body text-sm text-deep">{admin.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                          admin.role === "Super Admin"
                            ? "bg-rose-50 text-rose border-rose-200"
                            : admin.role === "Moderator"
                            ? "bg-blue-50 text-blue-600 border-blue-200"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}>
                          {admin.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-muted">{admin.lastLogin}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemoveAdmin(admin.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Remove admin"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── API Keys ──────────────────────────────────────────────────── */}
        {activeTab === "apikeys" && (
          <div className="glass-card p-6 space-y-5 max-w-2xl">
            <h3 className="font-display text-sm font-semibold text-deep flex items-center gap-2">
              <Key className="w-4 h-4 text-gold" />
              API Keys
            </h3>
            <p className="font-body text-xs text-muted">
              API keys are sensitive. Handle with care. Rotating a key will invalidate the old one immediately.
            </p>
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.name}
                  className="flex items-center justify-between p-4 rounded-xl border"
                  style={{ borderColor: "rgba(201,149,74,0.15)", background: "rgba(255,245,247,0.3)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                      <Key className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium text-deep">{key.name}</p>
                      <p className="font-mono text-xs text-muted mt-0.5">
                        {showKeys[key.name] ? key.fullKey : key.maskedKey}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setShowKeys((prev) => ({ ...prev, [key.name]: !prev[key.name] }))
                      }
                      className="p-2 rounded-lg text-muted hover:text-deep hover:bg-blush transition-colors"
                      title={showKeys[key.name] ? "Hide key" : "Show key"}
                    >
                      {showKeys[key.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setRotateKeyTarget(key.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors border border-amber-200"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Rotate Key
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rotate Key Confirm Modal */}
      {rotateKeyTarget && (
        <ConfirmModal
          open
          title="Rotate API Key"
          message={`Are you sure you want to rotate the ${rotateKeyTarget} API key? The current key will stop working immediately and all services using it will need to be updated.`}
          confirmLabel="Rotate Key"
          variant="warning"
          onConfirm={handleRotateKey}
          onCancel={() => setRotateKeyTarget(null)}
        />
      )}
    </div>
  );
}
