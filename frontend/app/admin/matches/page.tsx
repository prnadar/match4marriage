"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Trash2,
  Eye,
  Plus,
  Heart,
  MapPin,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import DataTable from "@/components/admin/DataTable";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import {
  mockMatches,
  mockUsers,
  type AdminMatch,
} from "@/lib/admin-mock-data";

export default function MatchesPage() {
  const { toast } = useToast();
  const [matches, setMatches] = useState<AdminMatch[]>(mockMatches);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [religionFilter, setReligionFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchUserA, setSearchUserA] = useState("");
  const [searchUserB, setSearchUserB] = useState("");
  const [removeModal, setRemoveModal] = useState<{
    open: boolean;
    matchId: string;
    reason: string;
  }>({ open: false, matchId: "", reason: "" });

  // Unique cities and religions from users for filter dropdowns
  const cities = useMemo(
    () => Array.from(new Set(mockUsers.map((u) => u.city))).sort(),
    []
  );
  const religions = useMemo(
    () => Array.from(new Set(mockUsers.map((u) => u.religion))).sort(),
    []
  );

  // Filtered data
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (dateFrom && m.matchedAt < dateFrom) return false;
      if (dateTo && m.matchedAt > dateTo) return false;
      if (
        cityFilter &&
        m.userA.city !== cityFilter &&
        m.userB.city !== cityFilter
      )
        return false;
      // Religion filter: check if either user's city matches a religion-based proxy
      // Since match data doesn't include religion, we check users
      if (religionFilter) {
        const userA = mockUsers.find((u) => u.id === m.userA.id);
        const userB = mockUsers.find((u) => u.id === m.userB.id);
        if (
          userA?.religion !== religionFilter &&
          userB?.religion !== religionFilter
        )
          return false;
      }
      return true;
    });
  }, [matches, dateFrom, dateTo, religionFilter, cityFilter, statusFilter]);

  // Manual match user search
  const suggestionsA = useMemo(() => {
    if (searchUserA.length < 2) return [];
    const q = searchUserA.toLowerCase();
    return mockUsers
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [searchUserA]);

  const suggestionsB = useMemo(() => {
    if (searchUserB.length < 2) return [];
    const q = searchUserB.toLowerCase();
    return mockUsers
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [searchUserB]);

  const [selectedUserA, setSelectedUserA] = useState<string | null>(null);
  const [selectedUserB, setSelectedUserB] = useState<string | null>(null);

  const handleCreateMatch = () => {
    if (!selectedUserA || !selectedUserB) {
      toast("warning", "Please select both users to create a match");
      return;
    }
    if (selectedUserA === selectedUserB) {
      toast("error", "Cannot match a user with themselves");
      return;
    }
    const userA = mockUsers.find((u) => u.id === selectedUserA);
    const userB = mockUsers.find((u) => u.id === selectedUserB);
    if (!userA || !userB) return;

    const newMatch: AdminMatch = {
      id: `MTH${String(matches.length + 1).padStart(4, "0")}`,
      userA: { id: userA.id, name: userA.name, photo: userA.photo, city: userA.city },
      userB: { id: userB.id, name: userB.name, photo: userB.photo, city: userB.city },
      matchedAt: new Date().toISOString().split("T")[0],
      status: "active",
      compatibility: 60 + Math.floor(Math.random() * 35),
    };

    setMatches((prev) => [newMatch, ...prev]);
    setSearchUserA("");
    setSearchUserB("");
    setSelectedUserA(null);
    setSelectedUserB(null);
    toast("success", `Match created between ${userA.name} and ${userB.name}`);
  };

  const handleRemoveMatch = () => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === removeModal.matchId
          ? { ...m, status: "unmatched" as const }
          : m
      )
    );
    setRemoveModal({ open: false, matchId: "", reason: "" });
    toast("success", "Match removed successfully");
  };

  const columns = [
    {
      key: "userA",
      label: "User A",
      sortable: true,
      render: (row: AdminMatch) => (
        <div>
          <p className="font-medium text-deep">{row.userA.name}</p>
          <p className="text-xs text-muted flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {row.userA.city}
          </p>
        </div>
      ),
    },
    {
      key: "userB",
      label: "User B",
      sortable: true,
      render: (row: AdminMatch) => (
        <div>
          <p className="font-medium text-deep">{row.userB.name}</p>
          <p className="text-xs text-muted flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {row.userB.city}
          </p>
        </div>
      ),
    },
    {
      key: "matchedAt",
      label: "Matched Date",
      sortable: true,
      render: (row: AdminMatch) => (
        <span>
          {new Date(row.matchedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "compatibility",
      label: "Compatibility",
      sortable: true,
      render: (row: AdminMatch) => {
        const color =
          row.compatibility > 80
            ? "text-emerald-600 bg-emerald-50"
            : row.compatibility > 60
            ? "text-amber-600 bg-amber-50"
            : "text-red-600 bg-red-50";
        return (
          <span
            className={`inline-block px-2.5 py-1 rounded-lg font-semibold text-xs ${color}`}
          >
            {row.compatibility}%
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: AdminMatch) => (
        <span
          className={`inline-block px-2.5 py-1 rounded-full font-body text-xs font-semibold ${
            row.status === "active"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {row.status === "active" ? "Active" : "Unmatched"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: AdminMatch) => (
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-lg text-muted hover:text-deep hover:bg-blush transition-colors"
            title="View Users"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === "active" && (
            <button
              onClick={() =>
                setRemoveModal({ open: true, matchId: row.id, reason: "" })
              }
              className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remove Match"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const selectInputClass =
    "px-3 py-2 rounded-xl border font-body text-xs text-deep bg-white/90 focus:outline-none focus:ring-2 focus:ring-gold/30 cursor-pointer";
  const selectStyle = { borderColor: "rgba(201,149,74,0.2)" };

  return (
    <div className="min-h-screen">
      <TopBar
        title="Matches"
        subtitle="View and manage user matches"
      />

      <div className="p-6 space-y-6">
        {/* Manual Match Section */}
        <div className="glass-card p-5">
          <h2 className="font-display text-base font-semibold text-deep mb-4 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose" />
            Manual Match
          </h2>
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            {/* User A Search */}
            <div className="flex-1 w-full relative">
              <label className="font-body text-xs font-medium text-muted mb-1 block">
                User A
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  value={searchUserA}
                  onChange={(e) => {
                    setSearchUserA(e.target.value);
                    setSelectedUserA(null);
                  }}
                  placeholder="Search user by name..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30"
                  style={selectStyle}
                />
              </div>
              {suggestionsA.length > 0 && !selectedUserA && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg border border-gold/10 overflow-hidden">
                  {suggestionsA.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUserA(u.id);
                        setSearchUserA(u.name);
                      }}
                      className="w-full px-4 py-2 text-left font-body text-sm text-deep hover:bg-blush transition-colors"
                    >
                      {u.name}{" "}
                      <span className="text-xs text-muted">({u.city})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User B Search */}
            <div className="flex-1 w-full relative">
              <label className="font-body text-xs font-medium text-muted mb-1 block">
                User B
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  value={searchUserB}
                  onChange={(e) => {
                    setSearchUserB(e.target.value);
                    setSelectedUserB(null);
                  }}
                  placeholder="Search user by name..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30"
                  style={selectStyle}
                />
              </div>
              {suggestionsB.length > 0 && !selectedUserB && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg border border-gold/10 overflow-hidden">
                  {suggestionsB.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUserB(u.id);
                        setSearchUserB(u.name);
                      }}
                      className="w-full px-4 py-2 text-left font-body text-sm text-deep hover:bg-blush transition-colors"
                    >
                      {u.name}{" "}
                      <span className="text-xs text-muted">({u.city})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleCreateMatch}
              disabled={!selectedUserA || !selectedUserB}
              className="px-5 py-2 rounded-xl font-body text-sm font-medium text-white bg-rose hover:bg-rose/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Create Match
            </button>
          </div>
        </div>

        {/* Data Table with Filters */}
        <DataTable<AdminMatch & Record<string, unknown>>
          columns={columns as Array<{ key: string; label: string; sortable?: boolean; render?: (row: AdminMatch & Record<string, unknown>) => React.ReactNode; className?: string }>}
          data={filteredMatches as Array<AdminMatch & Record<string, unknown>>}
          searchable
          searchPlaceholder="Search by user name..."
          searchKeys={["userA", "userB"]}
          rowKey={(row) => String(row.id)}
          emptyMessage="No matches found"
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={selectInputClass}
                style={selectStyle}
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={selectInputClass}
                style={selectStyle}
                placeholder="To"
              />
              <select
                value={religionFilter}
                onChange={(e) => setReligionFilter(e.target.value)}
                className={selectInputClass}
                style={selectStyle}
              >
                <option value="">All Religions</option>
                {religions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className={selectInputClass}
                style={selectStyle}
              >
                <option value="">All Cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectInputClass}
                style={selectStyle}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="unmatched">Unmatched</option>
              </select>
            </div>
          }
        />
      </div>

      {/* Remove Match Confirm Modal */}
      <ConfirmModal
        open={removeModal.open}
        title="Remove Match"
        message="Are you sure you want to remove this match? Both users will be notified that the match has been dissolved."
        confirmLabel="Remove Match"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleRemoveMatch}
        onCancel={() =>
          setRemoveModal({ open: false, matchId: "", reason: "" })
        }
      />
    </div>
  );
}
