"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Camera, X, Plus } from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import { useToast } from "@/components/admin/Toast";
import { mockUsers } from "@/lib/admin-mock-data";

const religions = ["Hindu", "Sikh", "Christian", "Jain", "Buddhist", "Parsi", "Muslim"];
const educations = ["B.Tech", "MBA", "MBBS", "CA", "B.Com", "M.Tech", "PhD", "BBA", "LLB", "B.Sc", "M.Sc", "B.Arch"];
const incomes = ["Below 3 LPA", "3-5 LPA", "5-8 LPA", "8-12 LPA", "12-20 LPA", "20-30 LPA", "30-50 LPA", "50+ LPA"];
const heights = [
  "4'6\"", "4'8\"", "4'10\"", "5'0\"", "5'2\"", "5'4\"", "5'6\"", "5'8\"", "5'10\"", "6'0\"", "6'2\"", "6'4\"",
];

export default function EditProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const user = mockUsers.find((u) => u.id === userId);

  const [form, setForm] = useState(() => {
    if (!user) return null;
    return {
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      age: String(user.age),
      city: user.city,
      state: user.state,
      religion: user.religion,
      caste: user.caste,
      gotra: user.gotra,
      motherTongue: user.motherTongue,
      education: user.education,
      occupation: user.occupation,
      income: user.income,
      height: user.height,
      maritalStatus: user.maritalStatus,
      manglik: user.manglik,
      familyType: user.familyType,
      fatherOccupation: user.fatherOccupation,
      motherOccupation: user.motherOccupation,
      siblings: user.siblings,
      bio: user.bio,
    };
  });

  const [photos, setPhotos] = useState([
    { id: 1, exists: true },
    { id: 2, exists: true },
    { id: 3, exists: true },
  ]);

  if (!user || !form) {
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

  const updateField = (key: string, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleRemovePhoto = (photoId: number) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    toast("info", "Photo removed");
  };

  const handleAddPhoto = () => {
    const nextId = photos.length > 0 ? Math.max(...photos.map((p) => p.id)) + 1 : 1;
    setPhotos((prev) => [...prev, { id: nextId, exists: true }]);
    toast("info", "Photo added (mock)");
  };

  const handleSave = () => {
    toast("success", `Profile for ${form.name} updated successfully`);
    router.push(`/admin/profiles/${userId}`);
  };

  const inputClass =
    "w-full px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors";

  const labelClass = "font-body text-xs text-muted uppercase tracking-wider mb-1 block";

  return (
    <>
      <TopBar
        title={`Edit: ${user.name}`}
        subtitle={`Profile ID: ${user.id}`}
      />

      <div className="p-6 space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push(`/admin/profiles/${userId}`)}
          className="flex items-center gap-2 font-body text-sm text-muted hover:text-deep transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </button>

        <div className="glass-card p-6 space-y-8">
          {/* Basic Info */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <div className="flex gap-4 mt-2">
                  {(["Male", "Female"] as const).map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        checked={form.gender === g}
                        onChange={() => updateField("gender", g)}
                        className="text-rose focus:ring-rose/30"
                      />
                      <span className="font-body text-sm text-deep">{g}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Age</label>
                <input
                  type="number"
                  value={form.age}
                  onChange={(e) => updateField("age", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
            </div>
          </section>

          {/* Religion & Community */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Religion &amp; Community
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Religion</label>
                <select
                  value={form.religion}
                  onChange={(e) => updateField("religion", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  {religions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Caste</label>
                <input
                  type="text"
                  value={form.caste}
                  onChange={(e) => updateField("caste", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Gotra</label>
                <input
                  type="text"
                  value={form.gotra}
                  onChange={(e) => updateField("gotra", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Mother Tongue</label>
                <input
                  type="text"
                  value={form.motherTongue}
                  onChange={(e) => updateField("motherTongue", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Marital Status</label>
                <select
                  value={form.maritalStatus}
                  onChange={(e) => updateField("maritalStatus", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="Never Married">Never Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Manglik</label>
                <select
                  value={form.manglik}
                  onChange={(e) => updateField("manglik", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Don't Know">Don&apos;t Know</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
            </div>
          </section>

          {/* Education & Career */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Education &amp; Career
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Education</label>
                <select
                  value={form.education}
                  onChange={(e) => updateField("education", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  {educations.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Occupation</label>
                <input
                  type="text"
                  value={form.occupation}
                  onChange={(e) => updateField("occupation", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Income</label>
                <select
                  value={form.income}
                  onChange={(e) => updateField("income", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  {incomes.map((inc) => (
                    <option key={inc} value={inc}>{inc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Height</label>
                <select
                  value={form.height}
                  onChange={(e) => updateField("height", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  {heights.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Family */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Family Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Family Type</label>
                <select
                  value={form.familyType}
                  onChange={(e) => updateField("familyType", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="Joint">Joint</option>
                  <option value="Nuclear">Nuclear</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Father&apos;s Occupation</label>
                <input
                  type="text"
                  value={form.fatherOccupation}
                  onChange={(e) => updateField("fatherOccupation", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Mother&apos;s Occupation</label>
                <input
                  type="text"
                  value={form.motherOccupation}
                  onChange={(e) => updateField("motherOccupation", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Siblings</label>
                <input
                  type="text"
                  value={form.siblings}
                  onChange={(e) => updateField("siblings", e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
            </div>
          </section>

          {/* Bio */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Bio
            </h3>
            <textarea
              value={form.bio}
              onChange={(e) => updateField("bio", e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors resize-none"
              style={{ borderColor: "rgba(201,149,74,0.2)" }}
            />
          </section>

          {/* Photo Management */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Photos
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative rounded-2xl overflow-hidden border border-gold/10 group">
                  <div className="aspect-square bg-blush flex items-center justify-center text-rose/30">
                    <Camera className="w-10 h-10" />
                  </div>
                  <button
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddPhoto}
                className="aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted hover:text-deep hover:bg-blush/30 transition-colors"
                style={{ borderColor: "rgba(201,149,74,0.3)" }}
              >
                <Plus className="w-6 h-6" />
                <span className="font-body text-xs">Add Photo</span>
              </button>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gold/10">
            <button
              onClick={() => router.push(`/admin/profiles/${userId}`)}
              className="px-5 py-2.5 rounded-xl font-body text-sm font-medium border text-deep/60 hover:bg-blush transition-colors"
              style={{ borderColor: "rgba(201,149,74,0.2)" }}
            >
              Cancel
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 btn-primary text-sm px-6">
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
