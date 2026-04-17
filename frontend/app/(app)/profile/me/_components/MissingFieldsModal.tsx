"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ChevronRight, X } from "lucide-react";

// Maps backend field keys → friendly labels and the tab they live on. Kept in
// sync with backend `_FIELD_META` in routers/profile.py.
const FIELD_META: Record<string, { label: string; tab: string }> = {
  first_name:      { label: "First name",          tab: "general" },
  last_name:       { label: "Last name",           tab: "general" },
  date_of_birth:   { label: "Date of birth",       tab: "general" },
  gender:          { label: "Gender",              tab: "general" },
  marital_status:  { label: "Marital status",      tab: "general" },
  city:            { label: "City",                tab: "contact" },
  country:         { label: "Country",             tab: "contact" },
  religion:        { label: "Religion",            tab: "general" },
  caste:           { label: "Caste",               tab: "general" },
  mother_tongue:   { label: "Mother tongue",       tab: "general" },
  height_cm:       { label: "Height",              tab: "general" },
  education_level: { label: "Education",           tab: "education" },
  occupation:      { label: "Occupation",          tab: "education" },
  bio:             { label: "About yourself",      tab: "general" },
  photos:          { label: "Profile photos",      tab: "photos" },
  partner_prefs:   { label: "Partner preferences", tab: "partner" },
  family_details:  { label: "Family details",      tab: "family" },
};

interface Props {
  open: boolean;
  /** Raw missing keys from the backend (e.g. ["bio", "photos"]). */
  missing: string[];
  onClose: () => void;
  onJumpToTab: (tabId: string) => void;
}

export function MissingFieldsModal({ open, missing, onClose, onJumpToTab }: Props) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="missing-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(26,10,20,0.55)",
            backdropFilter: "blur(6px)",
            display: "grid", placeItems: "center",
            padding: 16,
          }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="missing-fields-title"
        >
          <motion.div
            key="missing-card"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%", maxWidth: 440,
              padding: "26px 26px 22px",
              borderRadius: 20,
              background: "#fff",
              border: "1px solid rgba(220,30,60,0.12)",
              boxShadow: "0 24px 60px rgba(220,30,60,0.18)",
            }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: "absolute", top: 12, right: 12,
                background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 8,
                width: 30, height: 30, display: "grid", placeItems: "center",
                cursor: "pointer", color: "#888",
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>

            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(200,144,32,0.14)",
                display: "grid", placeItems: "center",
              }}>
                <AlertTriangle style={{ width: 18, height: 18, color: "#9A6B00" }} />
              </div>
              <div>
                <h3 id="missing-fields-title" style={{
                  fontFamily: "var(--font-playfair, serif)",
                  fontSize: 18, fontWeight: 700, color: "#1a0a14",
                  margin: 0, lineHeight: 1.2,
                }}>
                  Almost there
                </h3>
                <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
                  {missing.length === 1
                    ? "Add one more thing before submitting:"
                    : `Add ${missing.length} more things before submitting:`}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {missing.map((key, i) => {
                const meta = FIELD_META[key] || { label: key.replace(/_/g, " "), tab: "general" };
                return (
                  <motion.button
                    key={key}
                    initial={reduce ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.04, duration: 0.25 }}
                    onClick={() => {
                      onJumpToTab(meta.tab);
                      onClose();
                    }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(220,30,60,0.08)",
                      background: "rgba(255,250,246,0.7)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "background 0.15s, border-color 0.15s, transform 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "rgba(220,30,60,0.05)";
                      el.style.borderColor = "rgba(220,30,60,0.18)";
                      el.style.transform = "translateX(2px)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "rgba(255,250,246,0.7)";
                      el.style.borderColor = "rgba(220,30,60,0.08)";
                      el.style.transform = "translateX(0)";
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: "#1a0a14",
                      }}>
                        {meta.label}
                      </div>
                      <div style={{
                        fontSize: 11, color: "#888", textTransform: "capitalize",
                      }}>
                        in {meta.tab.replace(/_/g, " ")} tab
                      </div>
                    </div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 12, color: "#a0153c", fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      Take me there <ChevronRight style={{ width: 14, height: 14 }} />
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
