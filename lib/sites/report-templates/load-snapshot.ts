import { prisma } from "@/lib/db";
import { parseRunSummaryCounts, parseSummaryErrorMessage } from "@/lib/audits/format-summary";
import { rankContentGapOpportunities } from "@/lib/sites/content-gap-rank";
import {
  buildSiteGrowthOpportunities,
  limitGrowthOpportunities,
} from "@/lib/sites/content-pipeline";
import { collectLaunchBlockers, summarizeAuditHardFailures } from "@/lib/sites/launch-blockers";
import {
  ensureLaunchChecklistForSite,
  LAUNCH_CHECKLIST_DEF,
  mergeLaunchChecklistRows,
} from "@/lib/sites/launch-checklist";
import { evaluateLaunchReadinessSummary } from "@/lib/sites/launch-readiness-rules";
import { loadContentPerformanceDashboard } from "@/lib/sites/load-content-performance-dashboard";
import type { ContentPerformanceDashboard } from "@/lib/sites/load-content-performance-dashboard";
import { listPromptClusterPlannerRows } from "@/lib/sites/prompt-clusters";
import { sortOpenFixTasksByPriority } from "@/lib/fix-tasks/open-task-priority";
import { previousMonthRangeUtc } from "./month-window";

import type { SiteReportSnapshot } from "./types";

const DONE_FIXES_CAP = 25;
const TOP_PAGES = 5;
const REFRESH_HIGH_CAP = 4;
const GROWTH_STORE = 20;
const REASON_MAX = 160;

function truncate(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type LoadSiteReportSnapshotOptions = {
  generatedAt?: Date;
  /** When provided, skips a second dashboard load (same object as site page). */
  performanceDashboard?: ContentPerformanceDashboard | null;
};

export async function loadSiteReportSnapshot(
  siteId: string,
  options?: LoadSiteReportSnapshotOptions,
): Promise<SiteReportSnapshot | null> {
  const generatedAt = options?.generatedAt ?? new Date();
  const { start, end, labelLong, labelShort } = previousMonthRangeUtc(generatedAt);

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      businessName: true,
      rootUrl: true,
      onboardingStage: true,
      primaryFocus: true,
      geoHint: true,
    },
  });
  if (!site) return null;

  await ensureLaunchChecklistForSite(site.id);
  const launchRows = await prisma.siteLaunchCheckItem.findMany({ where: { siteId: site.id } });
  const launchItems = mergeLaunchChecklistRows(launchRows);
  const launchDone = launchItems.filter((i) => i.done).length;
  const launchTotal = LAUNCH_CHECKLIST_DEF.length;

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

  const openFixTasksAll = sortOpenFixTasksByPriority(
    homepage
      ? await prisma.siteFixTask.findMany({ where: { siteId: site.id, status: "open" } })
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
  const launchBlockingOpenFixTaskCount = openFixTasksAll.filter((t) => t.bucket === "immediate").length;
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
    openFixTasks: openFixTasksAll.map((t) => ({
      dedupeKey: t.dedupeKey,
      title: t.title,
      blocksLaunch: t.bucket === "immediate",
    })),
  });

  const doneThisMonth = await prisma.siteFixTask.findMany({
    where: {
      siteId: site.id,
      status: "done",
      updatedAt: { gte: start, lte: end },
    },
    orderBy: { updatedAt: "desc" },
    take: DONE_FIXES_CAP,
    select: { title: true },
  });

  const [maintenanceActiveCount, maintenanceThisMonthCount, growthPendingCount, growthDoneThisMonthCount, openContentOpportunityCount, doneContentOpportunityThisMonthCount, partnershipRows] =
    await Promise.all([
      prisma.maintenanceAlert.count({ where: { siteId: site.id, status: "active" } }),
      prisma.maintenanceAlert.count({ where: { siteId: site.id, createdAt: { gte: start, lte: end } } }),
      prisma.growthTask.count({ where: { siteId: site.id, status: "pending" } }),
      prisma.growthTask.count({ where: { siteId: site.id, status: "done", completedAt: { gte: start, lte: end } } }),
      prisma.contentOpportunity.count({ where: { siteId: site.id, status: { in: ["identified", "planned", "active"] } } }),
      prisma.contentOpportunity.count({ where: { siteId: site.id, status: "done", updatedAt: { gte: start, lte: end } } }),
      prisma.partnership.findMany({
        where: { siteId: site.id },
        select: { status: true, lastActivity: true },
      }),
    ]);

  const partnershipDoneCount = partnershipRows.filter((r) => r.status === "done").length;
  const partnershipInProgressCount = partnershipRows.filter((r) => r.status === "in_progress").length;
  const partnershipNotStartedCount = partnershipRows.filter((r) => r.status === "not_started").length;
  const partnershipActivityThisMonthCount = partnershipRows.filter(
    (r) => r.lastActivity >= start && r.lastActivity <= end,
  ).length;

  const snaps = await prisma.contentPerformanceSnapshot.findMany({
    where: {
      siteId: site.id,
      periodEnd: { gte: start, lte: end },
    },
    select: {
      pageId: true,
      impressions: true,
      clicks: true,
      page: { select: { url: true } },
    },
  });

  type Agg = { url: string; imp: number; clk: number };
  const byPage = new Map<string, Agg>();
  let totalImp = 0;
  let totalClk = 0;
  for (const s of snaps) {
    const imp = s.impressions ?? 0;
    const clk = s.clicks ?? 0;
    totalImp += imp;
    totalClk += clk;
    const url = s.page?.url ?? s.pageId;
    const cur = byPage.get(s.pageId) ?? { url, imp: 0, clk: 0 };
    cur.imp += imp;
    cur.clk += clk;
    cur.url = url;
    byPage.set(s.pageId, cur);
  }
  const topPages = [...byPage.values()].sort((a, b) => b.imp - a.imp).slice(0, TOP_PAGES);

  const dashboard =
    options?.performanceDashboard !== undefined ?
      options.performanceDashboard
    : await loadContentPerformanceDashboard(site.id);

  const refreshCandidates = dashboard?.refreshCandidates ?? [];
  const refreshHigh = refreshCandidates
    .filter((c) => c.tier === "high")
    .slice(0, REFRESH_HIGH_CAP)
    .map((c) => ({
      url: c.url,
      reasonLine:
        c.scoreBreakdown[0]?.detail ? truncate(c.scoreBreakdown[0].detail, REASON_MAX) : (c.reasons[0] ?? ""),
    }));

  const promptPlannerRows = await listPromptClusterPlannerRows(site.id);
  const rankedContentGaps = rankContentGapOpportunities(promptPlannerRows, {
    primaryFocus: site.primaryFocus,
    businessName: site.businessName,
  });
  const growthOpportunities = limitGrowthOpportunities(
    buildSiteGrowthOpportunities({
      homepagePageId: homepage?.id ?? null,
      auditResults:
        latestRun?.results.map((r) => ({
          id: r.id,
          checkKey: r.checkKey,
          status: r.status,
          message: r.message,
        })) ?? [],
      rankedClusters: rankedContentGaps,
    }),
    GROWTH_STORE,
  );

  return {
    generatedAt,
    month: { start, end, labelLong, labelShort },
    site: {
      businessName: site.businessName,
      rootUrl: site.rootUrl,
      geoHint: site.geoHint,
      primaryFocus: site.primaryFocus,
      onboardingStage: site.onboardingStage,
    },
    homepageUrl: homepage?.url ?? null,
    readiness,
    launchChecklistItems: launchItems.map((i) => ({
      label: i.label,
      done: i.done,
      category: i.category,
    })),
    latestAudit:
      latestRun ?
        {
          status: latestRun.status,
          summaryRaw: latestRun.summary,
          startedAt: latestRun.startedAt,
          failCount: latestCounts.fail,
          warnCount: latestCounts.warn,
        }
      : null,
    openFixTasks: openFixTasksAll.map((t) => ({
      title: t.title,
      detail: t.detail,
      bucket: t.bucket,
      priorityScore: t.priorityScore,
    })),
    launchBlockers,
    doneFixesThisMonth: doneThisMonth,
    performance: {
      rowCount: snaps.length,
      totalImp,
      totalClk,
      topPages,
    },
    lighthouse: {
      performanceScore: homepage?.performanceScore ?? null,
      accessibilityScore: homepage?.accessibilityScore ?? null,
      bestPracticesScore: homepage?.bestPracticesScore ?? null,
      seoScore: homepage?.seoScore ?? null,
      lastAudited: homepage?.performanceLastAudited ?? null,
    },
    maintenance: {
      activeCount: maintenanceActiveCount,
      thisMonthCount: maintenanceThisMonthCount,
    },
    growth: {
      pendingCount: growthPendingCount,
      doneThisMonthCount: growthDoneThisMonthCount,
    },
    contentOpportunities: {
      openCount: openContentOpportunityCount,
      doneThisMonthCount: doneContentOpportunityThisMonthCount,
    },
    partnerships: {
      doneCount: partnershipDoneCount,
      inProgressCount: partnershipInProgressCount,
      notStartedCount: partnershipNotStartedCount,
      activityThisMonthCount: partnershipActivityThisMonthCount,
    },
    refreshHigh,
    growthOpportunities,
    rankedContentGaps,
    refreshCandidates,
  };
}
