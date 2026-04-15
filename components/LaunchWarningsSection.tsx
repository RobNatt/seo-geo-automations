import type { LaunchWarning } from "@/lib/sites/launch-blockers";

export function LaunchWarningsSection({ warnings }: { warnings: LaunchWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
        Warnings
      </h2>
      <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/80">
        Advisory items that do not block the ready-to-go-live bar unless explicitly configured as blockers.
      </p>
      <ul className="mt-3 space-y-2.5 text-sm">
        {warnings.map((w) => (
          <li key={w.id} className="border-t border-amber-200/80 pt-2 first:border-t-0 first:pt-0 dark:border-amber-900/60">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{w.title}</span>
            {w.detail ? (
              <span className="mt-0.5 block text-xs leading-snug text-zinc-700 dark:text-zinc-300">{w.detail}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
