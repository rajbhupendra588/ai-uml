"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { User, LogOut, ChevronDown, LayoutDashboard, Settings } from "lucide-react";
import { fetchUser, clearToken, type User as AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onLogout?: () => void;
  className?: string;
}

export function UserMenu({
  onLoginClick,
  onSignupClick,
  onLogout,
  className,
}: UserMenuProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const loadUser = () => {
    fetchUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    const handler = () => loadUser();
    window.addEventListener("auth-change", handler);
    return () => window.removeEventListener("auth-change", handler);
  }, []);

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setOpen(false);
    onLogout?.();
  };

  if (loading) {
    return (
      <div className={cn("h-9 w-9 rounded-lg bg-[var(--secondary)] animate-pulse", className)} />
    );
  }

  if (!user) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <button
          type="button"
          onClick={onLoginClick}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition"
        >
          Log in
        </button>
        <button
          type="button"
          onClick={onSignupClick}
          className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition"
        >
          Sign up
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--secondary)] transition"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary)]">
          <User className="h-4 w-4" />
        </div>
        <span className="hidden sm:inline max-w-[120px] truncate">
          {user.username || user.email}
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 shadow-xl"
            role="menu"
          >
            <div className="px-3 py-2 border-b border-[var(--border)]">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">
                {user.email}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {user.diagrams_this_month} diagrams this month • {user.plan}
              </p>
            </div>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--secondary)]"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard?tab=settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--secondary)]"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <div className="border-t border-[var(--border)] mt-1 pt-1">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
