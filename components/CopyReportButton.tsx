"use client";

import { useState } from "react";

export function CopyReportButton({ text, label = "Copy report" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-900"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
