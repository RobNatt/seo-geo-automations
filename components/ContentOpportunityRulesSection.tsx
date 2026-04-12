import type { RuleBasedContentOpportunity } from "@/lib/sites/content-opportunity-rules";

export function ContentOpportunityRulesSection({ findings }: { findings: RuleBasedContentOpportunity[] }) {
  if (findings.length === 0) {
    return (
      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Rule-based content opportunities
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          No deterministic gaps matched (audit, checklist, services, FAQ clusters, and open tasks look aligned).
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Rule-based content opportunities
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Deterministic rules only (no AI). Each row has a stable key for tracking and tests.
      </p>
      <ul className="mt-4 space-y-4">
        {findings.map((f) => (
          <li
            key={f.key}
            className="rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                {f.category}
              </span>
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-500">{f.key}</span>
            </div>
            <h3 className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{f.title}</h3>
            <p className="mt-1 text-xs leading-snug text-zinc-600 dark:text-zinc-400">{f.detail}</p>
            <ul className="mt-2 list-inside list-disc text-[11px] text-zinc-500 dark:text-zinc-500">
              {f.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
