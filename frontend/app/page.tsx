"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/components/AuthProvider";
import {
  Sparkles,
  Layout,
  Code2,
  Share2,
  ArrowRight,
  Zap,
  Shield,
  Palette,
} from "lucide-react";

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <main className="landing-page flex min-h-screen flex-col" style={{ color: "var(--foreground)", backgroundColor: "var(--background)" }}>
      <SiteHeader />

      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-4 py-20 sm:py-28 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-1/4 right-0 w-[400px] h-[300px] rounded-full opacity-10 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 mb-6 text-xs font-semibold tracking-wide"
            style={{
              borderColor: "rgba(99,102,241,0.3)",
              backgroundColor: "rgba(99,102,241,0.08)",
              color: "#a5b4fc",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> AI-powered architecture diagrams
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            <span style={{ color: "var(--foreground)" }}>Describe your system. </span>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #c084fc 100%)",
              }}
            >
              Get the diagram.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg" style={{ color: "var(--muted-foreground)" }}>
            From natural language to clean system and architecture diagrams in seconds. No drawing—just describe your stack, flows, or infra.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={user ? "/editor" : "/signup"}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold shadow-lg transition-all hover:opacity-95 hover:shadow-xl"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {user ? "Open Editor" : "Get started free"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-colors"
              style={{
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              View pricing
            </Link>
          </div>
          <p className="mt-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
            No credit card required · Free tier available · Cancel paid plans anytime
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="relative border-t px-4 py-16 sm:py-24" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl" style={{ color: "var(--foreground)" }}>
            Built for developers and architects
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base" style={{ color: "var(--muted-foreground)" }}>
            One tool for prompts, Mermaid code, and mind maps.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Sparkles,
                title: "Natural language",
                description: "Describe your architecture in plain English. AI generates diagrams instantly.",
              },
              {
                icon: Code2,
                title: "Mermaid & code",
                description: "Edit Mermaid directly or convert code to diagrams. Full control when you need it.",
              },
              {
                icon: Layout,
                title: "Multiple diagram types",
                description: "Flowcharts, sequence diagrams, mind maps, and more from a single prompt.",
              },
              {
                icon: Share2,
                title: "Share & export",
                description: "Share links or export images. Pro: high-res exports and unlimited diagrams.",
              },
            ].map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border p-6 transition-colors"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--card)",
                }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818cf8" }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold" style={{ color: "var(--foreground)" }}>
                  {title}
                </h3>
                <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secondary strip */}
      <section className="border-t px-4 py-12" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 text-sm" style={{ color: "var(--muted-foreground)" }}>
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400/80" /> Free tier included
          </span>
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400/80" /> Secure & private
          </span>
          <span className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-indigo-400/80" /> Dark & light themes
          </span>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t px-4 py-16 sm:py-20" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: "var(--foreground)" }}>
            Ready to diagram?
          </h2>
          <p className="mt-3 text-base" style={{ color: "var(--muted-foreground)" }}>
            Start for free. Upgrade to Pro when you need more.
          </p>
          <div className="mt-8">
            <Link
              href={user ? "/editor" : "/signup"}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {user ? "Open Editor" : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
