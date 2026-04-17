"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Camera, Upload, Trash2, Crown, Star, AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";

interface PhotoItem {
  /** Cloudinary public_id — also our stable React key. */
  id: string;
  url: string;
  isPrimary: boolean;
}

interface UploadingItem {
  /** Local-only id — replaced once the backend response arrives. */
  tempId: string;
  /** Object URL of the local file for instant preview. */
  previewUrl: string;
  /** 0..1 overall progress (we only have indeterminate Cloudinary uploads, so 0|0.6|1 stages). */
  progress: number;
  error?: string;
}

const MAX_PHOTOS = 6;

export function PhotoGrid() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState<UploadingItem[]>([]);
  const [topError, setTopError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [zoneActive, setZoneActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<{ data: any }>("/api/v1/profile/me");
        const list = (data as any)?.data?.photos as any[] | undefined;
        if (Array.isArray(list)) {
          setPhotos(list
            .filter((p) => p && p.url && p.key)
            .map((p) => ({ id: p.key, url: p.url, isPrimary: !!p.is_primary }))
          );
        }
      } catch {
        // Non-fatal — empty grid stays.
      }
    })();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const remaining = MAX_PHOTOS - photos.length - uploading.length;

  const syncFromProfile = (profilePayload: any) => {
    const list = Array.isArray(profilePayload?.photos) ? profilePayload.photos : [];
    setPhotos(list
      .filter((p: any) => p && p.url && p.key)
      .map((p: any) => ({ id: p.key, url: p.url, isPrimary: !!p.is_primary }))
    );
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setTopError(null);
    const files = Array.from(fileList).slice(0, remaining);

    // Seed optimistic upload tiles immediately.
    const seeds: UploadingItem[] = files.map((f) => ({
      tempId: `up-${crypto.randomUUID()}`,
      previewUrl: URL.createObjectURL(f),
      progress: 0,
    }));
    setUploading((prev) => [...prev, ...seeds]);

    let lastProfile: any = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const seed = seeds[i];

      // Validate
      if (!file.type.startsWith("image/")) {
        markError(seed.tempId, "Only image files are allowed");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        markError(seed.tempId, "Photo must be under 5MB");
        continue;
      }

      try {
        bumpProgress(seed.tempId, 0.15);

        // 1. Signed Cloudinary params
        const sig = await api.post<{ data: any }>(
          `/api/v1/profile/photos/upload-url?content_type=${encodeURIComponent(file.type)}`
        );
        const params = (sig.data as any).data;
        bumpProgress(seed.tempId, 0.35);

        // 2. Upload to Cloudinary
        const form = new FormData();
        form.append("file", file);
        form.append("api_key", params.api_key);
        form.append("timestamp", String(params.timestamp));
        form.append("signature", params.signature);
        form.append("folder", params.folder);
        form.append("public_id", params.public_id);

        const cldRes = await fetch(params.upload_url, { method: "POST", body: form });
        if (!cldRes.ok) {
          const txt = await cldRes.text();
          let msg = `Upload failed (${cldRes.status})`;
          try { msg = JSON.parse(txt)?.error?.message || msg; } catch { /* keep msg */ }
          throw new Error(msg);
        }
        const cld = await cldRes.json() as { secure_url: string; public_id: string };
        bumpProgress(seed.tempId, 0.85);

        // 3. Persist to backend
        const saveRes = await api.post<{ data: any }>("/api/v1/profile/me/photos", {
          url: cld.secure_url, key: cld.public_id,
        });
        lastProfile = (saveRes.data as any)?.data;
        bumpProgress(seed.tempId, 1);

        // Remove the upload tile after a brief delay so the user sees 100%.
        setTimeout(() => removeUpload(seed.tempId), reduce ? 0 : 350);
      } catch (err: any) {
        const msg = (err?.message || "Upload failed").replace(/^\d{3}:\s*/, "");
        markError(seed.tempId, msg);
      }
    }

    if (lastProfile) syncFromProfile(lastProfile);
  };

  const bumpProgress = (tempId: string, p: number) => {
    setUploading((prev) => prev.map((u) => u.tempId === tempId ? { ...u, progress: p } : u));
  };
  const markError = (tempId: string, error: string) => {
    setUploading((prev) => prev.map((u) => u.tempId === tempId ? { ...u, error } : u));
    setTopError(error);
  };
  const removeUpload = (tempId: string) => {
    setUploading((prev) => {
      const v = prev.find((u) => u.tempId === tempId);
      if (v) URL.revokeObjectURL(v.previewUrl);
      return prev.filter((u) => u.tempId !== tempId);
    });
  };

  // ── Reorder via HTML5 DnD ─────────────────────────────────────────────────
  const onDragStart = (id: string, e: React.DragEvent) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    if (overId !== id) setOverId(id);
  };
  const onDrop = async (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    setOverId(null);
    const sourceId = dragId;
    setDragId(null);
    if (!sourceId || sourceId === targetId) return;

    const src = photos.findIndex((p) => p.id === sourceId);
    const tgt = photos.findIndex((p) => p.id === targetId);
    if (src < 0 || tgt < 0) return;

    const next = photos.slice();
    const [moved] = next.splice(src, 1);
    next.splice(tgt, 0, moved);
    // First photo is primary.
    const reflagged = next.map((p, i) => ({ ...p, isPrimary: i === 0 }));
    setPhotos(reflagged); // optimistic

    try {
      const res = await api.put<{ data: any }>("/api/v1/profile/me/photos/reorder", {
        keys: reflagged.map((p) => p.id),
      });
      const profile = (res.data as any)?.data;
      if (profile) syncFromProfile(profile);
    } catch (err: any) {
      setTopError(err?.message || "Could not save new order");
      // Re-fetch authoritative state on failure.
      try {
        const { data } = await api.get<{ data: any }>("/api/v1/profile/me");
        syncFromProfile((data as any)?.data);
      } catch { /* ignore */ }
    }
  };

  const onDragEnd = () => { setDragId(null); setOverId(null); };

  // ── Per-photo actions ─────────────────────────────────────────────────────
  const makePrimary = async (id: string) => {
    setPhotos((prev) => prev.map((p) => ({ ...p, isPrimary: p.id === id })));
    try {
      const res = await api.post<{ data: any }>("/api/v1/profile/me/photos/primary", { key: id });
      const profile = (res.data as any)?.data;
      if (profile) syncFromProfile(profile);
    } catch (err: any) {
      setTopError(err?.message || "Could not set primary");
    }
  };

  const removePhoto = async (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    try {
      const res = await api.delete<{ data: any }>(`/api/v1/profile/me/photos?key=${encodeURIComponent(id)}`);
      const profile = (res.data as any)?.data;
      if (profile) syncFromProfile(profile);
    } catch (err: any) {
      setTopError(err?.message || "Could not remove photo");
    }
  };

  const emptySlots = Math.max(0, MAX_PHOTOS - photos.length - uploading.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <h3 style={{
          fontFamily: "var(--font-playfair, serif)",
          fontSize: "1.1rem", fontWeight: 700, color: "#1a0a14",
          margin: "0 0 6px",
        }}>
          My Photos
        </h3>
        <p style={{
          fontSize: "0.8125rem", color: "#888",
          fontFamily: "var(--font-poppins, sans-serif)", margin: 0,
        }}>
          Upload up to {MAX_PHOTOS}. <strong style={{ color: "#dc1e3c" }}>Drag</strong> to reorder — your first photo is primary.
          Profiles with photos get <strong style={{ color: "#dc1e3c" }}>8× more responses</strong>.
        </p>
        {topError && (
          <div style={{
            marginTop: 10, padding: "8px 12px", borderRadius: 8,
            background: "rgba(220,30,60,0.06)", border: "1px solid rgba(220,30,60,0.18)",
            fontSize: 12, color: "#a0153c",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <AlertCircle style={{ width: 13, height: 13 }} />
            {topError}
          </div>
        )}
      </div>

      {/* Upload zone */}
      <div
        onClick={() => remaining > 0 && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setZoneActive(true); }}
        onDragLeave={() => setZoneActive(false)}
        onDrop={(e) => { e.preventDefault(); setZoneActive(false); handleFiles(e.dataTransfer.files); }}
        style={{
          position: "relative",
          border: `2px dashed ${zoneActive ? "#dc1e3c" : remaining === 0 ? "rgba(0,0,0,0.08)" : "rgba(220,30,60,0.25)"}`,
          borderRadius: 16,
          padding: "32px 24px",
          textAlign: "center",
          cursor: remaining === 0 ? "not-allowed" : "pointer",
          background: zoneActive ? "rgba(220,30,60,0.04)" : "#fdfbf9",
          transition: "border-color 0.18s, background 0.18s",
          opacity: remaining === 0 ? 0.55 : 1,
          overflow: "hidden",
        }}
      >
        {/* Animated ambient glow on drag-over */}
        <AnimatePresence>
          {zoneActive && (
            <motion.div
              key="zone-glow"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(circle at 50% 50%, rgba(220,30,60,0.12), transparent 70%)",
                pointerEvents: "none",
              }}
            />
          )}
        </AnimatePresence>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }}
          disabled={remaining === 0}
        />

        <motion.div
          animate={reduce ? {} : zoneActive ? { y: -3 } : { y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(220,30,60,0.08)",
            display: "grid", placeItems: "center",
            margin: "0 auto 12px",
            position: "relative", zIndex: 1,
          }}
        >
          <Upload style={{ width: 24, height: 24, color: "#dc1e3c" }} />
        </motion.div>
        <p style={{
          fontFamily: "var(--font-poppins, sans-serif)", fontWeight: 600,
          fontSize: "0.9375rem", color: "#1a0a14", margin: "0 0 4px",
          position: "relative", zIndex: 1,
        }}>
          {remaining === 0 ? "Photo limit reached" : zoneActive ? "Release to upload" : "Drop photos here or click to browse"}
        </p>
        <p style={{ fontSize: "0.8125rem", color: "#aaa", margin: 0, position: "relative", zIndex: 1 }}>
          JPG, PNG, WebP · Max 5MB each · {remaining} slot{remaining !== 1 ? "s" : ""} remaining
        </p>
      </div>

      {/* Grid */}
      {(photos.length > 0 || uploading.length > 0 || emptySlots > 0) && (
        <div>
          <p style={{
            fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.75rem", fontWeight: 700,
            color: "#777", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            Your Photos ({photos.length}/{MAX_PHOTOS})
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 14,
          }}>
            <AnimatePresence initial={false}>
              {photos.map((p) => (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  isDragging={dragId === p.id}
                  isOver={overId === p.id && dragId !== p.id}
                  onDragStart={(e) => onDragStart(p.id, e)}
                  onDragOver={(e) => onDragOver(p.id, e)}
                  onDrop={(e) => onDrop(p.id, e)}
                  onDragEnd={onDragEnd}
                  onMakePrimary={() => makePrimary(p.id)}
                  onRemove={() => removePhoto(p.id)}
                  reduce={!!reduce}
                />
              ))}

              {uploading.map((u) => (
                <UploadTile key={u.tempId} item={u} onDismiss={() => removeUpload(u.tempId)} />
              ))}

              {Array.from({ length: emptySlots }).map((_, i) => (
                <EmptySlot
                  key={`empty-${i}`}
                  onClick={() => fileInputRef.current?.click()}
                  reduce={!!reduce}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tiles ─────────────────────────────────────────────────────────────────────

function PhotoTile({
  photo, isDragging, isOver, onDragStart, onDragOver, onDrop, onDragEnd,
  onMakePrimary, onRemove, reduce,
}: {
  photo: PhotoItem;
  isDragging: boolean;
  isOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMakePrimary: () => void;
  onRemove: () => void;
  reduce: boolean;
}) {
  const [hover, setHover] = useState(false);

  // Plain <div> handles HTML5 DnD; framer-motion's <motion.div> overrides
  // onDrag* typings to use its own gesture system, which we don't want here.
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: "grab" }}
    >
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 14,
        overflow: "hidden",
        background: "#000",
        boxShadow: photo.isPrimary
          ? "0 0 0 3px #c9954a, 0 8px 22px rgba(201,149,74,0.35)"
          : isOver
            ? "0 0 0 3px #dc1e3c, 0 8px 22px rgba(220,30,60,0.30)"
            : "0 4px 16px rgba(0,0,0,0.12)",
        transition: "box-shadow 0.18s, transform 0.15s",
        transform: isOver && !isDragging ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt="Profile photo"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
        draggable={false}
      />

      {/* Primary halo crown */}
      {photo.isPrimary && (
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: "linear-gradient(135deg, #f0c987, #c9954a)",
          color: "#fff", padding: "4px 8px", borderRadius: 999,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
          display: "inline-flex", alignItems: "center", gap: 4,
          boxShadow: "0 4px 12px rgba(201,149,74,0.42)",
          textTransform: "uppercase",
        }}>
          <Crown style={{ width: 11, height: 11 }} fill="#fff" />
          Primary
        </div>
      )}

      {/* Hover action bar */}
      <AnimatePresence>
        {hover && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              padding: "10px 8px",
              background: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0))",
              display: "flex", gap: 6, justifyContent: "center",
            }}
          >
            {!photo.isPrimary && (
              <button
                onClick={(e) => { e.stopPropagation(); onMakePrimary(); }}
                style={{
                  padding: "6px 10px", borderRadius: 8, border: "none",
                  background: "rgba(255,255,255,0.95)", color: "#7a5a1d",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontFamily: "inherit",
                }}
              >
                <Star style={{ width: 11, height: 11 }} /> Set primary
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              style={{
                padding: "6px 10px", borderRadius: 8, border: "none",
                background: "rgba(220,30,60,0.92)", color: "#fff",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4,
                fontFamily: "inherit",
              }}
            >
              <Trash2 style={{ width: 11, height: 11 }} /> Remove
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </div>
  );
}

function UploadTile({ item, onDismiss }: { item: UploadingItem; onDismiss: () => void }) {
  const failed = !!item.error;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 14,
        overflow: "hidden",
        background: "#fdfbf9",
        boxShadow: failed
          ? "0 0 0 2px rgba(220,30,60,0.4), 0 4px 16px rgba(220,30,60,0.18)"
          : "0 4px 16px rgba(0,0,0,0.08)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.previewUrl}
        alt="Uploading"
        style={{
          width: "100%", height: "100%", objectFit: "cover", display: "block",
          opacity: failed ? 0.4 : 0.6, filter: failed ? "grayscale(0.6)" : "none",
        }}
      />

      {failed ? (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 8, padding: 12, textAlign: "center",
          background: "rgba(255,255,255,0.65)", backdropFilter: "blur(2px)",
        }}>
          <AlertCircle style={{ width: 22, height: 22, color: "#dc1e3c" }} />
          <p style={{ fontSize: 11, color: "#a0153c", margin: 0, fontWeight: 600 }}>
            {item.error}
          </p>
          <button
            onClick={onDismiss}
            style={{
              marginTop: 4, padding: "4px 10px", borderRadius: 6, border: "none",
              background: "#dc1e3c", color: "#fff", fontSize: 11, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Dismiss
          </button>
        </div>
      ) : (
        // Progress ring
        <div style={{
          position: "absolute", inset: 0,
          display: "grid", placeItems: "center",
          background: "rgba(255,255,255,0.32)",
        }}>
          <ProgressRing value={item.progress} />
        </div>
      )}
    </motion.div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const SIZE = 52;
  const STROKE = 5;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const offset = C - pct * C;
  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R}
          stroke="rgba(255,255,255,0.7)" strokeWidth={STROKE} fill="none"
        />
        <motion.circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          stroke="#dc1e3c" strokeWidth={STROKE} strokeLinecap="round" fill="none"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: "drop-shadow(0 0 6px rgba(220,30,60,0.4))" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center",
        fontSize: 11, fontWeight: 700, color: "#1a0a14",
      }}>
        {Math.round(pct * 100)}%
      </div>
    </div>
  );
}

function EmptySlot({ onClick, reduce }: { onClick: () => void; reduce: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduce ? undefined : { scale: 1.02, y: -1 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      style={{
        aspectRatio: "1",
        borderRadius: 14,
        border: "1.5px dashed rgba(220,30,60,0.22)",
        background: "#fdfbf9",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 6,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
      aria-label="Add photo"
    >
      <motion.div
        animate={reduce ? {} : { scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
      >
        <Camera style={{ width: 22, height: 22, color: "rgba(220,30,60,0.35)" }} />
      </motion.div>
      <span style={{ fontSize: 11, color: "#bbb", fontWeight: 500 }}>Add photo</span>
    </motion.button>
  );
}
