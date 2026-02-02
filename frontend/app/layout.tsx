import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ArchitectAI — AI-Powered Architecture Diagrams",
  description:
    "Generate system and architecture diagrams from natural language. Describe your stack, flows, or infra and get a clean diagram in seconds.",
  keywords: ["architecture", "diagram", "AI", "system design", "SaaS"],
  openGraph: {
    title: "ArchitectAI — AI-Powered Architecture Diagrams",
    description:
      "Generate system and architecture diagrams from natural language.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ArchitectAI",
    description: "AI-powered architecture diagrams from a single prompt.",
  },
  robots: "index, follow",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased transition-colors duration-300`}
        style={{ 
          backgroundColor: "var(--background)", 
          color: "var(--foreground)" 
        }}
      >
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              classNames: {
                toast: "!bg-[var(--card)] !border-[var(--border)] !text-[var(--card-foreground)]",
                success: "!border-emerald-500/50",
                error: "!border-red-500/50",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
