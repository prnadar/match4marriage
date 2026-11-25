"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

// Same status roles as Pill / Button (values in globals.css, admin block).
const iconTone: Record<ToastType, string> = {
  success: "adm-fg-good",
  error: "adm-fg-bad",
  warning: "adm-fg-warn",
  info: "adm-fg-info",
};

/** Errors stay longer: they usually need reading twice. */
const LIFETIME: Record<ToastType, number> = { success: 4000, info: 4000, warning: 6000, error: 7000 };
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }].slice(-MAX_VISIBLE));
    timers.current.set(id, setTimeout(() => removeToast(id), LIFETIME[type]));
  }, [removeToast]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((t) => clearTimeout(t)); map.clear(); };
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-[380px]"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = icons[t.type];
            return (
              <motion.div
                key={t.id}
                layout
                role={t.type === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-foreground shadow-[var(--adm-shadow-pop)]"
              >
                <Icon className={`mt-px h-4 w-4 shrink-0 ${iconTone[t.type]}`} aria-hidden />
                <p className="min-w-0 flex-1 break-words text-[13px] leading-snug">{t.message}</p>
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  aria-label="Dismiss notification"
                  className="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted2-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
