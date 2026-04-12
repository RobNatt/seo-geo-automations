import { FixPriorityExplainer } from "@/components/FixPriorityExplainer";
import { FixRecommendations } from "@/components/FixRecommendations";
import { prisma } from "@/lib/db";
import { buildFixRecommendations, groupFixesByBucket } from "@/lib/audits/fix-plan";
import { formatRunSummary } from "@/lib/audits/format-summary";

export const dynamic = "force-dynamic";

export default async function AuditsDashboardPage() {
  const runs = await prisma.auditRun.findMany({
    take: 40,
    orderBy: { startedAt: "desc" },
    include: {
      page: true,
      results: { orderBy: { checkKey: "asc" } },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-xl font-semibold">Audit dashboard</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Recent runs and per-check results (technical smoke checks).
      </p>

      <div className="mt-6">
        <FixPriorityExplainer />
      </div>

      <section className="mt-8 space-y-10">
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">No audit runs yet. Add pages and run tasks from Trigger tasks.</p>
        ) : (
          runs.map((run) => {
            const fixGrouped = groupFixesByBucket(
              buildFixRecommendations(
                run.results.map((r) => ({
                  checkKey: r.checkKey,
                  status: r.status,
                  message: r.message,
                })),
                {},
              ),
            );
            return (
            <article
              key={run.id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <div>
                  <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {run.page.url}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {run.startedAt.toISOString()}
                    {run.finishedAt ? ` → ${run.finishedAt.toISOString()}` : ""}
                  </div>
                </div>
                <div className="text-sm">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium dark:bg-zinc-800">
                    {run.status}
                  </span>
                  <span className="ml-2 text-zinc-600 dark:text-zinc-400">{formatRunSummary(run.summary)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-950">
                    <tr>
                      <th className="px-4 py-2 font-medium">Check</th>
                      <th className="px-4 py-2 font-medium">Result</th>
                      <th className="px-4 py-2 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.results.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-zinc-500">
                          No check rows (run may have failed early).
                        </td>
                      </tr>
                    ) : (
                      run.results.map((r) => (
                        <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="px-4 py-2 font-mono text-xs">{r.checkKey}</td>
                          <td className="px-4 py-2">
                            <span
                              className={
                                r.status === "pass"
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : r.status === "fail"
                                    ? "text-red-700 dark:text-red-400"
                                    : r.status === "warn"
                                      ? "text-amber-700 dark:text-amber-400"
                                      : "text-zinc-600 dark:text-zinc-400"
                              }
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                            {r.message}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Recommended fixes</h3>
                <div className="mt-3">
                  <FixRecommendations grouped={fixGrouped} showPriorityExplainer={false} />
                </div>
              </div>
            </article>
            );
          })
        )}
      </section>
    </main>
  );
}
