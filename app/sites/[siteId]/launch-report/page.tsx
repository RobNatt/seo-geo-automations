import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyReportButton } from "@/components/CopyReportButton";
import { LaunchBlockersSection } from "@/components/LaunchBlockersSection";
import { LaunchWarningsSection } from "@/components/LaunchWarningsSection";
import { prisma } from "@/lib/db";
import {
  formatRunSummary,
  parseRunSummaryCounts,
  parseSummaryErrorMessage,
} from "@/lib/audits/format-summary";
import {
  ensureLaunchChecklistForSite,
  mergeLaunchChecklistRows,
} from "@/lib/sites/launch-checklist";
import {
  buildContentGapsPlainTextSection,
  rankContentGapOpportunities,
} from "@/lib/sites/content-gap-rank";
import {
  collectLaunchBlockers,
  collectLaunchWarnings,
  summarizeAuditHardFailures,
} from "@/lib/sites/launch-blockers";
import { buildLaunchReportPlainText } from "@/lib/sites/launch-report-text";
import { listPromptClusterPlannerRows } from "@/lib/sites/prompt-clusters";
import { sortOpenFixTasksByPriority } from "@/lib/fix-tasks/open-task-priority";
import { evaluateLaunchReadinessSummary } from "@/lib/sites/launch-readiness-rules";
import {
  buildContentRefreshPlainTextSection,
  CONTENT_REFRESH_HIGH_PRIORITY_MIN_SCORE,
  partitionContentRefreshByTier,
} from "@/lib/sites/content-refresh-rank";
import { loadContentPerformanceDashboard } from "@/lib/sites/load-content-performance-dashboard";

export const dynamic = "force-dynamic";

export default async function SiteLaunchReportPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) notFound();

  await ensureLaunchChecklistForSite(site.id);
  const launchRows = await prisma.siteLaunchCheckItem.findMany({ where: { siteId: site.id } });
  const launchItems = mergeLaunchChecklistRows(launchRows);
  const launchDone = launchItems.filter((i) => i.done).length;
  const launchTotal = launchItems.length;
  const launchPct = launchTotal ? Math.round((launchDone / launchTotal) * 100) : 0;

  const homepage = await prisma.page.findFirst({
    where: { siteId: site.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      url: true,
      performanceScore: true,
      accessibilityScore: true,
      bestPracticesScore: true,
      seoScore: true,
      performanceLastAudited: true,
    },
  });

  const openFixTasks = sortOpenFixTasksByPriority(
    homepage
      ? await prisma.siteFixTask.findMany({
          where: { siteId: site.id, status: "open" },
        })
      : [],
  );

  const latestRun = homepage
    ? await prisma.auditRun.findFirst({
        where: { pageId: homepage.id },
        orderBy: { startedAt: "desc" },
        include: { results: { orderBy: { checkKey: "asc" } } },
      })
    : null;

  const latestCounts = parseRunSummaryCounts(latestRun?.summary ?? null);
  const latestAuditRows =
    latestRun?.results?.map((r) => ({ checkKey: r.checkKey, status: r.status })) ?? [];
  const hardFailCount = summarizeAuditHardFailures(latestAuditRows).length;
  const openFixTaskCount = openFixTasks.length;
  const launchBlockingOpenFixTaskCount = openFixTasks.filter((t) => t.bucket === "immediate").length;
  const readiness = evaluateLaunchReadinessSummary({
    hasHomepage: Boolean(homepage),
    latestRunStatus: latestRun?.status ?? null,
    onboardingStage: site.onboardingStage,
    checkFailCount: hardFailCount,
    checkWarnCount: latestCounts.warn,
    summaryHasError: latestCounts.hasError,
    launchDone,
    launchExpected: launchTotal,
    openFixTaskCount: launchBlockingOpenFixTaskCount,
  });

  const launchBlockers = collectLaunchBlockers({
    hasHomepage: Boolean(homepage),
    latestRunStatus: latestRun?.status ?? null,
    onboardingStage: site.onboardingStage,
    summaryHasError: latestCounts.hasError,
    summaryErrorMessage: parseSummaryErrorMessage(latestRun?.summary ?? null),
    auditResults: latestAuditRows,
    checklistUndone: launchItems.filter((i) => !i.done).map((i) => ({ key: i.key, label: i.label })),
    openFixTasks: openFixTasks.map((t) => ({
      dedupeKey: t.dedupeKey,
      title: t.title,
      blocksLaunch: t.bucket === "immediate",
    })),
  });
  const launchWarnings = collectLaunchWarnings({ auditResults: latestAuditRows });

  const promptPlannerRows = await listPromptClusterPlannerRows(site.id);
  const rankedContentGaps = rankContentGapOpportunities(promptPlannerRows, {
    primaryFocus: site.primaryFocus,
    businessName: site.businessName,
  });
  const contentGapsPlainTextSection = buildContentGapsPlainTextSection(rankedContentGaps);

  const performanceDashboard = await loadContentPerformanceDashboard(site.id);
  const contentRefreshPlainTextSection =
    performanceDashboard && performanceDashboard.refreshCandidates.length > 0 ?
      buildContentRefreshPlainTextSection(performanceDashboard.refreshCandidates)
    : "";
  const refreshPartition =
    performanceDashboard ?
      partitionContentRefreshByTier(performanceDashboard.refreshCandidates)
    : { high: [], maintenance: [] };

  const generatedAtIso = new Date().toISOString();
  const [openContentOpportunities, partnershipRows] = await Promise.all([
    prisma.contentOpportunity.count({
      where: { siteId: site.id, status: { in: ["identified", "planned", "active"] } },
    }),
    prisma.partnership.findMany({
      where: { siteId: site.id },
      select: { status: true },
    }),
  ]);
  const partnershipsInProgress = partnershipRows.filter((p) => p.status === "in_progress").length;
  const partnershipsDone = partnershipRows.filter((p) => p.status === "done").length;
  const plainText = buildLaunchReportPlainText({
    generatedAtIso,
    businessName: site.businessName,
    rootUrl: site.rootUrl,
    homepageUrl: homepage?.url ?? null,
    readinessLabel: readiness.stateLabel,
    readinessNextStep: readiness.nextStep,
    launchBlockers,
    latestAudit: latestRun
      ? {
          status: latestRun.status,
          startedAtIso: latestRun.startedAt.toISOString(),
          summaryLine: formatRunSummary(latestRun.summary),
        }
      : null,
    checklistItems: launchItems.map((i) => ({ label: i.label, done: i.done })),
    openFixes: openFixTasks.map((t) => ({
      bucket: t.bucket,
      priorityScore: t.priorityScore,
      title: t.title,
      detail: t.detail,
    })),
    contentGapsPlainTextSection,
    contentRefreshPlainTextSection: contentRefreshPlainTextSection || undefined,
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Launch report</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{site.businessName}</p>
          <p className="font-mono text-xs text-zinc-500">{site.rootUrl}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyReportButton text={plainText} />
          <Link
            href={`/sites/${siteId}`}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            Back to site
          </Link>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500">Snapshot time: {generatedAtIso}</p>

      <article className="mt-8 space-y-8 text-sm">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Program phases (0-6)</h2>
          <ul className="mt-2 space-y-1 text-zinc-700 dark:text-zinc-300">
            <li>Phase 0 – Core foundation: complete</li>
            <li>Phase 1 – Set &amp; Forget baseline: complete</li>
            <li>Phase 2 – Lighthouse + Core Web Vitals: complete</li>
            <li>Phase 3 – Maintenance automation: complete</li>
            <li>Phase 4 – Growth cadence automation: complete</li>
            <li>
              Phase 5 – Content &amp; GEO opportunities: {openContentOpportunities > 0 ? "active" : "ready to generate"}
            </li>
            <li>
              Phase 6 – Partnerships &amp; reporting:{" "}
              {partnershipsDone > 0 || partnershipsInProgress > 0 ? "active" : "not started"}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Readiness</h2>
          <p className="mt-2 font-medium text-zinc-900 dark:text-zinc-100">{readiness.stateLabel}</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{readiness.nextStep}</p>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Performance summary</h2>
          {homepage ? (
            <ul className="mt-2 space-y-1 text-zinc-700 dark:text-zinc-300">
              <li>Performance score: {homepage.performanceScore ?? "—"}</li>
              <li>Accessibility score: {homepage.accessibilityScore ?? "—"}</li>
              <li>Best-practices score: {homepage.bestPracticesScore ?? "—"}</li>
              <li>SEO score: {homepage.seoScore ?? "—"}</li>
              <li>
                Last audited:{" "}
                {homepage.performanceLastAudited ? homepage.performanceLastAudited.toISOString() : "Not audited yet"}
              </li>
            </ul>
          ) : (
            <p className="mt-2 text-zinc-500">No homepage found for Lighthouse summary.</p>
          )}
        </section>

        <LaunchBlockersSection blockers={launchBlockers} />
        <LaunchWarningsSection warnings={launchWarnings} />

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Latest audit (homepage)
          </h2>
          {latestRun ? (
            <ul className="mt-2 space-y-1 text-zinc-700 dark:text-zinc-300">
              <li>
                <span className="text-zinc-500">Status:</span> {latestRun.status}
              </li>
              <li>
                <span className="text-zinc-500">Started:</span> {latestRun.startedAt.toISOString()}
              </li>
              <li>
                <span className="text-zinc-500">Summary:</span> {formatRunSummary(latestRun.summary)}
              </li>
              {homepage ? (
                <li className="font-mono text-xs text-zinc-500">{homepage.url}</li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-2 text-zinc-500">No audit run yet.</p>
          )}
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Launch checklist ({launchDone}/{launchTotal}, {launchPct}%)
          </h2>
          <ul className="mt-2 space-y-1.5 text-zinc-700 dark:text-zinc-300">
            {launchItems.map((item) => (
              <li key={item.key} className="flex gap-2">
                <span className="shrink-0 text-zinc-400">{item.done ? "☑" : "☐"}</span>
                <span className={item.done ? "text-zinc-500 line-through" : ""}>{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Open fix tasks ({openFixTaskCount})
          </h2>
          {openFixTasks.length === 0 ? (
            <p className="mt-2 text-zinc-500">None.</p>
          ) : (
            <ol className="mt-2 list-decimal space-y-3 pl-5 text-zinc-700 dark:text-zinc-300">
              {openFixTasks.map((t) => (
                <li key={t.id}>
                  <span className="font-medium">{t.title}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    [{t.bucket}] · priority {t.priorityScore}
                  </span>
                  {t.detail ? (
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">{t.detail}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        {rankedContentGaps.length > 0 ? (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Content gaps (ranked)
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Same ordering as the site planner: impact + search value − effort (deterministic, no AI).
            </p>
            <ol className="mt-3 list-decimal space-y-4 pl-5 text-zinc-700 dark:text-zinc-300">
              {rankedContentGaps.map((r) => (
                <li key={r.clusterKey}>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.clusterTitle}</span>
                  <span className="ml-2 font-mono text-[11px] text-zinc-500">{r.clusterKey}</span>
                  <p className="mt-1 text-xs text-zinc-500">
                    Priority {r.compositePriority} · impact {r.businessImpact.score} · search{" "}
                    {r.searchValue.score} · effort {r.implementationEffort.score}
                  </p>
                  <ul className="mt-1.5 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
                    <li>Business: {r.businessImpact.reasons[0]}</li>
                    <li>Search: {r.searchValue.reasons[0]}</li>
                    <li>Effort: {r.implementationEffort.reasons[0]}</li>
                  </ul>
                  {r.row.targetPages.length > 0 ? (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Targets:{" "}
                      {r.row.targetPages.map((p) => p.url).join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {performanceDashboard && performanceDashboard.refreshCandidates.length > 0 ? (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Content refresh priority
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Deterministic rules (no AI). High priority = score ≥ {CONTENT_REFRESH_HIGH_PRIORITY_MIN_SCORE}; each row
              lists explainable score lines (code + points).
            </p>
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-500">
                  High priority ({refreshPartition.high.length})
                </h3>
                {refreshPartition.high.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">None.</p>
                ) : (
                  <ol className="mt-2 list-decimal space-y-4 pl-5 text-zinc-700 dark:text-zinc-300">
                    {refreshPartition.high.slice(0, 12).map((c) => (
                      <li key={c.pageId}>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {c.refreshScore} pts
                        </span>
                        <span className="ml-2 break-all font-mono text-[11px]">{c.url}</span>
                        <ul className="mt-1.5 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
                          {c.scoreBreakdown.map((line) => (
                            <li key={line.code}>
                              +{line.points} [{line.code}] {line.detail}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Maintenance ({refreshPartition.maintenance.length})
                </h3>
                {refreshPartition.maintenance.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">None.</p>
                ) : (
                  <ol className="mt-2 list-decimal space-y-3 pl-5 text-xs text-zinc-600 dark:text-zinc-400">
                    {refreshPartition.maintenance.slice(0, 8).map((c) => (
                      <li key={c.pageId}>
                        <span className="font-mono text-[11px]">{c.refreshScore}</span>
                        <span className="ml-2 break-all">{c.url}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </article>

      <section className="mt-10 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Plain text</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Same content as above — copy for email, tickets, or handoff.
        </p>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-zinc-800 dark:text-zinc-200">
          {plainText}
        </pre>
        <div className="mt-3">
          <CopyReportButton text={plainText} label="Copy plain text" />
        </div>
      </section>
    </main>
  );
}
