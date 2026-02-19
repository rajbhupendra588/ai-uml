"use client";

import Link from "next/link";
import { AppLogo } from "@/components/AppLogo";

const footerLinks = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
];

export function SiteFooter() {
  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: "var(--background)",
        borderColor: "var(--border)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-4">
            <AppLogo href="/" size="compact" className="text-[var(--foreground)]" />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              © {new Date().getFullYear()} ArchitectAI. All rights reserved.
            </p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-colors hover:opacity-90"
                style={{ color: "var(--muted-foreground)" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
