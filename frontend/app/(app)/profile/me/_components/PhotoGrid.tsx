"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Camera, Upload, Trash2, Crown, Star, AlertCircle, Lock, Globe,
} from "lucide-react";
import { api, profileApi } from "@/lib/api";
import { notifyProfilePhotoUpdate } from "@/lib/profilePhoto";

interface PhotoItem {
  /** Cloudinary public_id — also our stable React key. */
  id: string;
  url: string;
  isPrimary: boolean;
  isPremium: boolean;
}

interface UploadingItem {
  /** Local-only id — replaced once the backend response arrives. */
  tempId: string;
  /** Object URL of the local file for instant preview. */
  previewUrl: string;
  /** 0..1 overall progress (we only have indeterminate Cloudinary uploads, so 0|0.6|1 stages). */
  progress: number;
  /** Which section the file is being uploaded into. */
  isPremium: boolean;
  error?: string;
}

const MAX_PER_SECTION = 6;

export function PhotoGrid() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState<UploadingItem[]>([]);
  const [topError, setTopError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);
  const premiumInputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<{ data: any }>("/api/v1/profile/me");
        const list = (data as any)?.data?.photos as any[] | undefined;
        if (Array.isArray(list)) {
          setPhotos(mapPhotos(list));
          // Broadcast on initial load so the header/sidebar avatars
          // hydrate from the same source if they mounted before the
          // GET /profile/me round-trip resolved.
          notifyProfilePhotoUpdate(list);
        }
      } catch {
        // Non-fatal — empty grid stays.
      }
    })();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const mainPhotos = photos.filter((p) => !p.isPremium);
  const premiumPhotos = photos.filter((p) => p.isPremium);
  const mainUploading = uploading.filter((u) => !u.isPremium);
  const premiumUploading = uploading.filter((u) => u.isPremium);

  const mainRemaining = MAX_PER_SECTION - mainPhotos.length - mainUploading.length;
  const premiumRemaining = MAX_PER_SECTION - premiumPhotos.length - premiumUploading.length;

  const syncFromProfile = (profilePayload: any) => {
    const list = Array.isArray(profilePayload?.photos) ? profilePayload.photos : [];
    setPhotos(mapPhotos(list));
    // Tell every avatar surface (top header, sidebar, profile card) the
    // primary changed — keeps them in lock-step with the grid without
    // any cross-component prop plumbing.
    notifyProfilePhotoUpdate(list);
  };

  const handleFiles = async (fileList: FileList | null, isPremium: boolean) => {
    if (!fileList || fileList.length === 0) return;
    setTopError(null);
    const remaining = isPremium ? premiumRemaining : mainRemaining;
    const files = Array.from(fileList).slice(0, remaining);

    // Seed optimistic upload tiles immediately.
    const seeds: UploadingItem[] = files.map((f) => ({
      tempId: `up-${crypto.randomUUID()}`,
      previewUrl: URL.createObjectURL(f),
      progress: 0,
      isPremium,
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
        // The backend now signs `max_file_size` + `allowed_formats` alongside
        // the existing fields — the FormData MUST include every signed value
        // verbatim or Cloudinary rejects the signature. Both are guarded so
        // an older backend (dev) that doesn't send them still uploads cleanly.
        if (params.max_file_size !== undefined && params.max_file_size !== null) {
          form.append("max_file_size", String(params.max_file_size));
        }
        if (params.allowed_formats) {
          form.append("allowed_formats", String(params.allowed_formats));
        }

        const cldRes = await fetch(params.upload_url, { method: "POST", body: form });
        if (!cldRes.ok) {
          const txt = await cldRes.text();
          let msg = `Upload failed (${cldRes.status})`;
          try { msg = JSON.parse(txt)?.error?.message || msg; } catch { /* keep msg */ }
          throw new Error(msg);
        }
        const cld = await cldRes.json() as { secure_url: string; public_id: string };
        bumpProgress(seed.tempId, 0.85);

        // 3. Persist to backend (is_premium routes the photo into the right section)
        const saveRes = await api.post<{ data: any }>("/api/v1/profile/me/photos", {
          url: cld.secure_url, key: cld.public_id, is_premium: isPremium,
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

  // ── Reorder via HTML5 DnD (main section only) ──────────────────────────────
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

    // Reorder only within the main section.
    const main = photos.filter((p) => !p.isPremium);
    const premium = photos.filter((p) => p.isPremium);
    const src = main.findIndex((p) => p.id === sourceId);
    const tgt = main.findIndex((p) => p.id === targetId);
    if (src < 0 || tgt < 0) return;

    const next = main.slice();
    const [moved] = next.splice(src, 1);
    next.splice(tgt, 0, moved);
    // First main photo is primary.
    const reflagged = next.map((p, i) => ({ ...p, isPrimary: i === 0 }));
    const merged = [...reflagged, ...premium];
    setPhotos(merged); // optimistic
    notifyProfilePhotoUpdate(
      merged.map((p) => ({ url: p.url, key: p.id, is_primary: p.isPrimary, is_premium: p.isPremium }))
    );

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
    const next = photos.map((p) => ({ ...p, isPrimary: !p.isPremium && p.id === id }));
    setPhotos(next);
    // Optimistic: tell the avatar surfaces right away so the user sees their
    // header/sidebar avatar update the moment they click "Set primary".
    notifyProfilePhotoUpdate(
      next.map((p) => ({ url: p.url, key: p.id, is_primary: p.isPrimary, is_premium: p.isPremium }))
    );
    try {
      const res = await api.post<{ data: any }>("/api/v1/profile/me/photos/primary", { key: id });
      const profile = (res.data as any)?.data;
      if (profile) syncFromProfile(profile);
    } catch (err: any) {
      setTopError(err?.message || "Could not set primary");
    }
  };

  const removePhoto = async (id: string) => {
    const target = photos.find((p) => p.id === id);
    const next = photos.filter((p) => p.id !== id);
    // If we removed the primary main photo, promote the first remaining main
    // photo (mirrors the backend tie-break).
    if (target && !target.isPremium) {
      const firstMain = next.find((p) => !p.isPremium);
      if (firstMain && !next.some((p) => !p.isPremium && p.isPrimary)) {
        firstMain.isPrimary = true;
      }
    }
    setPhotos(next);
    notifyProfilePhotoUpdate(
      next.map((p) => ({ url: p.url, key: p.id, is_primary: p.isPrimary, is_premium: p.isPremium }))
    );
    try {
      const res = await api.delete<{ data: any }>(`/api/v1/profile/me/photos?key=${encodeURIComponent(id)}`);
      const profile = (res.data as any)?.data;
      if (profile) syncFromProfile(profile);
    } catch (err: any) {
      setTopError(err?.message || "Could not remove photo");
    }
  };

  // Move a photo between the Main and Premium sections.
  const setPremium = async (id: string, isPremium: boolean) => {
    setTopError(null);
    try {
      const res = await profileApi.setPhotoPremium(id, isPremium);
      const profile = (res.data as any)?.data;
      if (profile) syncFromProfile(profile);
    } catch (err: any) {
      setTopError(err?.message || "Could not update photo");
    }
  };

  const mainEmptySlots = Math.max(0, MAX_PER_SECTION - mainPhotos.length - mainUploading.length);
  const premiumEmptySlots = Math.max(0, MAX_PER_SECTION - premiumPhotos.length - premiumUploading.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div>
        <h3 style={{
          fontFamily: "var(--font-playfair, serif)",
          fontSize: "1.1rem", fontWeight: 700, color: "#ffffff",
          margin: "0 0 6px",
        }}>
          My Photos
        </h3>
        <p style={{
          fontSize: "0.8125rem", color: "rgba(255,255,255,0.6)",
          fontFamily: "var(--font-poppins, sans-serif)", margin: 0,
        }}>
          Profiles with photos get <strong style={{ color: "#ff8aa3" }}>8× more responses</strong>.
          Add up to {MAX_PER_SECTION} public and {MAX_PER_SECTION} premium photos.
        </p>
        {topError && (
          <div style={{
            marginTop: 10, padding: "8px 12px", borderRadius: 8,
            background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)",
            fontSize: 12, color: "rgba(255,255,255,0.82)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <AlertCircle style={{ width: 13, height: 13, color: "#ff8aa3" }} />
            {topError}
          </div>
        )}
      </div>

      {/* ── Main Photos ───────────────────────────────────────────────────── */}
      <PhotoSection
        title="Main Photos"
        count={mainPhotos.length}
        accent="rose"
        helper="Visible to everyone. Your first photo is your primary."
        remaining={mainRemaining}
        zoneLabel={
          mainRemaining === 0 ? "Photo limit reached" : "Drop public photos here or click to browse"
        }
        inputRef={mainInputRef}
        onFiles={(fl) => handleFiles(fl, false)}
        reduce={!!reduce}
      >
        <AnimatePresence initial={false}>
          {mainPhotos.map((p) => (
            <PhotoTile
              key={p.id}
              photo={p}
              draggable
              isDragging={dragId === p.id}
              isOver={overId === p.id && dragId !== p.id}
              onDragStart={(e) => onDragStart(p.id, e)}
              onDragOver={(e) => onDragOver(p.id, e)}
              onDrop={(e) => onDrop(p.id, e)}
              onDragEnd={onDragEnd}
              onMakePrimary={() => makePrimary(p.id)}
              onRemove={() => removePhoto(p.id)}
              onToggleSection={() => setPremium(p.id, true)}
              toggleDisabled={premiumPhotos.length >= MAX_PER_SECTION}
              reduce={!!reduce}
            />
          ))}

          {mainUploading.map((u) => (
            <UploadTile key={u.tempId} item={u} onDismiss={() => removeUpload(u.tempId)} />
          ))}

          {Array.from({ length: mainEmptySlots }).map((_, i) => (
            <EmptySlot
              key={`empty-main-${i}`}
              onClick={() => mainInputRef.current?.click()}
              reduce={!!reduce}
            />
          ))}
        </AnimatePresence>
      </PhotoSection>

      {/* ── Premium Photos ────────────────────────────────────────────────── */}
      <PhotoSection
        title="Premium Photos"
        count={premiumPhotos.length}
        accent="gold"
        helper="Only Premium, Elite & VIP members can see these. A great way to share more, privately."
        remaining={premiumRemaining}
        zoneLabel={
          premiumRemaining === 0 ? "Premium limit reached" : "Drop premium photos here or click to browse"
        }
        inputRef={premiumInputRef}
        onFiles={(fl) => handleFiles(fl, true)}
        reduce={!!reduce}
      >
        <AnimatePresence initial={false}>
          {premiumPhotos.map((p) => (
            <PhotoTile
              key={p.id}
              photo={p}
              draggable={false}
              isDragging={false}
              isOver={false}
              onMakePrimary={() => {}}
              onRemove={() => removePhoto(p.id)}
              onToggleSection={() => setPremium(p.id, false)}
              toggleDisabled={mainPhotos.length >= MAX_PER_SECTION}
              reduce={!!reduce}
            />
          ))}

          {premiumUploading.map((u) => (
            <UploadTile key={u.tempId} item={u} onDismiss={() => removeUpload(u.tempId)} />
          ))}

          {Array.from({ length: premiumEmptySlots }).map((_, i) => (
            <EmptySlot
              key={`empty-premium-${i}`}
              onClick={() => premiumInputRef.current?.click()}
              reduce={!!reduce}
              premium
            />
          ))}
        </AnimatePresence>
      </PhotoSection>
    </div>
  );
}

// Map raw backend photos → PhotoItem. Premium photos can never be primary.
function mapPhotos(list: any[]): PhotoItem[] {
  return list
    .filter((p) => p && p.url && p.key)
    .map((p) => ({
      id: p.key,
      url: p.url,
      isPremium: !!p.is_premium,
      isPrimary: !p.is_premium && !!p.is_primary,
    }));
}

// ─── Section shell (header + counter + upload zone + grid) ──────────────────────

function PhotoSection({
  title, count, accent, helper, remaining, zoneLabel, inputRef, onFiles, reduce, children,
}: {
  title: string;
  count: number;
  accent: "rose" | "gold";
  helper: string;
  remaining: number;
  zoneLabel: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onFiles: (fl: FileList | null) => void;
  reduce: boolean;
  children: React.ReactNode;
}) {
  const [zoneActive, setZoneActive] = useState(false);
  const isGold = accent === "gold";
  const primary = isGold ? "#c9954a" : "#ff8aa3";
  const tint = isGold ? "rgba(201,149,74,0.10)" : "rgba(220,30,60,0.12)";
  const border = isGold ? "rgba(201,149,74,0.30)" : "rgba(220,30,60,0.30)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <p style={{
            fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.95rem", fontWeight: 700,
            color: "#ffffff", margin: 0,
            display: "inline-flex", alignItems: "center", gap: 7,
          }}>
            {isGold && <Lock style={{ width: 13, height: 13, color: primary }} />}
            {title}
            <span style={{
              fontSize: 11, fontWeight: 700, color: primary,
              background: tint, borderRadius: 999, padding: "2px 9px",
            }}>
              {count}/{MAX_PER_SECTION}
            </span>
          </p>
          <p style={{
            fontSize: "0.75rem", color: "rgba(255,255,255,0.45)",
            fontFamily: "var(--font-poppins, sans-serif)", margin: "4px 0 0",
          }}>
            {helper}
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        role="button"
        tabIndex={remaining === 0 ? -1 : 0}
        aria-disabled={remaining === 0}
        aria-label={remaining === 0 ? "Photo slots full" : `Upload photo (${remaining} slot${remaining === 1 ? "" : "s"} remaining)`}
        onClick={() => remaining > 0 && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (remaining === 0) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setZoneActive(true); }}
        onDragLeave={() => setZoneActive(false)}
        onDrop={(e) => { e.preventDefault(); setZoneActive(false); onFiles(e.dataTransfer.files); }}
        style={{
          position: "relative",
          border: `2px dashed ${zoneActive ? primary : remaining === 0 ? "rgba(255,255,255,0.12)" : border}`,
          borderRadius: 16,
          padding: "24px 24px",
          textAlign: "center",
          cursor: remaining === 0 ? "not-allowed" : "pointer",
          background: zoneActive ? tint : "rgba(255,255,255,0.03)",
          transition: "border-color 0.18s, background 0.18s",
          opacity: remaining === 0 ? 0.55 : 1,
          overflow: "hidden",
        }}
      >
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
                background: `radial-gradient(circle at 50% 50%, ${tint}, transparent 70%)`,
                pointerEvents: "none",
              }}
            />
          )}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ""; }}
          disabled={remaining === 0}
        />

        <motion.div
          animate={reduce ? {} : zoneActive ? { y: -3 } : { y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          style={{
            width: 48, height: 48, borderRadius: "50%",
            background: tint,
            display: "grid", placeItems: "center",
            margin: "0 auto 10px",
            position: "relative", zIndex: 1,
          }}
        >
          {isGold
            ? <Lock style={{ width: 20, height: 20, color: primary }} />
            : <Upload style={{ width: 20, height: 20, color: primary }} />}
        </motion.div>
        <p style={{
          fontFamily: "var(--font-poppins, sans-serif)", fontWeight: 600,
          fontSize: "0.9rem", color: "#ffffff", margin: "0 0 4px",
          position: "relative", zIndex: 1,
        }}>
          {remaining === 0 ? zoneLabel : zoneActive ? "Release to upload" : zoneLabel}
        </p>
        <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.45)", margin: 0, position: "relative", zIndex: 1 }}>
          JPG, PNG, WebP · Max 5MB each · {remaining} slot{remaining !== 1 ? "s" : ""} remaining
        </p>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 14,
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Tiles ─────────────────────────────────────────────────────────────────────

function PhotoTile({
  photo, draggable, isDragging, isOver, onDragStart, onDragOver, onDrop, onDragEnd,
  onMakePrimary, onRemove, onToggleSection, toggleDisabled, reduce,
}: {
  photo: PhotoItem;
  draggable: boolean;
  isDragging: boolean;
  isOver: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onMakePrimary: () => void;
  onRemove: () => void;
  onToggleSection: () => void;
  toggleDisabled: boolean;
  reduce: boolean;
}) {
  const [hover, setHover] = useState(false);

  // Plain <div> handles HTML5 DnD; framer-motion's <motion.div> overrides
  // onDrag* typings to use its own gesture system, which we don't want here.
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: draggable ? "grab" : "default" }}
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
          : photo.isPremium
            ? "0 0 0 2px rgba(201,149,74,0.55), 0 6px 18px rgba(201,149,74,0.22)"
            : isOver
              ? "0 0 0 3px #dc1e3c, 0 8px 22px rgba(220,30,60,0.30)"
              : "0 2px 20px rgba(0,0,0,0.22)",
        transition: "box-shadow 0.18s, transform 0.15s",
        transform: isOver && !isDragging ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.isPremium ? "Premium photo" : "Profile photo"}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
        draggable={false}
      />

      {/* Primary halo crown (main only) */}
      {photo.isPrimary && (
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: "linear-gradient(135deg, #f0c987, #c9954a)",
          color: "#fff", padding: "4px 8px", borderRadius: 999,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
          display: "inline-flex", alignItems: "center", gap: 4,
          boxShadow: "0 4px 12px rgba(201,149,74,0.42)",
        }}>
          <Crown style={{ width: 11, height: 11 }} fill="#fff" />
          Primary
        </div>
      )}

      {/* Gold lock badge (premium only) */}
      {photo.isPremium && (
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: "linear-gradient(135deg, #f0c987, #c9954a)",
          color: "#fff", padding: "4px 8px", borderRadius: 999,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
          display: "inline-flex", alignItems: "center", gap: 4,
          boxShadow: "0 4px 12px rgba(201,149,74,0.42)",
        }}>
          <Lock style={{ width: 11, height: 11 }} />
          Premium
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
              display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap",
            }}
          >
            {!photo.isPremium && !photo.isPrimary && (
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

            {/* Move between sections */}
            <button
              onClick={(e) => { e.stopPropagation(); if (!toggleDisabled) onToggleSection(); }}
              disabled={toggleDisabled}
              title={
                toggleDisabled
                  ? photo.isPremium ? "Main photos are full (6/6)" : "Premium photos are full (6/6)"
                  : undefined
              }
              style={{
                padding: "6px 10px", borderRadius: 8, border: "none",
                background: photo.isPremium ? "rgba(255,255,255,0.95)" : "linear-gradient(135deg, #f0c987, #c9954a)",
                color: photo.isPremium ? "#7a5a1d" : "#fff",
                fontSize: 11, fontWeight: 700,
                cursor: toggleDisabled ? "not-allowed" : "pointer",
                opacity: toggleDisabled ? 0.5 : 1,
                display: "inline-flex", alignItems: "center", gap: 4,
                fontFamily: "inherit",
              }}
            >
              {photo.isPremium
                ? <><Globe style={{ width: 11, height: 11 }} /> Make public</>
                : <><Crown style={{ width: 11, height: 11 }} /> Make premium</>}
            </button>

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
        background: "rgba(255,255,255,0.04)",
        boxShadow: failed
          ? "0 0 0 2px rgba(220,30,60,0.4), 0 4px 16px rgba(220,30,60,0.18)"
          : "0 2px 20px rgba(0,0,0,0.22)",
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
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        }}>
          <AlertCircle style={{ width: 22, height: 22, color: "#ff8aa3" }} />
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.82)", margin: 0, fontWeight: 600 }}>
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
          background: "rgba(0,0,0,0.40)",
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
          stroke="rgba(255,255,255,0.12)" strokeWidth={STROKE} fill="none"
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
        fontSize: 11, fontWeight: 700, color: "#ffffff",
      }}>
        {Math.round(pct * 100)}%
      </div>
    </div>
  );
}

function EmptySlot({ onClick, reduce, premium }: { onClick: () => void; reduce: boolean; premium?: boolean }) {
  const accent = premium ? "rgba(201,149,74,0.35)" : "rgba(220,30,60,0.35)";
  const border = premium ? "rgba(201,149,74,0.30)" : "rgba(220,30,60,0.22)";
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
        border: `1.5px dashed ${border}`,
        background: "rgba(255,255,255,0.03)",
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
        {premium
          ? <Lock style={{ width: 20, height: 20, color: accent }} />
          : <Camera style={{ width: 22, height: 22, color: accent }} />}
      </motion.div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Add photo</span>
    </motion.button>
  );
}
