import Link from "next/link";
import { notFound } from "next/navigation";
import { savePageRefreshChecklistForm } from "@/app/actions/page-refresh-workflow";
import { isContentRefreshQueueUnresolvedStatus } from "@/lib/sites/content-refresh-queue";
import { loadPageRefreshWorkflow } from "@/lib/sites/load-page-refresh-workflow";
import {
  PAGE_REFRESH_CHECKLIST_GROUPS,
  PAGE_REFRESH_CHECKLIST_ITEMS,
  checklistCompletionCount,
} from "@/lib/sites/page-refresh-checklist";

export const dynamic = "force-dynamic";

const box =
  "mt-1 h-4 w-4 shrink-0 rounded border border-zinc-400 text-zinc-900 accent-zinc-800 dark:border-zinc-500 dark:accent-zinc-200";

export default async function PageRefreshWorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { siteId, pageId } = await params;
  const { msg } = await searchParams;

  const data = await loadPageRefreshWorkflow(siteId, pageId);
  if (!data) notFound();

  const { done, total } = checklistCompletionCount(data.checklist);
  const queueActive =
    data.queueItem && isContentRefreshQueueUnresolvedStatus(data.queueItem.status);

  const groups = ["content", "metadata", "dates", "links"] as const;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Manual refresh workflow
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Refresh page</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{data.site.businessName}</p>
        </div>
        <Link
          href={`/sites/${siteId}`}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
        >
          Back to site
        </Link>
      </div>

      {msg ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {msg}
        </p>
      ) : null}

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Page (catalog)
        </h2>
        <dl className="mt-3 space-y-2 text-sm text-zinc-800 dark:text-zinc-200">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">URL</dt>
            <dd>
              <a href={data.page.url} className="break-all font-mono text-sky-700 underline dark:text-sky-400" target="_blank" rel="noreferrer">
                {data.page.url}
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Title</dt>
              <dd>{data.page.title?.trim() ? data.page.title : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Status</dt>
              <dd className="font-mono text-xs">{data.page.status}</dd>
            </div>
            {data.page.serviceName ? (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Service</dt>
                <dd>{data.page.serviceName}</dd>
              </div>
            ) : null}
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Catalog updated</dt>
            <dd className="text-xs text-zinc-600 dark:text-zinc-400">{data.page.updatedAt.toISOString()}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Performance signal (imported snapshots)
        </h2>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">
          Latest periods for this URL only. Import CSV on the site page if empty.
        </p>
        {data.performanceRows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No snapshot rows for this page yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
                  <th className="py-2 pr-2">Period</th>
                  <th className="py-2 pr-2">Imp</th>
                  <th className="py-2 pr-2">Clk</th>
                  <th className="py-2 pr-2">CTR</th>
                  <th className="py-2 pr-2">Eng</th>
                  <th className="py-2 pr-2">Conv</th>
                  <th className="py-2">Src</th>
                </tr>
              </thead>
              <tbody>
                {data.performanceRows.map((r) => (
                  <tr key={`${r.periodStart}-${r.periodEnd}`} className="border-b border-zinc-100 dark:border-zinc-800/80">
                    <td className="py-2 pr-2 whitespace-nowrap font-mono text-[11px] text-zinc-600">
                      {r.periodStart} → {r.periodEnd}
                    </td>
                    <td className="py-2 pr-2 font-mono">{r.impressions ?? "—"}</td>
                    <td className="py-2 pr-2 font-mono">{r.clicks ?? "—"}</td>
                    <td className="py-2 pr-2 font-mono">
                      {r.ctr != null ? `${(r.ctr * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td className="py-2 pr-2 font-mono">{r.engagedSessions ?? "—"}</td>
                    <td className="py-2 pr-2 font-mono">{r.conversions ?? "—"}</td>
                    <td className="py-2 font-mono text-[10px] text-zinc-500">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Why refresh
        </h2>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">
          Rule-based signals only — nothing here is auto-written for you.
        </p>
        {queueActive && data.queueItem ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/90 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
              Refresh queue ({data.queueItem.status})
            </p>
            <p className="mt-1 text-sm text-amber-950 dark:text-amber-100">{data.queueItem.reason}</p>
            <p className="mt-1 text-[11px] text-amber-800/90 dark:text-amber-300/90">
              Priority {data.queueItem.priority} · resolve or update status from the queue when done.
            </p>
          </div>
        ) : null}
        {data.refreshCandidate ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Refresh ruleset · score {data.refreshCandidate.refreshScore} · tier{" "}
              <span className="font-mono">{data.refreshCandidate.tier}</span>
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {data.refreshCandidate.scoreBreakdown.map((line) => (
                <li key={line.code}>
                  <span className="font-mono text-[11px] text-zinc-500">+{line.points}</span> {line.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No refresh ranking row for this page (often means no performance import yet).
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Manual checklist
        </h2>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">
          Tick items as you complete them in the CMS. This does not generate or change copy — it only tracks your
          progress ({done}/{total}).
        </p>
        <form action={savePageRefreshChecklistForm} className="mt-4 space-y-6">
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="pageId" value={pageId} />
          {groups.map((g) => {
            const items = PAGE_REFRESH_CHECKLIST_ITEMS.filter((i) => i.group === g);
            return (
              <div key={g}>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {PAGE_REFRESH_CHECKLIST_GROUPS[g]}
                </h3>
                <ul className="mt-2 space-y-2">
                  {items.map((item) => (
                    <li key={item.key}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          name={`c_${item.key}`}
                          defaultChecked={Boolean(data.checklist[item.key])}
                          className={box}
                        />
                        <span>{item.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <button
            type="submit"
            className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            Save checklist
          </button>
        </form>
      </section>
    </main>
  );
}
