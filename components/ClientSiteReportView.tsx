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

export function ClientSiteReportView({ data }: { data: ClientSiteReportData }) {
  return (
    <article className="space-y-10">
      <header className="border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {data.site.businessName}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="text-zinc-500">Website:</span>{" "}
          <span className="font-mono text-zinc-800 dark:text-zinc-200">{data.site.rootUrl}</span>
        </p>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
          Report generated {new Date(data.generatedAtIso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Launch readiness
        </h2>
        <div className={`mt-3 rounded-xl border p-4 ${readinessAccent(data.readiness.state)}`}>
          <p className="text-lg font-semibold">{data.readiness.stateLabel}</p>
          <p className="mt-2 text-sm leading-relaxed opacity-95">{data.readiness.nextStep}</p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Go-live checklist
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {data.launchChecklist.done} of {data.launchChecklist.total} items complete ({data.launchChecklist.percent}%).
        </p>
        {data.launchChecklist.remainingLabels.length > 0 ? (
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            {data.launchChecklist.remainingLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">All checklist items are done.</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Latest site check
        </h2>
        {data.audit ? (
          <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <p>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">Status:</span> {data.audit.status}
            </p>
            {data.audit.startedAtIso ? (
              <p className="text-xs text-zinc-500">
                Run started {new Date(data.audit.startedAtIso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            ) : null}
            <p>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">Results:</span>{" "}
              {data.audit.failCount} to fix, {data.audit.warnCount} to review
              {data.audit.summaryLine?.trim() ? ` · ${data.audit.summaryLine}` : ""}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No homepage check has been run yet. Your team will run this before launch.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          What we&apos;re tracking
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Items that can affect launch timing or quality. Your team works these in priority order.
        </p>
        {data.blockers.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">Nothing blocking in this summary.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {data.blockers.map((b, i) => (
              <li
                key={`${b.title}-${i}`}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{b.title}</p>
                {b.detail ? (
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{b.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Open tasks
        </h2>
        {data.openTasks.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No open tasks in this view.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {data.openTasks.map((t, i) => (
              <li
                key={`${t.title}-${i}`}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{t.title}</p>
                {t.detail ? (
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Content opportunities
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          High-level ideas to strengthen visibility and helpfulness — prioritized for impact. Execution is planned with you separately.
        </p>
        {data.opportunities.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No opportunities listed yet.</p>
        ) : (
          <ol className="mt-4 list-decimal space-y-5 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
            {data.opportunities.map((o, i) => (
              <li key={`${o.title}-${i}`} className="pl-1">
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {o.category}
                </span>
                <p className="mt-1.5 font-medium text-zinc-900 dark:text-zinc-100">{o.title}</p>
                <p className="mt-1 leading-relaxed text-zinc-600 dark:text-zinc-400">{o.why}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
