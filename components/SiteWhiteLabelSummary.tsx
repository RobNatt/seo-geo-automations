import { readinessSummaryStateBadgeClass } from "@/lib/sites/readiness-display";
import type { LaunchReadinessSummaryState } from "@/lib/sites/launch-readiness-rules";

/**
 * Owner-facing summary only — no internal IDs, keys, or operator tools.
 * Data is passed from the same server load as the full site page.
 */
export function SiteWhiteLabelSummary({
  msg,
  businessName,
  rootUrl,
  readinessState,
  readinessLabel,
  readinessNextStep,
  recommendedHeadline,
  recommendedDetail,
  launchDone,
  launchTotal,
  launchPct,
  remainingChecklistLabels,
  latestAuditLine,
  openTaskCount,
  openTaskTitles,
  attentionTitles,
}: {
  msg?: string;
  businessName: string;
  rootUrl: string;
  readinessState: LaunchReadinessSummaryState;
  readinessLabel: string;
  readinessNextStep: string;
  recommendedHeadline: string;
  recommendedDetail: string;
  launchDone: number;
  launchTotal: number;
  launchPct: number;
  remainingChecklistLabels: string[];
  latestAuditLine: string | null;
  openTaskCount: number;
  openTaskTitles: string[];
  /** Launch blocker titles only (no technical detail strings). */
  attentionTitles: string[];
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      {msg ? (
        <p className="mb-8 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
          {msg}
        </p>
      ) : null}

      <header className="border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Program status
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {businessName}
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="text-zinc-500">Website</span>{" "}
          <span className="break-all font-mono text-zinc-800 dark:text-zinc-200">{rootUrl}</span>
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Where things stand
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded-full border px-3 py-1 text-sm font-medium ${readinessSummaryStateBadgeClass(readinessState)}`}
          >
            {readinessLabel}
          </span>
        </div>
        <p className="mt-4 text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
          {readinessNextStep}
        </p>
      </section>

      <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Recommended next focus
        </h2>
        <p className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{recommendedHeadline}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{recommendedDetail}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Progress
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-zinc-800 dark:text-zinc-200">
          <li>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Launch checklist:</span>{" "}
            {launchDone} of {launchTotal} complete ({launchPct}%)
          </li>
          <li>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Latest site review:</span>{" "}
            {latestAuditLine ?? "Not run yet — your team will schedule this."}
          </li>
          <li>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Open action items:</span>{" "}
            {openTaskCount === 0 ? "None in queue" : `${openTaskCount} in progress`}
          </li>
        </ul>
        {remainingChecklistLabels.length > 0 ? (
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Checklist still open
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              {remainingChecklistLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {attentionTitles.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Items to clear before launch
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-800 dark:text-zinc-200">
            {attentionTitles.map((t, i) => (
              <li key={`${t}-${i}`} className="flex gap-2">
                <span className="text-zinc-400">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {openTaskTitles.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Current action list
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
            {openTaskTitles.map((t, i) => (
              <li key={`${t}-${i}`}>{t}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-14 text-center text-[12px] text-zinc-500 dark:text-zinc-500">
        This page shows a simplified status summary. Your team has the full operations dashboard for technical detail.
      </p>
    </main>
  );
}
