"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { isWhiteLabelSiteSummaryMode } from "@/lib/sites/whitelabel-site-summary";

function isSiteSummaryPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/sites\/[^/]+$/.test(pathname);
}

/** Hide internal nav on client-facing report routes and site white-label summary mode. */
export function ConditionalAppNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname === "/report" || pathname?.startsWith("/report/")) {
    return null;
  }

  if (pathname === "/portal" || pathname?.startsWith("/portal/")) {
    return null;
  }

  if (isSiteSummaryPath(pathname)) {
    const wl = searchParams.get("wl") ?? undefined;
    const full = searchParams.get("full") ?? undefined;
    const clientView = searchParams.get("clientView") ?? undefined;
    if (isWhiteLabelSiteSummaryMode({ wl, full, clientView })) {
      return null;
    }
  }

  return <AppNav />;
}
