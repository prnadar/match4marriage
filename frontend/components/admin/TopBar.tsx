"use client";

import { Bell, Search, User } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <div
      className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between gap-4 border-b"
      style={{
        background: "rgba(26,10,18,0.97)",
        borderColor: "rgba(201,149,74,0.15)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div>
        <h1 className="font-display text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="font-body text-xs text-white/50 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <button className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-xl bg-rose/20 flex items-center justify-center text-rose">
          <User className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
