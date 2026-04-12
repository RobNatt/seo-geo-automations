"use client";

import { useEffect } from "react";

/**
 * Opens the matching `<details id="open-fix-task-…">` when the URL hash targets it.
 */
export function AutoOpenFixTaskFromHash() {
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.slice(1);
      if (!id.startsWith("open-fix-task-")) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return null;
}
