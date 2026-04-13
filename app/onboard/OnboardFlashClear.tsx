"use client";

import { useEffect } from "react";
import { clearOnboardFlashCookie } from "@/app/actions/onboard-flash-cookie";

/** Clears the httpOnly flash cookie after mount (allowed only via Server Action). */
export function OnboardFlashClear({ hadCookieFlash }: { hadCookieFlash: boolean }) {
  useEffect(() => {
    if (hadCookieFlash) void clearOnboardFlashCookie();
  }, [hadCookieFlash]);
  return null;
}
