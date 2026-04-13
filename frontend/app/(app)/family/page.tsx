"use client";

import { useState } from "react";
import { Users, Heart, Shield, CheckCircle, Eye, EyeOff, UserPlus, MessageCircle, Star, Lock } from "lucide-react";

const familyMembers = [
  { id: "f1", name: "Rajesh Sharma",    relation: "Father",       initials: "RS", grad: "linear-gradient(135deg,#1a0a14,#4A3728)", active: true,  lastSeen: "Just now"   },
  { id: "f2", name: "Sunita Sharma",    relation: "Mother",       initials: "SS", grad: "linear-gradient(135deg,#dc1e3c,#a0153c)", active: true,  lastSeen: "2 min ago"  },
  { id: "f3", name: "Preethi Sharma",   relation: "Elder Sister", initials: "PS", grad: "linear-gradient(135deg,#5C7A52,#8DB870)", active: false, lastSeen: "1h ago"     },
];

const matches = [
  { id: "1", name: "Priya Sharma",    initials: "PS", grad: "linear-gradient(135deg,#dc1e3c,#a0153c)", age: 27, city: "Mumbai",     profession: "Software Engineer", company: "Google",    compatibility: 92, trustScore: 94, verified: true },
  { id: "2", name: "Anjali Patel",    initials: "AP", grad: "linear-gradient(135deg,#9A6B00,#C89020)", age: 26, city: "Ahmedabad",  profession: "Doctor",            company: "Apollo",    compatibility: 87, trustScore: 88, verified: true },
  { id: "3", name: "Kavya Nair",      initials: "KN", grad: "linear-gradient(135deg,#5C7A52,#8DB870)", age: 28, city: "Bangalore",  profession: "Data Scientist",    company: "Flipkart",  compatibility: 84, trustScore: 91, verified: true },
];

type Permission = "view" | "shortlist" | "message" | "all";

const PERMISSIONS: { key: Permission; label: string; desc: string }[] = [
  { key: "view",      label: "View profiles",     desc: "Can browse and view match profiles"    },
  { key: "shortlist", label: "Shortlist",         desc: "Can save and shortlist profiles"       },
  { key: "message",   label: "Send interest",     desc: "Can send interests on your behalf"     },
  { key: "all",       label: "Full access",       desc: "Complete control of your profile"      },
];

export default function FamilyPage() {
  const [invited, setInvited] = useState(false);
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("Father");
  const [selectedPerms, setSelectedPerms] = useState<Set<Permission>>(new Set<Permission>(["view"]));
  const [sharedWith, setSharedWith] = useState<Set<string>>(new Set(["1"]));
  const [showFamilyView, setShowFamilyView] = useState(false);

  const togglePerm = (p: Permission) =>
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  const toggleShare = (id: string) =>
    setSharedWith((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="px-8 py-8 max-w-4xl" style={{ background: "#fdfbf9", minHeight: "100vh" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5" style={{ color: "#9A6B00" }} />
            <h1
              className="text-3xl font-light"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1a0a14" }}
            >
              Family Mode
            </h1>
          </div>
          <p className="text-sm" style={{ color: "rgba(26,10,20,0.45)" }}>Let your family participate in the search, with your permission</p>
        </div>
        <button
          onClick={() => setShowFamilyView(!showFamilyView)}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
          style={{
            background: showFamilyView ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "white",
            color: showFamilyView ? "#fff" : "rgba(26,10,20,0.6)",
            border: showFamilyView ? "none" : "1px solid rgba(220,30,60,0.15)",
            minHeight: "auto",
          }}
        >
          {showFamilyView ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showFamilyView ? "Family view ON" : "Preview as family"}
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-6">
        {/* Left */}
        <div className="space-y-5">

          {/* Existing members */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "white", border: "1px solid rgba(220,30,60,0.08)", borderRadius: 16 }}
          >
            <h3
              className="text-base font-semibold mb-4"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1a0a14" }}
            >
              Family Members
            </h3>
            <div className="space-y-3">
              {familyMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ border: "1px solid rgba(220,30,60,0.1)", background: "#fdfbf9" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                    style={{ background: m.grad, fontFamily: "var(--font-playfair, serif)" }}
                  >
                    {m.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#1a0a14" }}>{m.name}</p>
                    <p className="text-xs" style={{ color: "rgba(26,10,20,0.45)" }}>{m.relation} · {m.active ? "Active" : m.lastSeen}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: m.active ? "#5C7A52" : "rgba(26,10,20,0.2)" }}
                    />
                    <CheckCircle className="w-4 h-4" style={{ color: "#5C7A52" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Invite form */}
            <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(220,30,60,0.1)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(26,10,20,0.55)" }}>
                Invite a Family Member
              </p>
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="family@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "#fdfbf9", border: "1px solid rgba(220,30,60,0.15)", color: "#1a0a14" }}
                />
                <div className="grid grid-cols-3 gap-1.5">
                  {["Father", "Mother", "Sibling", "Uncle", "Aunt", "Other"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRelation(r)}
                      className="py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: relation === r ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "white",
                        color: relation === r ? "#fff" : "rgba(26,10,20,0.5)",
                        border: relation === r ? "none" : "1px solid rgba(220,30,60,0.08)",
                        minHeight: "auto",
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {/* Permissions — select before sending invite */}
                <div className="pt-3" style={{ borderTop: "1px solid rgba(220,30,60,0.08)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-3.5 h-3.5" style={{ color: "#dc1e3c" }} />
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(26,10,20,0.55)" }}>
                      Set Permissions
                    </p>
                  </div>
                  <p className="text-xs mb-3" style={{ color: "rgba(26,10,20,0.4)" }}>Choose what this member can do on your behalf</p>
                  <div className="space-y-2">
                    {PERMISSIONS.map((p) => (
                      <label key={p.key} className="flex items-center gap-3 cursor-pointer">
                        <div
                          onClick={() => togglePerm(p.key)}
                          className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border transition-all cursor-pointer"
                          style={{
                            background: selectedPerms.has(p.key) ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "white",
                            border: selectedPerms.has(p.key) ? "none" : "1px solid rgba(220,30,60,0.2)",
                          }}
                        >
                          {selectedPerms.has(p.key) && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: "rgba(26,10,20,0.8)" }}>{p.label}</p>
                          <p className="text-xs" style={{ color: "rgba(26,10,20,0.4)" }}>{p.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => { if (email) { setInvited(true); setEmail(""); } }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#dc1e3c,#a0153c)", minHeight: "auto" }}
                >
                  <UserPlus className="w-4 h-4" />
                  {invited ? "Invitation sent!" : "Send Invitation"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Shared profiles */}
        <div className="space-y-5">
          <div
            className="rounded-2xl p-5"
            style={{ background: "white", border: "1px solid rgba(220,30,60,0.08)", borderRadius: 16 }}
          >
            <h3
              className="text-base font-semibold mb-1"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1a0a14" }}
            >
              Shared with Family
            </h3>
            <p className="text-xs mb-4" style={{ color: "rgba(26,10,20,0.4)" }}>Profiles your family can see</p>
            <div className="space-y-3">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl p-3"
                  style={{
                    background: sharedWith.has(m.id) ? "rgba(220,30,60,0.04)" : "#fdfbf9",
                    border: sharedWith.has(m.id) ? "1px solid rgba(220,30,60,0.18)" : "1px solid rgba(220,30,60,0.08)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                      style={{ background: m.grad, fontFamily: "var(--font-playfair, serif)" }}
                    >
                      {m.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-semibold truncate" style={{ color: "#1a0a14" }}>{m.name}</p>
                        {m.verified && <Shield className="w-3 h-3 flex-shrink-0" style={{ color: "#5C7A52" }} />}
                      </div>
                      <p className="text-xs" style={{ color: "rgba(26,10,20,0.45)" }}>{m.age} · {m.city}</p>
                    </div>
                    <button
                      onClick={() => toggleShare(m.id)}
                      className="p-1.5 rounded-lg transition-all"
                      style={{
                        background: sharedWith.has(m.id) ? "rgba(220,30,60,0.1)" : "rgba(26,10,20,0.05)",
                        minHeight: "auto", minWidth: "auto",
                      }}
                    >
                      {sharedWith.has(m.id)
                        ? <Eye className="w-3.5 h-3.5" style={{ color: "#dc1e3c" }} />
                        : <EyeOff className="w-3.5 h-3.5" style={{ color: "rgba(26,10,20,0.3)" }} />}
                    </button>
                  </div>
                  {sharedWith.has(m.id) && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(26,10,20,0.07)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${m.trustScore}%`, background: "linear-gradient(90deg,#dc1e3c,#a0153c)" }}
                        />
                      </div>
                      <span className="text-[10px] font-bold" style={{ color: "#dc1e3c" }}>Trust {m.trustScore}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Family activity feed */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "white", border: "1px solid rgba(220,30,60,0.08)", borderRadius: 16 }}
          >
            <h3
              className="text-base font-semibold mb-4"
              style={{ fontFamily: "var(--font-playfair, serif)", color: "#1a0a14" }}
            >
              Family Activity
            </h3>
            <div className="space-y-3">
              {[
                { member: "Mother", action: "Shortlisted Priya Sharma", time: "5 min ago",  icon: <Heart className="w-3.5 h-3.5" style={{ color: "#dc1e3c" }} /> },
                { member: "Father", action: "Viewed Anjali Patel",       time: "1h ago",    icon: <Eye className="w-3.5 h-3.5" style={{ color: "#9A6B00" }} /> },
                { member: "Sister", action: "Commented on Kavya Nair",   time: "3h ago",    icon: <MessageCircle className="w-3.5 h-3.5" style={{ color: "#5C7A52" }} /> },
              ].map(({ member, action, time, icon }) => (
                <div key={action} className="flex items-start gap-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(220,30,60,0.07)" }}
                  >
                    {icon}
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "rgba(26,10,20,0.7)" }}>
                      <strong style={{ color: "#1a0a14" }}>{member}</strong> {action}
                    </p>
                    <p className="text-[10px]" style={{ color: "rgba(26,10,20,0.3)" }}>{time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
