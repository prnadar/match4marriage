"use client";

import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const btnClass =
    variant === "danger"
      ? "bg-red-500 hover:bg-red-600 text-white"
      : variant === "warning"
      ? "bg-amber-500 hover:bg-amber-600 text-white"
      : "btn-primary";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-float-in">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-deep/30 hover:text-deep transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              variant === "danger" ? "bg-red-100" : variant === "warning" ? "bg-amber-100" : "bg-rose-100"
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 ${
                variant === "danger" ? "text-red-500" : variant === "warning" ? "text-amber-500" : "text-rose"
              }`}
            />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold text-deep">{title}</h3>
            <p className="font-body text-sm text-muted mt-1">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-body text-sm font-medium text-deep/60 hover:bg-gray-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl font-body text-sm font-medium transition-colors ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
