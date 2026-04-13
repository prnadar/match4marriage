"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Save } from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import { useToast } from "@/components/admin/Toast";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  gender: "Male" | "Female";
  dob: string;
  city: string;
  state: string;
  religion: string;
  caste: string;
  subCaste: string;
  gotra: string;
  motherTongue: string;
  education: string;
  occupation: string;
  company: string;
  income: string;
  height: string;
  weight: string;
  complexion: string;
  familyType: string;
  fatherOccupation: string;
  motherOccupation: string;
  siblings: string;
  familyStatus: string;
  prefAgeMin: string;
  prefAgeMax: string;
  prefHeightMin: string;
  prefHeightMax: string;
  prefReligion: string;
  prefEducation: string;
  prefIncomeRange: string;
  prefCity: string;
  bio: string;
}

const initialForm: FormData = {
  fullName: "",
  email: "",
  phone: "",
  gender: "Male",
  dob: "",
  city: "",
  state: "",
  religion: "",
  caste: "",
  subCaste: "",
  gotra: "",
  motherTongue: "",
  education: "",
  occupation: "",
  company: "",
  income: "",
  height: "",
  weight: "",
  complexion: "",
  familyType: "",
  fatherOccupation: "",
  motherOccupation: "",
  siblings: "",
  familyStatus: "",
  prefAgeMin: "",
  prefAgeMax: "",
  prefHeightMin: "",
  prefHeightMax: "",
  prefReligion: "",
  prefEducation: "",
  prefIncomeRange: "",
  prefCity: "",
  bio: "",
};

const requiredFields: (keyof FormData)[] = ["fullName", "email", "phone", "gender", "dob", "city", "religion"];

const religions = ["Hindu", "Sikh", "Christian", "Jain", "Buddhist", "Parsi", "Muslim"];
const educations = ["B.Tech", "MBA", "MBBS", "CA", "B.Com", "M.Tech", "PhD", "BBA", "LLB", "B.Sc", "M.Sc", "B.Arch"];
const incomes = ["Below 3 LPA", "3-5 LPA", "5-8 LPA", "8-12 LPA", "12-20 LPA", "20-30 LPA", "30-50 LPA", "50+ LPA"];
const heights = [
  "4'6\"", "4'8\"", "4'10\"", "5'0\"", "5'2\"", "5'4\"", "5'6\"", "5'8\"", "5'10\"", "6'0\"", "6'2\"", "6'4\"",
];

export default function UploadProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initialForm);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const markTouched = (key: string) => {
    setTouched((prev) => new Set(prev).add(key));
  };

  const isFieldError = (key: keyof FormData): boolean => {
    return requiredFields.includes(key) && touched.has(key) && !form[key].trim();
  };

  const validate = (): boolean => {
    const allTouched = new Set(requiredFields.map(String));
    setTouched(allTouched);
    return requiredFields.every((k) => form[k].trim());
  };

  const handleSaveDraft = () => {
    toast("info", "Profile saved as draft");
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast("error", "Please fill in all required fields");
      return;
    }
    toast("success", "Profile submitted for approval");
    router.push("/admin/profiles");
  };

  const inputClass = (key: keyof FormData) =>
    `w-full px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors ${
      isFieldError(key) ? "border-red-400 ring-1 ring-red-200" : ""
    }`;

  const labelClass = "font-body text-xs text-muted uppercase tracking-wider mb-1 block";

  return (
    <>
      <TopBar title="Upload Profile" subtitle="Create profile on behalf of a user" />

      <div className="p-6 space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push("/admin/profiles")}
          className="flex items-center gap-2 font-body text-sm text-muted hover:text-deep transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profiles
        </button>

        <div className="glass-card p-6 space-y-8">
          {/* Basic Info */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Full Name *</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  onBlur={() => markTouched("fullName")}
                  placeholder="Enter full name"
                  className={inputClass("fullName")}
                  style={{ borderColor: isFieldError("fullName") ? undefined : "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  onBlur={() => markTouched("email")}
                  placeholder="email@example.com"
                  className={inputClass("email")}
                  style={{ borderColor: isFieldError("email") ? undefined : "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Phone *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  onBlur={() => markTouched("phone")}
                  placeholder="+91 9876543210"
                  className={inputClass("phone")}
                  style={{ borderColor: isFieldError("phone") ? undefined : "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Gender *</label>
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
                <label className={labelClass}>Date of Birth *</label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => updateField("dob", e.target.value)}
                  onBlur={() => markTouched("dob")}
                  className={inputClass("dob")}
                  style={{ borderColor: isFieldError("dob") ? undefined : "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>City *</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  onBlur={() => markTouched("city")}
                  placeholder="City"
                  className={inputClass("city")}
                  style={{ borderColor: isFieldError("city") ? undefined : "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  placeholder="State"
                  className={inputClass("state")}
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
                <label className={labelClass}>Religion *</label>
                <select
                  value={form.religion}
                  onChange={(e) => updateField("religion", e.target.value)}
                  onBlur={() => markTouched("religion")}
                  className={inputClass("religion")}
                  style={{ borderColor: isFieldError("religion") ? undefined : "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Select Religion</option>
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
                  placeholder="Caste"
                  className={inputClass("caste")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Sub-caste</label>
                <input
                  type="text"
                  value={form.subCaste}
                  onChange={(e) => updateField("subCaste", e.target.value)}
                  placeholder="Sub-caste"
                  className={inputClass("subCaste")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Gotra</label>
                <input
                  type="text"
                  value={form.gotra}
                  onChange={(e) => updateField("gotra", e.target.value)}
                  placeholder="Gotra"
                  className={inputClass("gotra")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Mother Tongue</label>
                <input
                  type="text"
                  value={form.motherTongue}
                  onChange={(e) => updateField("motherTongue", e.target.value)}
                  placeholder="Mother Tongue"
                  className={inputClass("motherTongue")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
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
                  className={inputClass("education")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Select Education</option>
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
                  placeholder="Occupation"
                  className={inputClass("occupation")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Company</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => updateField("company", e.target.value)}
                  placeholder="Company name"
                  className={inputClass("company")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Income</label>
                <select
                  value={form.income}
                  onChange={(e) => updateField("income", e.target.value)}
                  className={inputClass("income")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Select Income</option>
                  {incomes.map((inc) => (
                    <option key={inc} value={inc}>{inc}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Physical */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Physical Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Height</label>
                <select
                  value={form.height}
                  onChange={(e) => updateField("height", e.target.value)}
                  className={inputClass("height")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Select Height</option>
                  {heights.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Weight (kg)</label>
                <input
                  type="text"
                  value={form.weight}
                  onChange={(e) => updateField("weight", e.target.value)}
                  placeholder="e.g., 65"
                  className={inputClass("weight")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Complexion</label>
                <input
                  type="text"
                  value={form.complexion}
                  onChange={(e) => updateField("complexion", e.target.value)}
                  placeholder="e.g., Fair, Wheatish"
                  className={inputClass("complexion")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
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
                  className={inputClass("familyType")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Select</option>
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
                  placeholder="Father's occupation"
                  className={inputClass("fatherOccupation")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Mother&apos;s Occupation</label>
                <input
                  type="text"
                  value={form.motherOccupation}
                  onChange={(e) => updateField("motherOccupation", e.target.value)}
                  placeholder="Mother's occupation"
                  className={inputClass("motherOccupation")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Siblings</label>
                <input
                  type="text"
                  value={form.siblings}
                  onChange={(e) => updateField("siblings", e.target.value)}
                  placeholder="e.g., 1 Brother, 1 Sister"
                  className={inputClass("siblings")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Family Status</label>
                <select
                  value={form.familyStatus}
                  onChange={(e) => updateField("familyStatus", e.target.value)}
                  className={inputClass("familyStatus")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Select</option>
                  <option value="Middle Class">Middle Class</option>
                  <option value="Upper Middle Class">Upper Middle Class</option>
                  <option value="Rich">Rich</option>
                  <option value="Affluent">Affluent</option>
                </select>
              </div>
            </div>
          </section>

          {/* Partner Preferences */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Partner Preferences
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Age Range (Min)</label>
                <input
                  type="number"
                  value={form.prefAgeMin}
                  onChange={(e) => updateField("prefAgeMin", e.target.value)}
                  placeholder="21"
                  className={inputClass("prefAgeMin")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Age Range (Max)</label>
                <input
                  type="number"
                  value={form.prefAgeMax}
                  onChange={(e) => updateField("prefAgeMax", e.target.value)}
                  placeholder="30"
                  className={inputClass("prefAgeMax")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Height Range (Min)</label>
                <select
                  value={form.prefHeightMin}
                  onChange={(e) => updateField("prefHeightMin", e.target.value)}
                  className={inputClass("prefHeightMin")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Select</option>
                  {heights.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Height Range (Max)</label>
                <select
                  value={form.prefHeightMax}
                  onChange={(e) => updateField("prefHeightMax", e.target.value)}
                  className={inputClass("prefHeightMax")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Select</option>
                  {heights.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Preferred Religion</label>
                <select
                  value={form.prefReligion}
                  onChange={(e) => updateField("prefReligion", e.target.value)}
                  className={inputClass("prefReligion")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Any</option>
                  {religions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Preferred Education</label>
                <select
                  value={form.prefEducation}
                  onChange={(e) => updateField("prefEducation", e.target.value)}
                  className={inputClass("prefEducation")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Any</option>
                  {educations.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Preferred Income Range</label>
                <select
                  value={form.prefIncomeRange}
                  onChange={(e) => updateField("prefIncomeRange", e.target.value)}
                  className={inputClass("prefIncomeRange")}
                  style={{ borderColor: "rgba(201,149,74,0.2)" }}
                >
                  <option value="">Any</option>
                  {incomes.map((inc) => (
                    <option key={inc} value={inc}>{inc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Preferred City</label>
                <input
                  type="text"
                  value={form.prefCity}
                  onChange={(e) => updateField("prefCity", e.target.value)}
                  placeholder="Any city"
                  className={inputClass("prefCity")}
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
              placeholder="Write a brief bio about the user..."
              className="w-full px-3 py-2 rounded-xl border font-body text-sm text-deep bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors resize-none"
              style={{ borderColor: "rgba(201,149,74,0.2)" }}
            />
          </section>

          {/* Photos */}
          <section>
            <h3 className="font-display text-base font-semibold text-deep mb-4 pb-2 border-b border-gold/10">
              Photos
            </h3>
            <div
              onClick={() => toast("info", "Photo upload started (mock)")}
              className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer hover:bg-blush/30 transition-colors"
              style={{ borderColor: "rgba(201,149,74,0.3)" }}
            >
              <Upload className="w-10 h-10 mx-auto text-rose/40 mb-3" />
              <p className="font-body text-sm font-medium text-deep">
                Click to upload or drag &amp; drop
              </p>
              <p className="font-body text-xs text-muted mt-1">
                PNG, JPG up to 5MB. Max 8 photos.
              </p>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gold/10">
            <button
              onClick={handleSaveDraft}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-body text-sm font-medium border text-deep/60 hover:bg-blush transition-colors"
              style={{ borderColor: "rgba(201,149,74,0.2)" }}
            >
              <Save className="w-4 h-4" />
              Save as Draft
            </button>
            <button onClick={handleSubmit} className="btn-primary text-sm px-6">
              Submit for Approval
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
