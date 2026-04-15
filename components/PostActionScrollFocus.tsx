"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type PostActionScrollFocusVariant = "site" | "tasks";

function isAllowedFocus(focus: string, variant: PostActionScrollFocusVariant): boolean {
  if (variant === "tasks") return focus === "task-queue";
  if (focus === "launch-checklist" || focus === "open-fix-tasks" || focus === "check-results") return true;
  if (focus.startsWith("open-fix-task-")) {
    const id = focus.slice("open-fix-task-".length);
    return /^[a-z0-9]+$/i.test(id) && id.length >= 20 && id.length <= 40;
  }
  return false;
}

/**
 * After a server redirect with `?focus=<element-id>`, scroll to that section and remove `focus` from the URL
 * without scrolling to the top (`scroll: false`).
 */
export function PostActionScrollFocus({ variant }: { variant: PostActionScrollFocusVariant }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledKey = useRef<string | null>(null);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus || !isAllowedFocus(focus, variant)) {
      handledKey.current = null;
      return;
    }

    const dedupe = `${pathname}|${focus}|${searchParams.toString()}`;
    if (handledKey.current === dedupe) return;
    handledKey.current = dedupe;

    requestAnimationFrame(() => {
      const el = document.getElementById(focus);
      if (el) el.scrollIntoView({ block: "start", behavior: "auto" });

      const next = new URLSearchParams(searchParams.toString());
      next.delete("focus");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [pathname, router, searchParams, variant]);

  return null;
}
