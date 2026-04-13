"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Mail, Phone, MapPin, Heart, Book, Briefcase,
  Crown, CheckCircle, XCircle, Send, Camera, Star, Users,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import { useToast } from "@/components/admin/Toast";
import { mockUsers, type AdminUser } from "@/lib/admin-mock-data";

const statusOptions: AdminUser["status"][] = ["active", "pending", "suspended", "banned"];

const statusColors: Record<AdminUser["status"], string> = {
  active: "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-600",
  suspended: "bg-orange-50 text-orange-600",
  banned: "bg-red-50 text-red-600",
};

const subscriptionColors: Record<AdminUser["subscription"], string> = {
  Free: "bg-gray-100 text-gray-600",
  Silver: "bg-slate-100 text-slate-600",
  Gold: "bg-amber-50 text-amber-600",
  Diamond: "bg-purple-50 text-purple-600",
};

const mockMatches = [
  { id: "M1", name: "Ananya Gupta", age: 26, city: "Delhi", compatibility: 87 },
  { id: "M2", name: "Kavya Patel", age: 25, city: "Mumbai", compatibility: 82 },
  { id: "M3", name: "Ishita Singh", age: 27, city: "Bangalore", compatibility: 78 },
];


export default function ProfileDetailPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const user = mockUsers.find((u) => u.id === userId);

  const [newStatus, setNewStatus] = useState<AdminUser["status"]>(user?.status ?? "pending");
  const [statusReason, setStatusReason] = useState("");
  const [photoStatuses, setPhotoStatuses] = useState<Record<number, "approved" | "rejected">>({});

  if (!user) {
    return (
      <>
        <TopBar title="Profile Not Found" />
        <div className="p-6">
          <div className="glass-card p-12 text-center">
            <p className="font-body text-muted">No profile found with ID: {userId}</p>
            <Link
              href="/admin/profiles"
              className="inline-flex items-center gap-2 mt-4 btn-primary text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Profiles
            </Link>
          </div>
        </div>
      </>
    );
  }

  const handleStatusChange = () => {
    if (!statusReason.trim()) {
      toast("warning", "Please provide a reason for the status change");
      return;
    }
    toast("success", `Profile status changed to "${newStatus}" successfully`);
    setStatusReason("");
  };

  const handlePhotoAction = (index: number, action: "approved" | "rejected") => {
    setPhotoStatuses((prev) => ({ ...prev, [index]: action }));
    toast("success", `Photo ${index + 1} ${action}`);
  };

  return (
    <>
      <TopBar
        title={user.name}
        subtitle={`Profile ID: ${user.id}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/profiles/edit/${user.id}`}
              className="px-3 py-1.5 rounded-xl font-body text-xs font-medium text-muted hover:text-deep hover:bg-white/10 transition-colors"
            >
              Edit Profile
            </Link>
            <button
              onClick={() => toast("success", "Email sent to " + user.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-body text-xs font-medium bg-rose/20 text-rose hover:bg-rose/30 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Send Email
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push("/admin/profiles")}
          className="flex items-center gap-2 font-body text-sm text-muted hover:text-deep transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profiles
        </button>

        {/* Header Card */}
        <div className="glass-card overflow-hidden">
          <div className="h-24" style={{ background: "linear-gradient(135deg, #E8426A 0%, #C9954A 100%)" }} />
          <div className="px-6 pb-6 -mt-10">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="w-20 h-20 rounded-2xl bg-blush border-4 border-white flex items-center justify-center text-rose shadow-card">
                <User className="w-8 h-8" />
              </div>
              <div className="flex-1 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-xl font-bold text-deep">{user.name}</h2>
                  <span className={`px-2.5 py-1 rounded-lg font-body text-xs font-medium ${statusColors[user.status]}`}>
                    {user.status}
                  </span>
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-body text-xs font-medium ${subscriptionColors[user.subscription]}`}>
                    <Crown className="w-3 h-3" />
                    {user.subscription}
                  </span>
                </div>
                <p className="font-body text-sm text-muted mt-1">
                  {user.age} yrs, {user.gender} &middot; {user.city}, {user.state}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-2 font-body text-xs text-muted">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone}</span>
                  <span>Joined: {user.joined}</span>
                  <span>Last active: {user.lastActive}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Details */}
          <div className="glass-card p-6">
            <h3 className="font-display text-base font-semibold text-deep mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-rose" />
              Personal Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Height", user.height],
                ["Marital Status", user.maritalStatus],
                ["Mother Tongue", user.motherTongue],
                              ].map(([label, value]) => (
                <div key={label} className="bg-blush/50 rounded-xl px-3 py-2">
                  <p className="font-body text-[10px] text-muted uppercase tracking-wider">{label}</p>
                  <p className="font-body text-sm font-medium text-deep">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Religion & Community */}
          <div className="glass-card p-6">
            <h3 className="font-display text-base font-semibold text-deep mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose" />
              Religion &amp; Community
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Religion", user.religion],
                ["Caste", user.caste],
                ["Gotra", user.gotra],
                ["Mother Tongue", user.motherTongue],
              ].map(([label, value]) => (
                <div key={label} className="bg-blush/50 rounded-xl px-3 py-2">
                  <p className="font-body text-[10px] text-muted uppercase tracking-wider">{label}</p>
                  <p className="font-body text-sm font-medium text-deep">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Education & Career */}
          <div className="glass-card p-6">
            <h3 className="font-display text-base font-semibold text-deep mb-4 flex items-center gap-2">
              <Book className="w-4 h-4 text-rose" />
              Education &amp; Career
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Education", user.education],
                ["Occupation", user.occupation],
                ["Income", user.income],
              ].map(([label, value]) => (
                <div key={label} className="bg-blush/50 rounded-xl px-3 py-2">
                  <p className="font-body text-[10px] text-muted uppercase tracking-wider">{label}</p>
                  <p className="font-body text-sm font-medium text-deep">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Family */}
          <div className="glass-card p-6">
            <h3 className="font-display text-base font-semibold text-deep mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-rose" />
              Family Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Family Type", user.familyType],
                ["Father's Occupation", user.fatherOccupation],
                ["Mother's Occupation", user.motherOccupation],
                ["Siblings", user.siblings],
              ].map(([label, value]) => (
                <div key={label} className="bg-blush/50 rounded-xl px-3 py-2">
                  <p className="font-body text-[10px] text-muted uppercase tracking-wider">{label}</p>
                  <p className="font-body text-sm font-medium text-deep">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="glass-card p-6">
          <h3 className="font-display text-base font-semibold text-deep mb-3">About</h3>
          <p className="font-body text-sm text-deep/70 leading-relaxed">{user.bio}</p>
        </div>

        {/* Photo Gallery */}
        <div className="glass-card p-6">
          <h3 className="font-display text-base font-semibold text-deep mb-4 flex items-center gap-2">
            <Camera className="w-4 h-4 text-rose" />
            Photo Gallery
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-gold/10">
                <div className="aspect-square bg-blush flex items-center justify-center text-rose/30">
                  <Camera className="w-12 h-12" />
                </div>
                <div className="p-3 flex items-center justify-between bg-white">
                  <span className="font-body text-xs text-muted">
                    {photoStatuses[i] === "approved"
                      ? "Approved"
                      : photoStatuses[i] === "rejected"
                      ? "Rejected"
                      : "Pending Review"}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePhotoAction(i, "approved")}
                      className="p-1 rounded-lg hover:bg-emerald-50 text-muted hover:text-emerald-600 transition-colors"
                      title="Approve photo"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePhotoAction(i, "rejected")}
                      className="p-1 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition-colors"
                      title="Reject photo"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Change */}
          <div className="glass-card p-6">
            <h3 className="font-display text-base font-semibold text-deep mb-4">Change Status</h3>
            <div className="space-y-3">
              <div>
                <label className="font-body text-xs text-muted uppercase tracking-wider">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as AdminUser["status"])}
                  className="mt-1 w-full px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-body text-xs text-muted uppercase tracking-wider">Reason</label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  rows={3}
                  placeholder="Provide a reason for the status change..."
                  className="mt-1 w-full px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors resize-none"
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <button onClick={handleStatusChange} className="btn-primary text-sm w-full">
                Update Status
              </button>
            </div>
          </div>

          {/* Matches & Interests */}
          <div className="glass-card p-6">
            <h3 className="font-display text-base font-semibold text-deep mb-4">Matches &amp; Interests</h3>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-blush/50 rounded-xl px-3 py-3 text-center">
                <p className="font-display text-xl font-bold text-deep">14</p>
                <p className="font-body text-[10px] text-muted uppercase tracking-wider">Interests Sent</p>
              </div>
              <div className="flex-1 bg-blush/50 rounded-xl px-3 py-3 text-center">
                <p className="font-display text-xl font-bold text-deep">9</p>
                <p className="font-body text-[10px] text-muted uppercase tracking-wider">Interests Received</p>
              </div>
            </div>
            <h4 className="font-body text-xs text-muted uppercase tracking-wider mb-2">Top Matches</h4>
            <div className="space-y-2">
              {mockMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-blush/30 hover:bg-blush/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose/10 flex items-center justify-center text-rose">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium text-deep">{match.name}</p>
                      <p className="font-body text-xs text-muted">{match.age} yrs, {match.city}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 font-body text-xs font-medium">
                    {match.compatibility}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
