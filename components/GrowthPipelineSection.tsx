import { createFixTaskFromCheckForm, createOpportunityTaskForm } from "@/app/actions/site-fix-tasks";
import { segmentLabel, type GrowthOpportunity } from "@/lib/sites/content-pipeline";

const btnClass =
  "rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200";

export function GrowthPipelineSection({
  opportunities,
  siteId,
  canCreateTasks,
  auditTaskQueuedByCheckId,
  openOpportunityFixKeys,
  openOpportunityContentKeys,
}: {
  opportunities: GrowthOpportunity[];
  siteId: string;
  canCreateTasks: boolean;
  auditTaskQueuedByCheckId: Record<string, boolean>;
  openOpportunityFixKeys: string[];
  openOpportunityContentKeys: string[];
}) {
  if (opportunities.length === 0) {
    return (
      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Growth pipeline
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          No prioritized opportunities yet. Run a homepage audit and/or add prompt clusters (
          <span className="font-mono text-xs">service_*</span>, <span className="font-mono text-xs">faq_*</span>,{" "}
          <span className="font-mono text-xs">blog_*</span>) to populate this backlog.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Growth pipeline (prioritized)
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Merges latest homepage audit gaps and ranked prompt clusters. Score ={" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">impact + confidence − effort</span> (0–100
        per axis, deterministic rules). Tasks stay manual — use the actions below.
      </p>

      <ol className="mt-4 space-y-4">
        {opportunities.map((o, i) => (
          <li
            key={o.stableId}
            className="rounded-md border border-zinc-200 bg-zinc-50/90 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">{i + 1}.</span>
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {segmentLabel(o.segment)}
              </span>
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                {o.source === "audit" ? "Audit" : "Cluster"}
              </span>
            </div>
            <h3 className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{o.headline}</h3>
            <p className="mt-1 text-xs leading-snug text-zinc-600 dark:text-zinc-400">{o.shortDetail}</p>
            <p className="mt-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">Why: </span>
              {o.summaryReason}
            </p>
            <p className="mt-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              impact {o.impactScore} · confidence {o.confidenceScore} · effort {o.effortScore} · composite{" "}
              {o.composite}
            </p>
            <details className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
              <summary className="cursor-pointer select-none font-medium text-zinc-600 dark:text-zinc-400">
                Score detail
              </summary>
              <ul className="mt-1 list-inside list-disc space-y-0.5 pl-0.5">
                {o.reasons.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <a href="#check-results" className={`${btnClass} inline-block no-underline`}>
                Audit checks
              </a>
              <a href="#open-fix-tasks" className={`${btnClass} inline-block no-underline`}>
                Open tasks
              </a>
              {o.source === "audit" && o.checkResultId ? (
                auditTaskQueuedByCheckId[o.checkResultId] ? (
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Fix task on queue</span>
                ) : (
                  <form action={createFixTaskFromCheckForm} className="inline">
                    <input type="hidden" name="siteId" value={siteId} />
                    <input type="hidden" name="checkResultId" value={o.checkResultId} />
                    <button type="submit" className={btnClass}>
                      Add fix task
                    </button>
                  </form>
                )
              ) : null}
              {o.source === "prompt_cluster" && o.clusterKey ? (
                canCreateTasks ? (
                  <>
                    {openOpportunityFixKeys.includes(o.clusterKey) ? (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Cluster fix task on list</span>
                    ) : (
                      <form action={createOpportunityTaskForm} className="inline">
                        <input type="hidden" name="siteId" value={siteId} />
                        <input type="hidden" name="clusterKey" value={o.clusterKey} />
                        <input type="hidden" name="kind" value="fix" />
                        <button type="submit" className={btnClass}>
                          Cluster → fix task
                        </button>
                      </form>
                    )}
                    {openOpportunityContentKeys.includes(o.clusterKey) ? (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Cluster content task on list
                      </span>
                    ) : (
                      <form action={createOpportunityTaskForm} className="inline">
                        <input type="hidden" name="siteId" value={siteId} />
                        <input type="hidden" name="clusterKey" value={o.clusterKey} />
                        <input type="hidden" name="kind" value="content" />
                        <button type="submit" className={btnClass}>
                          Cluster → content task
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-zinc-500">Add a site page to create cluster tasks.</span>
                )
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
