import { prisma } from "@/lib/db";
import {
  formatRunSummary,
  parseRunSummaryCounts,
  parseSummaryErrorMessage,
} from "@/lib/audits/format-summary";
import { rankContentGapOpportunities } from "@/lib/sites/content-gap-rank";
import {
  buildSiteGrowthOpportunities,
  limitGrowthOpportunities,
  segmentLabel,
} from "@/lib/sites/content-pipeline";
import { collectLaunchBlockers, type LaunchBlocker } from "@/lib/sites/launch-blockers";
import {
  ensureLaunchChecklistForSite,
  LAUNCH_CHECKLIST_DEF,
  mergeLaunchChecklistRows,
} from "@/lib/sites/launch-checklist";
import { evaluateLaunchReadinessSummary } from "@/lib/sites/launch-readiness-rules";
import { listPromptClusterPlannerRows } from "@/lib/sites/prompt-clusters";
import { sortOpenFixTasksByPriority } from "@/lib/fix-tasks/open-task-priority";

const OPPORTUNITY_LIMIT = 5;
const TASK_DETAIL_MAX = 220;

export type ClientSiteReportData = {
  generatedAtIso: string;
  site: { businessName: string; rootUrl: string };
  readiness: { state: string; stateLabel: string; nextStep: string };
  launchChecklist: {
    done: number;
    total: number;
    percent: number;
    remainingLabels: string[];
  };
  audit: {
    status: string;
    summaryLine: string | null;
    failCount: number;
    warnCount: number;
    startedAtIso: string | null;
  } | null;
  blockers: { title: string; detail?: string }[];
  openTasks: { title: string; detail: string | null }[];
  opportunities: { category: string; title: string; why: string }[];
};

function truncateDetail(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function toClientBlockers(blockers: LaunchBlocker[]): { title: string; detail?: string }[] {
  return blockers.map((b) => {
    if (b.id === "audit_check_failures" && b.detail?.trim()) {
      const n = b.detail.split(",").map((x) => x.trim()).filter(Boolean).length;
      return {
        title: "Issues found on the latest site check",
        detail: n > 0 ? `${n} area(s) need fixes.` : undefined,
      };
    }
    if (b.id === "audit_check_warnings" && b.detail?.trim()) {
      const n = b.detail.split(",").map((x) => x.trim()).filter(Boolean).length;
      return {
        title: "Warnings on the latest site check",
        detail: n > 0 ? `${n} area(s) to review.` : undefined,
      };
    }
    return { title: b.title, detail: b.detail };
  });
}

export async function loadClientSiteReport(siteId: string): Promise<ClientSiteReportData | null> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      businessName: true,
      rootUrl: true,
      onboardingStage: true,
      primaryFocus: true,
    },
  });
  if (!site) return null;

  await ensureLaunchChecklistForSite(site.id);
  const launchRows = await prisma.siteLaunchCheckItem.findMany({ where: { siteId: site.id } });
  const launchItems = mergeLaunchChecklistRows(launchRows);
  const launchDone = launchItems.filter((i) => i.done).length;
  const launchTotal = LAUNCH_CHECKLIST_DEF.length;
  const launchPct = launchTotal ? Math.round((launchDone / launchTotal) * 100) : 0;
  const remainingLabels = launchItems.filter((i) => !i.done).map((i) => i.label);

  const homepage = await prisma.page.findFirst({
    where: { siteId: site.id },
    orderBy: { createdAt: "asc" },
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
  const readiness = evaluateLaunchReadinessSummary({
    hasHomepage: Boolean(homepage),
    latestRunStatus: latestRun?.status ?? null,
    onboardingStage: site.onboardingStage,
    checkFailCount: latestCounts.fail,
    checkWarnCount: latestCounts.warn,
    summaryHasError: latestCounts.hasError,
    launchDone,
    launchExpected: launchTotal,
    openFixTaskCount: openFixTasks.length,
  });

  const launchBlockers = collectLaunchBlockers({
    hasHomepage: Boolean(homepage),
    latestRunStatus: latestRun?.status ?? null,
    onboardingStage: site.onboardingStage,
    summaryHasError: latestCounts.hasError,
    summaryErrorMessage: parseSummaryErrorMessage(latestRun?.summary ?? null),
    auditResults:
      latestRun?.results?.map((r) => ({ checkKey: r.checkKey, status: r.status })) ?? [],
    checklistUndone: launchItems.filter((i) => !i.done).map((i) => ({ key: i.key, label: i.label })),
    openFixTasks: openFixTasks.map((t) => ({ dedupeKey: t.dedupeKey, title: t.title })),
  });

  const promptPlannerRows = await listPromptClusterPlannerRows(site.id);
  const rankedContentGaps = rankContentGapOpportunities(promptPlannerRows, {
    primaryFocus: site.primaryFocus,
    businessName: site.businessName,
  });

  const growthAll = buildSiteGrowthOpportunities({
    homepagePageId: homepage?.id ?? null,
    auditResults:
      latestRun?.results.map((r) => ({
        id: r.id,
        checkKey: r.checkKey,
        status: r.status,
        message: r.message,
      })) ?? [],
    rankedClusters: rankedContentGaps,
  });
  const growthTop = limitGrowthOpportunities(growthAll, OPPORTUNITY_LIMIT);

  const opportunities = growthTop.map((o) => ({
    category: segmentLabel(o.segment),
    title: o.headline,
    why: o.summaryReason,
  }));

  const openTasks = openFixTasks.map((t) => ({
    title: t.title,
    detail: truncateDetail(t.detail, TASK_DETAIL_MAX),
  }));

  return {
    generatedAtIso: new Date().toISOString(),
    site: { businessName: site.businessName, rootUrl: site.rootUrl },
    readiness: {
      state: readiness.state,
      stateLabel: readiness.stateLabel,
      nextStep: readiness.nextStep,
    },
    launchChecklist: {
      done: launchDone,
      total: launchTotal,
      percent: launchPct,
      remainingLabels,
    },
    audit:
      latestRun ?
        {
          status: latestRun.status,
          summaryLine: formatRunSummary(latestRun.summary),
          failCount: latestCounts.fail,
          warnCount: latestCounts.warn,
          startedAtIso: latestRun.startedAt.toISOString(),
        }
      : null,
    blockers: toClientBlockers(launchBlockers),
    openTasks,
    opportunities,
  };
}
