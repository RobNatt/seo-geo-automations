import Link from "next/link";

import { CopyReportButton } from "@/components/CopyReportButton";
import { formatAllContentOpportunityBriefsPlain, type ContentOpportunityBrief } from "@/lib/sites/content-opportunity-brief";

export function ContentWriterBriefsSection({
  siteId,
  briefs,
}: {
  siteId: string;
  briefs: { queueItemId: string; brief: ContentOpportunityBrief }[];
}) {
  if (briefs.length === 0) return null;

  const plain = formatAllContentOpportunityBriefsPlain(briefs.map((b) => b.brief));

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Writer briefs (content queue)
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            One block per queued opportunity: target URL, suggested title, and intent from stored rules or cluster
            prompts — no auto-generated body copy.
          </p>
        </div>
        <CopyReportButton text={plain} label="Copy all briefs" />
      </div>

      <ul className="mt-4 space-y-5">
        {briefs.map(({ queueItemId, brief }, i) => (
          <li
            key={queueItemId}
            className="rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/50"
          >
            <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-500">
              {i + 1}. {brief.opportunityKey}
            </p>
            <dl className="mt-2 space-y-2 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Target page
                </dt>
                <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                  {brief.targetPage ? (
                    <>
                      {brief.targetPage.title?.trim() ? (
                        <span className="font-medium">{brief.targetPage.title}</span>
                      ) : (
                        <span className="text-zinc-500">(no title)</span>
                      )}
                      <br />
                      <a
                        href={brief.targetPage.url}
                        className="break-all text-sky-700 underline underline-offset-2 dark:text-sky-400"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {brief.targetPage.url}
                      </a>
                    </>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-500">
                      Not set — choose or publish a URL, then link it on the queue row.
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Suggested title
                </dt>
                <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{brief.suggestedTitle}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Primary intent
                </dt>
                <dd className="mt-0.5 leading-snug text-zinc-700 dark:text-zinc-300">{brief.primaryIntent}</dd>
              </div>
            </dl>
            <p className="mt-3">
              <Link
                href={`/sites/${siteId}/content/${queueItemId}`}
                className="text-sm font-medium text-sky-700 underline underline-offset-2 dark:text-sky-400"
              >
                Open draft pipeline
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
