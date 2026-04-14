"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Profile = {
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  country?: string;
  religion?: string;
  mother_tongue?: string;
  education_level?: string;
  occupation?: string;
  bio?: string;
  photos?: { url?: string; key?: string; is_primary?: boolean }[];
  verification_status: string;
  rejection_reason?: string | null;
  submitted_at?: string | null;
};

export default function AdminVerificationsPage() {
  const [items, setItems] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"submitted" | "approved" | "rejected" | "all">("submitted");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/profile/admin/verifications?status_filter=${filter}`);
      const data = (res.data as any)?.data ?? [];
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      await api.post(`/api/v1/profile/admin/verifications/${id}/approve`, {});
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const requestInfo = async (id: string) => {
    const note = (reasonDrafts[id] || "").trim();
    if (!note) { alert("Enter what extra info you need"); return; }
    setBusyId(id);
    try {
      await api.post(`/api/v1/profile/admin/verifications/${id}/request-info`, { note });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Request-info failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    const reason = (reasonDrafts[id] || "").trim();
    if (!reason) { alert("Enter a rejection reason"); return; }
    setBusyId(id);
    try {
      await api.post(`/api/v1/profile/admin/verifications/${id}/reject`, { reason });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", border: "none", cursor: "pointer",
    background: active ? "#7B2D3A" : "#f3f3f3",
    color: active ? "#fff" : "#333",
    fontWeight: active ? 600 : 400, borderRadius: 6,
  });

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>Profile Verifications</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button style={tabStyle(filter === "submitted")} onClick={() => setFilter("submitted")}>Pending</button>
        <button style={tabStyle(filter === "approved")} onClick={() => setFilter("approved")}>Approved</button>
        <button style={tabStyle(filter === "rejected")} onClick={() => setFilter("rejected")}>Rejected</button>
        <button style={tabStyle(filter === "all")} onClick={() => setFilter("all")}>All</button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <div style={{ color: "#c00", marginBottom: 12 }}>{error}</div>}

      {!loading && items.length === 0 && <p style={{ color: "#666" }}>No profiles in this category.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((p) => {
          const open = openId === p.user_id;
          return (
            <div key={p.user_id} style={{ border: "1px solid #e0e0e0", borderRadius: 10, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontSize: 13, color: "#666" }}>
                    {[p.gender, p.religion, p.country, p.occupation].filter(Boolean).join(" · ")}
                  </div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                    Status: <strong>{p.verification_status}</strong>
                    {p.submitted_at && ` · Submitted ${new Date(p.submitted_at).toLocaleString()}`}
                  </div>
                </div>
                <button
                  onClick={() => setOpenId(open ? null : p.user_id)}
                  style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer" }}
                >
                  {open ? "Hide" : "View"}
                </button>
              </div>

              {open && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontSize: 13, marginBottom: 12 }}>
                    <div><strong>DOB:</strong> {p.date_of_birth || "—"}</div>
                    <div><strong>Mother tongue:</strong> {p.mother_tongue || "—"}</div>
                    <div><strong>Education:</strong> {p.education_level || "—"}</div>
                    <div><strong>Occupation:</strong> {p.occupation || "—"}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 13 }}>Bio:</strong>
                    <p style={{ fontSize: 13, color: "#444", marginTop: 4 }}>{p.bio || "—"}</p>
                  </div>
                  {p.photos && p.photos.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <strong style={{ fontSize: 13, display: "block", marginBottom: 6 }}>Photos:</strong>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {p.photos.map((ph, i) => (
                          ph.url ? <img key={i} src={ph.url} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" }} /> : null
                        ))}
                      </div>
                    </div>
                  )}
                  {p.verification_status === "rejected" && p.rejection_reason && (
                    <div style={{ padding: 8, background: "#ffe9ec", borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                      <strong>Previous rejection:</strong> {p.rejection_reason}
                    </div>
                  )}

                  {p.verification_status !== "approved" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <button
                        onClick={() => approve(p.user_id)}
                        disabled={busyId === p.user_id}
                        style={{ padding: "8px 14px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                      >
                        Approve
                      </button>
                      <input
                        type="text"
                        placeholder="Reason / extra info needed"
                        value={reasonDrafts[p.user_id] || ""}
                        onChange={(e) => setReasonDrafts((r) => ({ ...r, [p.user_id]: e.target.value }))}
                        style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                      />
                      <button
                        onClick={() => requestInfo(p.user_id)}
                        disabled={busyId === p.user_id}
                        style={{ padding: "8px 14px", background: "#ef6c00", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                      >
                        Request Info
                      </button>
                      <button
                        onClick={() => reject(p.user_id)}
                        disabled={busyId === p.user_id}
                        style={{ padding: "8px 14px", background: "#c62828", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
