import Link from "next/link";

import { enqueueContentQueueItemForm } from "@/app/actions/content-queue";
import type { ContentPlannerColumns, ContentPlannerRow } from "@/lib/sites/content-planner";

const btn =
  "rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40";

function PlannerColumn({
  title,
  hint,
  rows,
  siteId,
  queuedKeys,
  queueItemIdByKey,
}: {
  title: string;
  hint: string;
  rows: ContentPlannerRow[];
  siteId: string;
  queuedKeys: Set<string>;
  queueItemIdByKey: Map<string, string>;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">Nothing queued here yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => {
            const onQueue = queuedKeys.has(row.opportunityKey);
            const queueItemId = queueItemIdByKey.get(row.opportunityKey);
            return (
              <li
                key={row.opportunityKey}
                className="border-t border-zinc-200 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-700"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.headline}</p>
                <p className="mt-1 text-xs leading-snug text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Why: </span>
                  {row.summaryReason}
                </p>
                <p className="mt-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{row.opportunityKey}</p>
                {onQueue && queueItemId ? (
                  <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                    On content queue ·{" "}
                    <Link
                      href={`/sites/${siteId}/content/${queueItemId}`}
                      className="font-medium text-sky-700 underline underline-offset-2 dark:text-sky-400"
                    >
                      Draft pipeline
                    </Link>
                  </p>
                ) : onQueue ? (
                  <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">On content queue</p>
                ) : null}
                {!onQueue ? (
                  <form action={enqueueContentQueueItemForm} className="mt-2">
                    <input type="hidden" name="siteId" value={siteId} />
                    <input type="hidden" name="opportunityKey" value={row.opportunityKey} />
                    <input type="hidden" name="category" value={row.queueCategory} />
                    <input type="hidden" name="title" value={row.headline} />
                    <input type="hidden" name="detail" value={row.detail ?? ""} />
                    <input type="hidden" name="priority" value={String(row.priority)} />
                    {row.targetPageId ? <input type="hidden" name="pageId" value={row.targetPageId} /> : null}
                    <button type="submit" className={btn}>
                      Add to content queue
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ContentPlannerSection({
  siteId,
  columns,
  queuedOpportunityKeys,
  queuedPipelineItems,
}: {
  siteId: string;
  columns: ContentPlannerColumns;
  queuedOpportunityKeys: string[];
  /** Open queue rows (queued / in progress) for pipeline links. */
  queuedPipelineItems?: { opportunityKey: string; queueItemId: string }[];
}) {
  const queued = new Set(queuedOpportunityKeys);
  const queueItemIdByKey = new Map(
    (queuedPipelineItems ?? []).map((r) => [r.opportunityKey, r.queueItemId] as const),
  );
  const total = columns.service.length + columns.faq.length + columns.supporting.length;

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Content planner
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Top-ranked prompt clusters first, then rule-based gaps. Use cluster keys{" "}
        <span className="font-mono text-xs">service_*</span>, <span className="font-mono text-xs">faq_*</span>,{" "}
        <span className="font-mono text-xs">blog_*</span> to land in the right column. Add rows to the manual
        content queue (deduped by opportunity key).
      </p>
      {total === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">
          No planner rows yet — add prompt clusters or fix audit/checklist gaps to see recommendations.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PlannerColumn
            title="Service pages"
            hint="Offering and commercial URLs; ranked by gap score."
            rows={columns.service}
            siteId={siteId}
            queuedKeys={queued}
            queueItemIdByKey={queueItemIdByKey}
          />
          <PlannerColumn
            title="FAQs"
            hint="Question-style clusters and FAQ rule hits."
            rows={columns.faq}
            siteId={siteId}
            queuedKeys={queued}
            queueItemIdByKey={queueItemIdByKey}
          />
          <PlannerColumn
            title="Supporting content"
            hint="Blog/editorial clusters, other intents, GEO & snippet rules."
            rows={columns.supporting}
            siteId={siteId}
            queuedKeys={queued}
            queueItemIdByKey={queueItemIdByKey}
          />
        </div>
      )}
    </section>
  );
}
