import type { LaunchBlocker } from "@/lib/sites/launch-blockers";

export function LaunchBlockersSection({ blockers }: { blockers: LaunchBlocker[] }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/30">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-red-900 dark:text-red-200">
        Launch blockers
      </h2>
      <p className="mt-1 text-xs text-red-800/90 dark:text-red-200/80">
        Only items that block the “ready to go live” bar (audit + checklist + open tasks).
      </p>
      {blockers.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">None.</p>
      ) : (
        <ul className="mt-3 space-y-2.5 text-sm">
          {blockers.map((b) => (
            <li key={b.id} className="border-t border-red-200/80 pt-2 first:border-t-0 first:pt-0 dark:border-red-900/60">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{b.title}</span>
              {b.detail ? (
                <span className="mt-0.5 block text-xs leading-snug text-zinc-700 dark:text-zinc-300">
                  {b.detail}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
