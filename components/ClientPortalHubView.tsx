import Link from "next/link";
import type { ClientSiteReportData } from "@/lib/sites/load-client-site-report";

function readinessAccent(state: string): string {
  if (state === "ready") {
    return "border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100";
  }
  if (state === "nearly_ready") {
    return "border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100";
  }
  return "border-zinc-200 bg-zinc-100/90 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100";
}

const MAX_BLOCKERS = 8;
const MAX_TASKS = 8;

export function ClientPortalHubView({
  token,
  data,
  tagline,
}: {
  token: string;
  data: ClientSiteReportData;
  tagline: string;
}) {
  const blockers = data.blockers.slice(0, MAX_BLOCKERS);
  const tasks = data.openTasks.slice(0, MAX_TASKS);

  return (
    <article className="space-y-10">
      <header className="border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{tagline}</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {data.site.businessName}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="text-zinc-500">Website:</span>{" "}
          <span className="font-mono text-zinc-800 dark:text-zinc-200">{data.site.rootUrl}</span>
        </p>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
          Updated {new Date(data.generatedAtIso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Status
        </h2>
        <div className={`mt-3 rounded-xl border p-4 ${readinessAccent(data.readiness.state)}`}>
          <p className="text-lg font-semibold">{data.readiness.stateLabel}</p>
          <p className="mt-2 text-sm leading-relaxed opacity-95">{data.readiness.nextStep}</p>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          Go-live checklist: {data.launchChecklist.done} of {data.launchChecklist.total} complete (
          {data.launchChecklist.percent}%).
        </p>
        {data.audit?.summaryLine ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Latest site check: {data.audit.summaryLine}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Report
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          Open the full written summary — readiness, checklist detail, opportunities, and more.
        </p>
        <p className="mt-4">
          <Link
            href={`/report/${encodeURIComponent(token)}`}
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            View full report
          </Link>
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Action list
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Prioritized items from your program. Your team may be handling some of these already.
        </p>
        {blockers.length === 0 && tasks.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No open items right now.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {blockers.map((b, i) => (
              <li key={`b-${i}`} className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{b.title}</p>
                {b.detail ? (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{b.detail}</p>
                ) : null}
              </li>
            ))}
            {tasks.map((t, i) => (
              <li
                key={`t-${i}`}
                className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.title}</p>
                {t.detail ? (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{t.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
