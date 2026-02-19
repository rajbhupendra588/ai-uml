"use client";

import Link from "next/link";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";

const APP_NAME = "ArchitectAI";

interface AppLogoProps {
  /** Show "ArchitectAI" text next to the icon. Default true. */
  showText?: boolean;
  /** Optional href; when set, logo is wrapped in a Link. */
  href?: string;
  /** Size: "default" (header) or "compact" (footer/small). */
  size?: "default" | "compact";
  className?: string;
  /** Use when logo is not a link (e.g. inside another Link). */
  asSpan?: boolean;
}

export function AppLogo({
  showText = true,
  href = "/",
  size = "default",
  className,
  asSpan = false,
}: AppLogoProps) {
  const isCompact = size === "compact";
  const iconBoxClass = isCompact
    ? "h-7 w-7 rounded-md"
    : "h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9";
  const iconClass = isCompact ? "h-3.5 w-3.5" : "h-4 w-4 sm:h-5 sm:w-5";
  const textClass = isCompact
    ? "text-sm font-semibold"
    : "text-lg font-bold tracking-tight sm:text-xl";

  const content = (
    <>
      <span
        className={cn(
          "flex items-center justify-center bg-indigo-500 text-white",
          iconBoxClass
        )}
      >
        <Box className={iconClass} strokeWidth={2.5} />
      </span>
      {showText && <span className={cn(textClass, "text-inherit")}>{APP_NAME}</span>}
    </>
  );

  const sharedClass = cn(
    "flex items-center gap-2 font-bold tracking-tight no-underline",
    !asSpan && "transition-opacity hover:opacity-90",
    className
  );

  if (asSpan) {
    return <span className={sharedClass}>{content}</span>;
  }

  return (
    <Link href={href} className={sharedClass} aria-label={`${APP_NAME} Home`}>
      {content}
    </Link>
  );
}
