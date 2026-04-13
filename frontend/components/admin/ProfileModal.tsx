"use client";

import { X, MapPin, Book, Briefcase, Heart, User } from "lucide-react";
import type { AdminUser } from "@/lib/admin-mock-data";

interface ProfileModalProps {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export default function ProfileModal({ open, user, onClose, onApprove, onReject }: ProfileModalProps) {
  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-float-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-deep/40 hover:text-deep transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="relative h-32" style={{ background: "linear-gradient(135deg, #E8426A 0%, #C9954A 100%)" }}>
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 rounded-2xl bg-blush border-4 border-white flex items-center justify-center text-rose shadow-card">
              <User className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="pt-14 px-6 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-deep">{user.name}</h3>
              <p className="font-body text-sm text-muted">{user.age} yrs, {user.gender}</p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg font-body text-xs font-medium ${
                user.status === "active"
                  ? "bg-emerald-50 text-emerald-600"
                  : user.status === "pending"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {user.status}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 font-body text-sm text-deep/70">
              <MapPin className="w-4 h-4 text-muted" />
              {user.city}, {user.state}
            </div>
            <div className="flex items-center gap-2 font-body text-sm text-deep/70">
              <Heart className="w-4 h-4 text-muted" />
              {user.religion} · {user.caste}
            </div>
            <div className="flex items-center gap-2 font-body text-sm text-deep/70">
              <Book className="w-4 h-4 text-muted" />
              {user.education}
            </div>
            <div className="flex items-center gap-2 font-body text-sm text-deep/70">
              <Briefcase className="w-4 h-4 text-muted" />
              {user.occupation} · {user.income}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["Height", user.height],
              ["Mother Tongue", user.motherTongue],
              ["Marital Status", user.maritalStatus],
              ["Manglik", user.manglik],
              ["Family Type", user.familyType],
              ["Gotra", user.gotra],
              ["Father", user.fatherOccupation],
              ["Mother", user.motherOccupation],
            ].map(([label, value]) => (
              <div key={label} className="bg-blush/50 rounded-xl px-3 py-2">
                <p className="font-body text-[10px] text-muted uppercase tracking-wider">{label}</p>
                <p className="font-body text-sm font-medium text-deep">{value}</p>
              </div>
            ))}
          </div>

          {user.bio && (
            <div className="mt-4">
              <p className="font-body text-xs text-muted uppercase tracking-wider mb-1">About</p>
              <p className="font-body text-sm text-deep/70">{user.bio}</p>
            </div>
          )}

          {(onApprove || onReject) && user.status === "pending" && (
            <div className="flex gap-3 mt-6">
              {onReject && (
                <button
                  onClick={() => onReject(user.id)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-body text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  Reject
                </button>
              )}
              {onApprove && (
                <button
                  onClick={() => onApprove(user.id)}
                  className="flex-1 btn-primary text-sm"
                >
                  Approve
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
