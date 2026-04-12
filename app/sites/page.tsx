import { prisma } from "@/lib/db";
import Link from "next/link";
import { rerunSiteAuditForm } from "@/app/actions/onboard";
import {
  formatRunSummary,
  parseRunSummaryCounts,
  parseSummaryErrorMessage,
} from "@/lib/audits/format-summary";
import {
  LAUNCH_CHECKLIST_DEF,
  mergeLaunchChecklistRows,
} from "@/lib/sites/launch-checklist";
import {
  buildNextActionPanel,
  summarizeNextActionPanel,
} from "@/lib/sites/next-action-panel";
import {
  launchReadinessMetrics,
  type LaunchReadinessLevel,
} from "@/lib/sites/launch-readiness-rules";
import { readinessLevelBadgeClass } from "@/lib/sites/readiness-display";
import { recommendedActionsForReadinessLevel } from "@/lib/sites/readiness-recommended-actions";

export const dynamic = "force-dynamic";

function runStatusClass(status: string) {
  if (status === "completed") {
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
  }
  if (status === "failed") {
    return "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100";
  }
  if (status === "running") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
  }
  return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200";
}

export default async function SitesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; runId?: string; siteId?: string }>;
}) {
  const { msg, runId, siteId: highlightSiteId } = await searchParams;

  const [sites, openTaskGroups] = await Promise.all([
    prisma.site.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        pages: {
          take: 1,
          orderBy: { createdAt: "asc" },
          include: {
            auditRuns: {
              take: 1,
              orderBy: { startedAt: "desc" },
              include: {
                results: { orderBy: { checkKey: "asc" } },
              },
            },
          },
        },
      },
    }),
    prisma.siteFixTask.groupBy({
      by: ["siteId"],
      where: { status: "open" },
      _count: { id: true },
    }),
  ]);

  const siteIds = sites.map((s) => s.id);
  const launchRowsAll =
    siteIds.length > 0
      ? await prisma.siteLaunchCheckItem.findMany({
          where: { siteId: { in: siteIds } },
          select: { siteId: true, key: true, done: true },
        })
      : [];

  const openBySite = new Map(
    openTaskGroups.map((g) => [g.siteId, g._count.id]),
  );

  const launchRowsBySite = new Map<string, { key: string; done: boolean }[]>();
  for (const row of launchRowsAll) {
    const list = launchRowsBySite.get(row.siteId) ?? [];
    list.push({ key: row.key, done: row.done });
    launchRowsBySite.set(row.siteId, list);
  }

  const launchExpected = LAUNCH_CHECKLIST_DEF.length;

  const urgencyBySiteId = new Map<string, number>();
  const readinessBySiteId = new Map<
    string,
    { level: LaunchReadinessLevel; label: string }
  >();
  for (const site of sites) {
    const home = site.pages[0];
    const latest = home?.auditRuns[0];
    const openCount = openBySite.get(site.id) ?? 0;
    const counts = parseRunSummaryCounts(latest?.summary ?? null);
    const launchItems = mergeLaunchChecklistRows(
      launchRowsBySite.get(site.id) ?? [],
    );
    const launchDone = launchItems.filter((i) => i.done).length;
    const { readiness, urgencyScore } = launchReadinessMetrics({
      hasHomepage: Boolean(home),
      latestRunStatus: latest?.status ?? null,
      onboardingStage: site.onboardingStage,
      checkFailCount: counts.fail,
      checkWarnCount: counts.warn,
      summaryHasError: counts.hasError,
      launchDone,
      launchExpected,
      openFixTaskCount: openCount,
    });
    readinessBySiteId.set(site.id, readiness);
    urgencyBySiteId.set(site.id, urgencyScore);
  }

  const sortedSites = [...sites].sort((a, b) => {
    const ub = urgencyBySiteId.get(b.id) ?? 0;
    const ua = urgencyBySiteId.get(a.id) ?? 0;
    if (ub !== ua) return ub - ua;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Sites</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Rows are ordered by urgency:{" "}
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">readiness</strong>,{" "}
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">open actions</strong>,{" "}
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">checklist</strong>, then{" "}
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">audit warnings</strong>.
          </p>
        </div>
        <Link
          href="/onboard"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New site
        </Link>
      </div>

      {msg ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {msg}
        </p>
      ) : null}

      {runId && highlightSiteId ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Audit finished.{" "}
          <Link className="font-medium underline" href={`/sites/${highlightSiteId}?runId=${runId}`}>
            Open site summary
          </Link>{" "}
          or see{" "}
          <Link className="font-medium underline" href="/audits">
            all audits
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2.5 font-medium">Site</th>
              <th className="px-3 py-2.5 font-medium">Readiness</th>
              <th className="px-3 py-2.5 font-medium">Checklist</th>
              <th className="px-3 py-2.5 font-medium">Latest audit</th>
              <th className="min-w-[200px] px-3 py-2.5 font-medium">Next action</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSites.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-zinc-500">
                  No sites yet.{" "}
                  <Link href="/onboard" className="underline">
                    Onboard a site
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              sortedSites.map((site) => {
                const home = site.pages[0];
                const latest = home?.auditRuns[0];
                const openCount = openBySite.get(site.id) ?? 0;
                const counts = parseRunSummaryCounts(latest?.summary ?? null);
                const rowHighlight = highlightSiteId === site.id;

                const launchItems = mergeLaunchChecklistRows(
                  launchRowsBySite.get(site.id) ?? [],
                );
                const launchDone = launchItems.filter((i) => i.done).length;
                const launchRemainingLabels = launchItems
                  .filter((i) => !i.done)
                  .map((i) => i.label);
                const launchRemainingKeys = launchItems
                  .filter((i) => !i.done)
                  .map((i) => i.key);

                const readiness = readinessBySiteId.get(site.id)!;
                const readinessRecommended = recommendedActionsForReadinessLevel(readiness.level);

                const nextPanel = buildNextActionPanel({
                  hasHomepage: Boolean(home),
                  latestRunStatus: latest?.status ?? null,
                  onboardingStage: site.onboardingStage,
                  results: latest?.results ?? [],
                  launchRemainingLabels,
                  launchRemainingKeys,
                  checkFailCount: counts.fail,
                  checkWarnCount: counts.warn,
                  summaryHasError: counts.hasError,
                  summaryErrorMessage: parseSummaryErrorMessage(latest?.summary ?? null),
                });
                const nextActionLine = summarizeNextActionPanel(nextPanel);

                const checklistPct = launchExpected
                  ? Math.round((launchDone / launchExpected) * 100)
                  : 0;

                return (
                  <tr
                    key={site.id}
                    className={
                      rowHighlight
                        ? "border-t border-zinc-200 bg-amber-50/80 dark:border-zinc-800 dark:bg-amber-950/30"
                        : "border-t border-zinc-200 dark:border-zinc-800"
                    }
                  >
                    <td className="px-3 py-3 align-top">
                      <div className="font-medium leading-snug">{site.businessName}</div>
                      <div className="mt-0.5 font-mono text-[11px] leading-snug text-zinc-500">
                        {site.rootUrl}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span
                        title={readiness.label}
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${readinessLevelBadgeClass(readiness.level)}`}
                      >
                        {readiness.label}
                      </span>
                      {openCount > 0 ? (
                        <div className="mt-1 text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400">
                          {openCount} open {openCount === 1 ? "action" : "actions"}
                        </div>
                      ) : null}
                      <p
                        className="mt-2 max-w-[14rem] text-[11px] leading-snug text-zinc-600 dark:text-zinc-400"
                        title={readinessRecommended.detail}
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {readinessRecommended.headline}
                        </span>
                        <span className="text-zinc-500"> — </span>
                        {readinessRecommended.detail}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="tabular-nums text-zinc-900 dark:text-zinc-100">
                        {launchDone}/{launchExpected}
                      </div>
                      <div
                        className="mt-1 h-1.5 w-full max-w-[7rem] overflow-hidden rounded bg-zinc-200 dark:bg-zinc-700"
                        title={`${checklistPct}% complete`}
                      >
                        <div
                          className="h-full bg-zinc-600 dark:bg-zinc-300"
                          style={{ width: `${checklistPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {latest ? (
                        <div className="space-y-1">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${runStatusClass(latest.status)}`}
                          >
                            {latest.status}
                          </span>
                          <div className="text-xs leading-snug text-zinc-700 dark:text-zinc-300">
                            {formatRunSummary(latest.summary)}
                          </div>
                          <div className="text-[11px] text-zinc-500">{latest.startedAt.toISOString()}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">No run yet</span>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-3 align-top text-xs leading-snug text-zinc-700 dark:text-zinc-300">
                      {nextActionLine}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-col gap-1.5">
                        <Link
                          href={`/sites/${site.id}`}
                          className="inline-flex justify-center rounded border border-zinc-300 px-2 py-1 text-center text-xs dark:border-zinc-600"
                        >
                          Open site
                        </Link>
                        {home ? (
                          <form action={rerunSiteAuditForm}>
                            <input type="hidden" name="siteId" value={site.id} />
                            <input type="hidden" name="redirectTo" value="/sites" />
                            <button
                              type="submit"
                              className="w-full rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                            >
                              Run audit
                            </button>
                          </form>
                        ) : (
                          <span className="text-center text-[11px] text-zinc-400">No page</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
