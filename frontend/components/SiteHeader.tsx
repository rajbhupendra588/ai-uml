"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Menu, X, User, LogOut, ChevronDown, CreditCard } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { getPlanBadgeLabel } from "@/lib/dashboard";

const navLinks = [
  { label: "Pricing", href: "/pricing" },
  { label: "Editor", href: "/editor" },
];

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full border-b transition-colors"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        boxShadow: "0 1px 0 0 var(--border)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <AppLogo href="/" className="text-[var(--foreground)]" />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium transition-colors hover:opacity-90"
              style={{ color: "var(--foreground)" }}
            >
              {link.label}
            </Link>
          ))}
          {!loading && (
            user ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: "var(--foreground)", borderColor: "var(--border)" }}
                  aria-label="User profile menu"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="max-w-[140px] truncate">{user.username || user.email}</span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: user.plan === "free" || !user.plan ? "var(--secondary)" : "rgba(99, 102, 241, 0.2)",
                        color: user.plan === "free" || !user.plan ? "var(--muted-foreground)" : "var(--primary)",
                      }}
                    >
                      {getPlanBadgeLabel(user.plan)}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                </button>
                {profileOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-52 rounded-lg border py-1 shadow-lg"
                    style={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div className="border-b px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                      <p className="truncate">{user.email}</p>
                      <p className="mt-1 text-xs font-medium" style={{ color: "var(--foreground)" }}>
                        {getPlanBadgeLabel(user.plan)} plan
                      </p>
                    </div>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5"
                      style={{ color: "var(--foreground)" }}
                      onClick={() => setProfileOpen(false)}
                    >
                      <User className="h-4 w-4" /> Dashboard
                    </Link>
                    <Link
                      href="/billing"
                      className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5"
                      style={{ color: "var(--foreground)" }}
                      onClick={() => setProfileOpen(false)}
                    >
                      <CreditCard className="h-4 w-4" /> Billing
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); logout(); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5"
                      style={{ color: "var(--foreground)" }}
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium transition-colors hover:opacity-90"
                  style={{ color: "var(--foreground)" }}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  Sign up
                </Link>
              </>
            )
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          className="md:hidden rounded-lg p-2"
          style={{ color: "var(--foreground)" }}
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div
          className="border-t md:hidden"
          style={{ backgroundColor: "var(--secondary)", borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium"
                style={{ color: "var(--foreground)" }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {!loading && (
              user ? (
                <>
                  <div className="my-1 border-t pt-2" style={{ borderColor: "var(--border)" }}>
                    <p className="px-3 py-1 text-sm" style={{ color: "var(--foreground)" }}>{user.username || user.email}</p>
                    <p className="px-3 py-1 text-xs" style={{ color: "var(--muted-foreground)" }}>{user.email}</p>
                    <p className="px-3 py-0.5">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: user.plan === "free" || !user.plan ? "var(--secondary)" : "rgba(99, 102, 241, 0.2)",
                          color: user.plan === "free" || !user.plan ? "var(--muted-foreground)" : "var(--primary)",
                        }}
                      >
                        {getPlanBadgeLabel(user.plan)} plan
                      </span>
                    </p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                    onClick={() => setMobileOpen(false)}
                  >
                    <User className="h-4 w-4" /> Dashboard
                  </Link>
                  <Link
                    href="/billing"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                    onClick={() => setMobileOpen(false)}
                  >
                    <CreditCard className="h-4 w-4" /> Billing
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); logout(); }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-lg px-3 py-2 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                    onClick={() => setMobileOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-lg px-4 py-2 text-sm font-medium text-center"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign up
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      )}
    </header>
  );
}
