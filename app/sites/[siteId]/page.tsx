import type { SiteFixTask } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setLaunchCheckItemForm } from "@/app/actions/launch-checklist";
import {
  completeContentOpportunityForm,
  dismissContentOpportunityForm,
  generateContentOpportunitiesForm,
  planContentOpportunityForm,
} from "@/app/actions/content-opportunities";
import {
  markGrowthTaskDoneForm,
  runGrowthCadenceScanForm,
} from "@/app/actions/growth-cadence";
import {
  markMaintenanceAlertResolvedForm,
  runMaintenanceScanForm,
} from "@/app/actions/maintenance-alerts";
import {
  logPartnershipActivityForm,
  updatePartnershipForm,
} from "@/app/actions/partnerships";
import { runHomepagePerformanceAuditForm } from "@/app/actions/performance-audit";
import { applyPageMetadataForm } from "@/app/actions/seo-metadata";
import {
  completeSiteFixTaskForm,
  createFixTaskFromCheckForm,
} from "@/app/actions/site-fix-tasks";
import { rerunSiteAuditForm } from "@/app/actions/onboard";
import { AutoOpenFixTaskFromHash } from "@/components/AutoOpenFixTaskFromHash";
import { ContentPlannerSection } from "@/components/ContentPlannerSection";
import { ContentPerformanceSection } from "@/components/ContentPerformanceSection";
import { ReportTemplatesExportSection } from "@/components/ReportTemplatesExportSection";
import { SiteWhiteLabelSummary } from "@/components/SiteWhiteLabelSummary";
import { ContentWriterBriefsSection } from "@/components/ContentWriterBriefsSection";
import { ContentOpportunityRulesSection } from "@/components/ContentOpportunityRulesSection";
import { GrowthPipelineSection } from "@/components/GrowthPipelineSection";
import { FixTaskOpenLink } from "@/components/FixTaskOpenLink";
import { FixRecommendations } from "@/components/FixRecommendations";
import { PostActionScrollFocus } from "@/components/PostActionScrollFocus";
import { LaunchBlockersSection } from "@/components/LaunchBlockersSection";
import { LaunchWarningsSection } from "@/components/LaunchWarningsSection";
import { prisma } from "@/lib/db";
import {
  formatRunSummary,
  parseRunSummaryCounts,
  parseSummaryErrorMessage,
} from "@/lib/audits/format-summary";
import {
  buildFixRecommendations,
  fixRecommendationForRunCheck,
  groupFixesByBucket,
} from "@/lib/audits/fix-plan";
import {
  ensureLaunchChecklistForSite,
  LAUNCH_CHECKLIST_DEF,
  mergeLaunchChecklistRows,
  SET_FORGET_BASELINE_KEYS,
} from "@/lib/sites/launch-checklist";
import {
  groupOpenFixTasksByWorkflow,
  OPEN_FIX_WORKFLOW_COPY,
  OPEN_FIX_WORKFLOW_ORDER,
  sortOpenFixTasksByPriority,
} from "@/lib/fix-tasks/open-task-priority";
import { tryParseOpportunityTaskDedupe } from "@/lib/fix-tasks/opportunity-task";
import { evaluateLaunchReadinessSummary } from "@/lib/sites/launch-readiness-rules";
import { recommendedActionsForReadinessState } from "@/lib/sites/readiness-recommended-actions";
import {
  collectLaunchBlockers,
  collectLaunchWarnings,
  summarizeAuditHardFailures,
} from "@/lib/sites/launch-blockers";
import {
  buildNextBestAction,
  nextBestActionModeLabel,
} from "@/lib/sites/next-best-action";
import { buildNextActionPanel } from "@/lib/sites/next-action-panel";
import { rankContentGapOpportunities } from "@/lib/sites/content-gap-rank";
import {
  buildSiteGrowthOpportunities,
  limitGrowthOpportunities,
} from "@/lib/sites/content-pipeline";
import { buildContentPlannerColumns } from "@/lib/sites/content-planner";
import { loadWriterBriefsForSite } from "@/lib/sites/load-content-opportunity-briefs";
import { findRuleBasedContentOpportunities } from "@/lib/sites/content-opportunity-rules";
import { listPromptClusterPlannerRows } from "@/lib/sites/prompt-clusters";
import { loadContentPerformanceDashboard } from "@/lib/sites/load-content-performance-dashboard";
import {
  loadSiteReportSnapshot,
  renderSiteReportTemplate,
} from "@/lib/sites/report-templates";
import { isWhiteLabelSiteSummaryMode } from "@/lib/sites/whitelabel-site-summary";
import { buildKeywordSuggestions } from "@/lib/keywords";
import { buildMetadataOptions, PAGE_TYPES, type PageType } from "@/lib/metadata";
import { buildSiteBriefFromSite } from "@/lib/site-brief";
import { scoreColor, isOlderThanDays } from "@/lib/sites/performance-audit";
import { buildPerformanceGuidance } from "@/lib/sites/performance-guidance";
import { MAINTENANCE_TRIGGER_COPY } from "@/lib/maintenance-rules";
import { ensurePartnershipChecklistForSite, listPartnershipsSafe } from "@/lib/partnerships";

export const dynamic = "force-dynamic";

/** Vercel Pro+: raises the default ~10s cap so this data-heavy page can finish. Hobby tier still caps at 10s. */
export const maxDuration = 60;

function parseKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean).slice(0, 3);
}

function readinessPillClass(state: string): string {
  if (state === "ready") return "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]";
  if (state === "nearly_ready") return "border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f59e0b]";
  return "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]";
}

function scoreChipClass(score: number | null): string {
  if (score == null) return "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  if (score >= 90) return "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]";
  if (score >= 70) return "border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f59e0b]";
  return "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]";
}

function growthTaskHref(siteId: string, taskKey: string): string {
  switch (taskKey) {
    case "gsc_performance_snapshot":
      return "#open-fix-tasks";
    case "core_web_vitals_sanity":
      return "#launch-checklist";
    case "publish_one_blog":
      return `/sites/${siteId}`;
    case "publish_or_update_topic_page":
      return `/sites/${siteId}`;
    case "internal_link_pass":
      return `/sites/${siteId}`;
    case "refresh_low_ctr_pages":
      return `/sites/${siteId}`;
    case "content_roi_review":
      return `/sites/${siteId}`;
    case "gbp_photos_refresh":
      return "#launch-checklist";
    case "topic_cluster_roadmap":
      return `/sites/${siteId}`;
    case "competitor_gap_summary":
      return `/sites/${siteId}`;
    default:
      return `/sites/${siteId}`;
  }
}

export default async function SiteSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{
    runId?: string;
    msg?: string;
    wl?: string;
    full?: string;
    clientView?: string;
    seoPageId?: string;
    seoPageType?: string;
    seoTopicHint?: string;
  }>;
}) {
  const { siteId } = await params;
  const { runId: runIdParam, msg, wl, full, clientView, seoPageId, seoPageType, seoTopicHint } = await searchParams;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });
  if (!site) notFound();

  const now = new Date();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await ensurePartnershipChecklistForSite(site.id);

  const [activeMaintenanceAlerts, maintenanceAlertsThisMonth, dueThisWeekRaw, dueThisMonthRaw, topContentOpportunities, partnerships] = await Promise.all([
    prisma.maintenanceAlert.findMany({
      where: { siteId: site.id, status: "active" },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.maintenanceAlert.count({
      where: { siteId: site.id, createdAt: { gte: monthStart } },
    }),
    prisma.growthTask.findMany({
      where: {
        siteId: site.id,
        status: "pending",
        dueDate: { lte: weekEnd },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
      take: 3,
    }),
    prisma.growthTask.findMany({
      where: {
        siteId: site.id,
        status: "pending",
        dueDate: { lte: monthEnd },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
      take: 8,
    }),
    prisma.contentOpportunity.findMany({
      where: { siteId: site.id, status: { in: ["identified", "planned", "active"] } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 3,
    }),
    listPartnershipsSafe(site.id),
  ]);
  const dueThisWeek = dueThisWeekRaw.slice(0, 3);
  const dueThisMonth = dueThisMonthRaw.slice(0, 5);

  await ensureLaunchChecklistForSite(site.id);
  const [launchRows, homepage, sitePages] = await Promise.all([
    prisma.siteLaunchCheckItem.findMany({
      where: { siteId: site.id },
    }),
    prisma.page.findFirst({
      where: { siteId: site.id },
      orderBy: { createdAt: "asc" },
      include: { service: true },
    }),
    prisma.page.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: "asc" },
      include: { service: true },
    }),
  ]);
  const launchItems = mergeLaunchChecklistRows(launchRows);
  const launchDone = launchItems.filter((i) => i.done).length;
  const launchTotal = LAUNCH_CHECKLIST_DEF.length;
  const launchPct = launchTotal ? Math.round((launchDone / launchTotal) * 100) : 0;
  const setForgetItems = launchItems.filter((i) =>
    (SET_FORGET_BASELINE_KEYS as readonly string[]).includes(i.key),
  );
  const setForgetDone = setForgetItems.filter((i) => i.done).length;
  const setForgetTotal = setForgetItems.length;
  const setForgetPct = setForgetTotal ? Math.round((setForgetDone / setForgetTotal) * 100) : 0;
  const lighthouseScores = [
    homepage?.performanceScore ?? null,
    homepage?.accessibilityScore ?? null,
    homepage?.bestPracticesScore ?? null,
    homepage?.seoScore ?? null,
  ].filter((v): v is number => typeof v === "number");
  const lighthouseAvg =
    lighthouseScores.length > 0 ? Math.round(lighthouseScores.reduce((sum, n) => sum + n, 0) / lighthouseScores.length) : null;
  const checklistPercent = launchTotal > 0 ? Math.round((launchDone / launchTotal) * 100) : 0;
  const activeAlertCount = activeMaintenanceAlerts.length;
  const openGrowthTaskCount = dueThisMonthRaw.length;
  const openPartnershipCount = partnerships.filter((p) => p.status !== "done").length;
  const perfGuidance = buildPerformanceGuidance({
    siteId: site.id,
    performanceScore: homepage?.performanceScore ?? null,
    seoScore: homepage?.seoScore ?? null,
    accessibilityScore: homepage?.accessibilityScore ?? null,
  });
  const perfAuditStale = isOlderThanDays(homepage?.performanceLastAudited ?? null, 7);
  const siteBrief = buildSiteBriefFromSite(site);
  const selectedSeoPage =
    sitePages.find((p) => p.id === (seoPageId ?? "").trim()) ??
    homepage ??
    sitePages[0] ??
    null;
  const parsedSeoType = (seoPageType ?? "").trim() as PageType;
  const selectedSeoPageType: PageType =
    PAGE_TYPES.includes(parsedSeoType) ? parsedSeoType : selectedSeoPage?.pageType && PAGE_TYPES.includes(selectedSeoPage.pageType as PageType)
      ? (selectedSeoPage.pageType as PageType)
      : selectedSeoPage && selectedSeoPage.url === site.rootUrl
        ? "homepage"
        : "service";
  const seoMetadataOptions = selectedSeoPage
    ? buildMetadataOptions({
        brief: siteBrief,
        pageType: selectedSeoPageType,
        linkedService: selectedSeoPage.service?.name ?? null,
        topicHint: seoTopicHint?.trim() || undefined,
      })
    : null;
  const seoKeywords = selectedSeoPage
    ? buildKeywordSuggestions({
        brief: siteBrief,
        pageKind: selectedSeoPageType === "blog" ? "blog-support" : "service",
      })
    : null;

  let openFixTasks: SiteFixTask[] = [];
  let latestRun = null;
  let run = null;
  if (homepage) {
    const [openTasksRaw, latestCandidate] = await Promise.all([
      prisma.siteFixTask.findMany({
        where: { siteId: site.id, status: "open" },
      }),
      prisma.auditRun.findFirst({
        where: { pageId: homepage.id },
        orderBy: { startedAt: "desc" },
        include: { results: { orderBy: { checkKey: "asc" } } },
      }),
    ]);
    openFixTasks = sortOpenFixTasksByPriority(openTasksRaw);
    latestRun = latestCandidate;
    if (runIdParam) {
      const pinned = await prisma.auditRun.findFirst({
        where: { id: runIdParam, pageId: homepage.id },
        include: { results: { orderBy: { checkKey: "asc" } } },
      });
      run = pinned ?? latestRun;
    } else {
      run = latestRun;
    }
  }

  const openOpportunityFixKeys: string[] = [];
  const openOpportunityContentKeys: string[] = [];
  for (const t of openFixTasks) {
    const parsed = tryParseOpportunityTaskDedupe(t.dedupeKey);
    if (!parsed) continue;
    if (parsed.kind === "fix") openOpportunityFixKeys.push(parsed.clusterKey);
    else openOpportunityContentKeys.push(parsed.clusterKey);
  }

  const launchRemainingLabels = launchItems.filter((i) => !i.done).map((i) => i.label);
  const launchRemainingKeys = launchItems.filter((i) => !i.done).map((i) => i.key);
  const latestCounts = parseRunSummaryCounts(latestRun?.summary ?? null);
  const latestAuditRows =
    latestRun?.results?.map((r) => ({ checkKey: r.checkKey, status: r.status })) ?? [];
  const hardFailCount = summarizeAuditHardFailures(latestAuditRows).length;
  const openFixTaskCount = openFixTasks.length;
  const launchBlockingOpenFixTaskCount = openFixTasks.filter((t) => t.bucket === "immediate").length;
  const readinessSummary = evaluateLaunchReadinessSummary({
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
  const nextPanel = buildNextActionPanel({
    hasHomepage: Boolean(homepage),
    latestRunStatus: latestRun?.status ?? null,
    onboardingStage: site.onboardingStage,
    results: latestRun?.results ?? [],
    launchRemainingLabels,
    launchRemainingKeys,
    checkFailCount: latestCounts.fail,
    checkWarnCount: latestCounts.warn,
    summaryHasError: latestCounts.hasError,
    summaryErrorMessage: parseSummaryErrorMessage(latestRun?.summary ?? null),
  });

  const fixesFromLatestAudit =
    latestRun != null
      ? buildFixRecommendations(
          latestRun.results.map((r) => ({
            checkKey: r.checkKey,
            status: r.status,
            message: r.message,
          })),
          { geoHint: site.geoHint },
        )
      : [];

  const nextBestAction = buildNextBestAction({
    readinessState: readinessSummary.state,
    nextPanel,
    fixesFromLatestAudit,
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
  const launchWarnings = collectLaunchWarnings({
    auditResults: latestAuditRows,
  });

  const runInputs =
    run != null
      ? run.results.map((r) => ({
          checkKey: r.checkKey,
          status: r.status,
          message: r.message,
        }))
      : [];

  const fixGrouped =
    run != null
      ? groupFixesByBucket(
          buildFixRecommendations(runInputs, { geoHint: site.geoHint }),
        )
      : groupFixesByBucket([]);

  const openDedupeKeys = new Set(openFixTasks.map((t) => t.dedupeKey));

  const latestAuditInputs =
    latestRun != null
      ? latestRun.results.map((r) => ({
          checkKey: r.checkKey,
          status: r.status,
          message: r.message,
        }))
      : [];

  const auditTaskQueuedByCheckId: Record<string, boolean> = {};
  if (latestRun) {
    for (const r of latestRun.results) {
      if (r.status === "pass") {
        auditTaskQueuedByCheckId[r.id] = false;
        continue;
      }
      const rec = fixRecommendationForRunCheck(latestAuditInputs, {
        checkKey: r.checkKey,
        status: r.status,
        message: r.message,
      });
      auditTaskQueuedByCheckId[r.id] = Boolean(rec && openDedupeKeys.has(rec.key));
    }
  }

  const openFixTasksByWorkflow = groupOpenFixTasksByWorkflow(openFixTasks);
  const readinessRecommended = recommendedActionsForReadinessState(readinessSummary.state);
  const promptClusterPlannerRows = await listPromptClusterPlannerRows(site.id);
  const rankedContentGaps = rankContentGapOpportunities(promptClusterPlannerRows, {
    primaryFocus: site.primaryFocus,
    businessName: site.businessName,
  });

  const growthOpportunitiesAll = buildSiteGrowthOpportunities({
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
  const growthOpportunities = limitGrowthOpportunities(growthOpportunitiesAll);

  const [
    catalogServiceSlugs,
    globallyLinkedServiceSlugs,
    sitePagesForRules,
    writerBriefRows,
    performanceDashboard,
  ] = await Promise.all([
    prisma.service.findMany({ select: { slug: true }, orderBy: { slug: "asc" } }).then((rows) => rows.map((s) => s.slug)),
    prisma.service
      .findMany({
        where: { pages: { some: {} } },
        select: { slug: true },
        orderBy: { slug: "asc" },
      })
      .then((rows) => rows.map((s) => s.slug)),
    prisma.page.findMany({
      where: { siteId: site.id },
      select: { status: true, serviceId: true, service: { select: { slug: true } } },
    }),
    loadWriterBriefsForSite(site.id),
    loadContentPerformanceDashboard(site.id),
  ]);

  const siteLinkedServiceSlugs = [
    ...new Set(sitePagesForRules.filter((p) => p.service?.slug).map((p) => p.service!.slug)),
  ].sort((a, b) => a.localeCompare(b));

  const checklistDoneByKey = Object.fromEntries(launchItems.map((i) => [i.key, i.done]));

  const ruleBasedContentFindings = findRuleBasedContentOpportunities({
    checklistDoneByKey,
    auditChecks:
      latestRun?.results.map((r) => ({
        checkKey: r.checkKey,
        status: r.status,
      })) ?? [],
    clusters: rankedContentGaps.map((r) => ({
      key: r.clusterKey,
      promptCount: r.row.prompts.length,
    })),
    sitePages: sitePagesForRules.map((p) => ({ status: p.status, serviceId: p.serviceId })),
    catalogServiceSlugs,
    globallyLinkedServiceSlugs,
    siteLinkedServiceSlugs,
    openFixDedupeKeys: openFixTasks.map((t) => t.dedupeKey),
  });

  const contentPlannerColumns = buildContentPlannerColumns(rankedContentGaps, ruleBasedContentFindings);

  const siteReportSnapshot = await loadSiteReportSnapshot(site.id, { performanceDashboard });
  const reportTemplateTexts =
    siteReportSnapshot ?
      {
        monthly_seo: renderSiteReportTemplate("monthly_seo", siteReportSnapshot),
        geo_focus: renderSiteReportTemplate("geo_focus", siteReportSnapshot),
        launch_readiness: renderSiteReportTemplate("launch_readiness", siteReportSnapshot),
        monthly_ops: renderSiteReportTemplate("monthly_ops", siteReportSnapshot),
      }
    : null;

  if (isWhiteLabelSiteSummaryMode({ wl, full, clientView })) {
    const attentionTitles = launchBlockers.map((b) => b.title).slice(0, 12);
    const openTaskTitles = openFixTasks.slice(0, 10).map((t) => t.title);
    const latestAuditLine = latestRun
      ? `${latestRun.status}${latestRun.summary ? ` · ${formatRunSummary(latestRun.summary)}` : ""}`
      : null;

    return (
      <SiteWhiteLabelSummary
        msg={msg}
        businessName={site.businessName}
        rootUrl={site.rootUrl}
        readinessState={readinessSummary.state}
        readinessLabel={readinessSummary.stateLabel}
        readinessNextStep={readinessSummary.nextStep}
        recommendedHeadline={readinessRecommended.headline}
        recommendedDetail={readinessRecommended.detail}
        launchDone={launchDone}
        launchTotal={launchTotal}
        launchPct={launchPct}
        remainingChecklistLabels={launchRemainingLabels.slice(0, 8)}
        latestAuditLine={latestAuditLine}
        openTaskCount={openFixTaskCount}
        openTaskTitles={openTaskTitles}
        attentionTitles={attentionTitles}
      />
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <Suspense fallback={null}>
        <PostActionScrollFocus variant="site" />
      </Suspense>
      <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{site.businessName}</h1>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${readinessPillClass(readinessSummary.state)}`}
              >
                {readinessSummary.stateLabel}
              </span>
            </div>
            <p className="mt-1 font-mono text-sm text-zinc-600 dark:text-zinc-400">{site.rootUrl}</p>
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Next action:</span> {nextBestAction.headline}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{nextBestAction.detail}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/70">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Checklist</p>
                <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{checklistPercent}% complete</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/70">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Lighthouse Avg</p>
                <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{lighthouseAvg ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/70">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Open Tasks</p>
                <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{openFixTaskCount + openGrowthTaskCount}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
          <Link
            href="/onboard"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            Add another site
          </Link>
          <Link href="/pages" className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600">
            Page catalog
          </Link>
          <Link href="/audits" className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600">
            All audits
          </Link>
          <Link href="/sites" className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600">
            All sites
          </Link>
          <Link
            href={`/sites/${siteId}/launch-report`}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            Launch report
          </Link>
          <Link
            href={`/sites/${siteId}/metadata`}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            SEO metadata
          </Link>
          <Link
            href={`/sites/${siteId}?clientView=1`}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            Client view
          </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Performance</p>
            <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-medium ${scoreChipClass(homepage?.performanceScore ?? null)}`}>
              {homepage?.performanceScore ?? "—"}
            </span>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Accessibility</p>
            <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-medium ${scoreChipClass(homepage?.accessibilityScore ?? null)}`}>
              {homepage?.accessibilityScore ?? "—"}
            </span>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Best Practices</p>
            <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-medium ${scoreChipClass(homepage?.bestPracticesScore ?? null)}`}>
              {homepage?.bestPracticesScore ?? "—"}
            </span>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs uppercase tracking-wide text-zinc-500">SEO</p>
            <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-medium ${scoreChipClass(homepage?.seoScore ?? null)}`}>
              {homepage?.seoScore ?? "—"}
            </span>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Last Audit</p>
            <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {homepage?.performanceLastAudited ? homepage.performanceLastAudited.toISOString().slice(0, 10) : "Never"}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700 md:col-span-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Checklist progress</span>
              <span>{checklistPercent}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div className="h-2 rounded-full bg-[#10b981]" style={{ width: `${checklistPercent}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            <p>Active alerts: <span className="font-semibold">{activeAlertCount}</span></p>
            <p className="mt-1">Pending growth tasks: <span className="font-semibold">{openGrowthTaskCount}</span></p>
            <p className="mt-1">Open partnerships: <span className="font-semibold">{openPartnershipCount}</span></p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[
          { title: "Set & Forget", metric: `${setForgetDone}/${setForgetTotal} complete`, detail: `${setForgetPct}% baseline done`, href: "#set-forget-baseline" },
          { title: "Lighthouse", metric: `Avg ${lighthouseAvg ?? "—"}`, detail: `Perf ${homepage?.performanceScore ?? "—"} · SEO ${homepage?.seoScore ?? "—"}`, href: "#lighthouse-phase" },
          { title: "Maintenance", metric: `${activeAlertCount} active`, detail: `${maintenanceAlertsThisMonth} this month`, href: "#maintenance-phase" },
          { title: "Growth", metric: `${dueThisWeek.length} due this week`, detail: `${dueThisMonth.length} due this month`, href: "#growth-phase" },
          { title: "Content", metric: `${topContentOpportunities.length} open`, detail: "Service, FAQ, and supporting opportunities", href: "#content-phase" },
          { title: "Partnerships", metric: `${openPartnershipCount} open`, detail: `${partnerships.length - openPartnershipCount} done`, href: "#partnerships-phase" },
        ].map((card) => (
          <article key={card.title} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Phase</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{card.title}</h2>
            <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">{card.metric}</p>
            <p className="mt-1 text-xs text-zinc-500">{card.detail}</p>
            <a href={card.href} className="mt-3 inline-block text-xs font-medium underline">
              View details
            </a>
          </article>
        ))}
      </section>

      <section
        id="set-forget-baseline"
        className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
          Set &amp; Forget baseline
        </h2>
        <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-200/90">
          Do this once, then revisit only when a trigger fires (rebrand, URL/service changes, redesign, or tracking
          updates).
        </p>
        <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {setForgetDone}/{setForgetTotal} complete ({setForgetPct}%)
        </p>
        <a href="#launch-checklist" className="mt-2 inline-block text-xs font-medium underline">
          Review checklist baseline items
        </a>
      </section>

      <section id="lighthouse-phase" className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Performance &amp; Core Web Vitals</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Low performance hurts rankings. Aim for green across the board. Advisory only (not launch-blocking).
            </p>
          </div>
          {homepage ? (
            <form action={runHomepagePerformanceAuditForm}>
              <input type="hidden" name="siteId" value={site.id} />
              <button
                type="submit"
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
              >
                {perfAuditStale ? "Run Lighthouse audit" : "Re-run Lighthouse audit"}
              </button>
            </form>
          ) : null}
        </div>

        {homepage ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Performance</p>
                <p className={`mt-1 text-2xl font-semibold ${scoreColor(homepage.performanceScore)}`}>
                  {homepage.performanceScore ?? "—"}
                </p>
              </div>
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Accessibility</p>
                <p className={`mt-1 text-2xl font-semibold ${scoreColor(homepage.accessibilityScore)}`}>
                  {homepage.accessibilityScore ?? "—"}
                </p>
              </div>
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Best Practices</p>
                <p className={`mt-1 text-2xl font-semibold ${scoreColor(homepage.bestPracticesScore)}`}>
                  {homepage.bestPracticesScore ?? "—"}
                </p>
              </div>
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">SEO</p>
                <p className={`mt-1 text-2xl font-semibold ${scoreColor(homepage.seoScore)}`}>
                  {homepage.seoScore ?? "—"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>
                Last audited:{" "}
                {homepage.performanceLastAudited ? homepage.performanceLastAudited.toISOString() : "Never"}
              </span>
              {homepage.performanceAuditUrl ? (
                <a href={homepage.performanceAuditUrl} target="_blank" rel="noreferrer" className="underline">
                  Open audit report
                </a>
              ) : null}
              {perfAuditStale ? <span className="text-amber-600 dark:text-amber-400">Audit is older than 7 days</span> : null}
            </div>

            {perfGuidance.length > 0 ? (
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                {perfGuidance.map((g) => (
                  <li key={`${g.kind}-${g.message}`}>
                    {g.message}{" "}
                    {g.href.startsWith("/") ? (
                      <Link href={g.href} className="underline">
                        Review
                      </Link>
                    ) : (
                      <a href={g.href} className="underline">
                        Review
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">No advisory performance actions right now.</p>
            )}
          </>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            No homepage linked yet, so Lighthouse scores are unavailable.
          </p>
        )}
      </section>

      <section id="partnerships-phase" className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Partnerships</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Manual tracker for directories, referrals, co-marketing, and local network partnerships.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {partnerships.map((p) => (
            <li key={p.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.partnerName}</p>
              <p className="mt-1 text-xs text-zinc-500">Type: {p.type} · Last activity: {p.lastActivity.toISOString().slice(0, 10)}</p>
              <form action={updatePartnershipForm} className="mt-3 grid gap-2 md:grid-cols-3">
                <input type="hidden" name="siteId" value={site.id} />
                <input type="hidden" name="partnershipId" value={p.id} />
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-zinc-500">Status</span>
                  <select
                    name="status"
                    defaultValue={p.status}
                    className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  >
                    <option value="not_started">not started</option>
                    <option value="in_progress">in progress</option>
                    <option value="done">done</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs md:col-span-2">
                  <span className="text-zinc-500">Next action</span>
                  <input
                    name="nextAction"
                    defaultValue={p.nextAction ?? ""}
                    className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs md:col-span-3">
                  <span className="text-zinc-500">Notes</span>
                  <textarea
                    name="notes"
                    defaultValue={p.notes ?? ""}
                    rows={2}
                    className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <div className="md:col-span-3 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-600"
                  >
                    Save partnership item
                  </button>
                </div>
              </form>
              <form action={logPartnershipActivityForm} className="mt-2">
                <input type="hidden" name="siteId" value={site.id} />
                <input type="hidden" name="partnershipId" value={p.id} />
                <button
                  type="submit"
                  className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-600"
                >
                  Log partnership activity
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section id="content-phase" className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Content opportunities</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Deterministic opportunities from onboarding brief, GEO hint, and growth signals.
            </p>
          </div>
          <form action={generateContentOpportunitiesForm}>
            <input type="hidden" name="siteId" value={site.id} />
            <button
              type="submit"
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
            >
              Generate new opportunities
            </button>
          </form>
        </div>

        {topContentOpportunities.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">
            No active opportunities yet. Generate to get 3-5 manual planning options.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {topContentOpportunities.map((opp) => {
              const keywords = parseKeywords(opp.keywordSuggestions);
              return (
                <li key={opp.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{opp.topic}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {opp.type} · priority {opp.priority} · status {opp.status}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">{opp.reason}</p>
                  {keywords.length > 0 ? (
                    <p className="mt-1 text-xs text-zinc-500">Keywords: {keywords.join(" | ")}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-500">Next action: {opp.nextAction}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={planContentOpportunityForm}>
                      <input type="hidden" name="siteId" value={site.id} />
                      <input type="hidden" name="opportunityId" value={opp.id} />
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-600"
                      >
                        Plan this
                      </button>
                    </form>
                    <form action={dismissContentOpportunityForm}>
                      <input type="hidden" name="siteId" value={site.id} />
                      <input type="hidden" name="opportunityId" value={opp.id} />
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-600"
                      >
                        Dismiss
                      </button>
                    </form>
                    <form action={completeContentOpportunityForm}>
                      <input type="hidden" name="siteId" value={site.id} />
                      <input type="hidden" name="opportunityId" value={opp.id} />
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-600"
                      >
                        Done
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="growth-phase" className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Growth cadence</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Manual cadence tracker for recurring growth tasks from the field guide.
            </p>
          </div>
          <form action={runGrowthCadenceScanForm}>
            <input type="hidden" name="siteId" value={site.id} />
            <button
              type="submit"
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
            >
              Run cadence scan
            </button>
          </form>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What&apos;s due this week</h3>
            {dueThisWeek.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No pending cadence tasks due this week.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {dueThisWeek.map((t) => (
                  <li key={t.id} className="rounded border border-zinc-100 p-2 dark:border-zinc-800">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.description}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {t.cadence} · due {t.dueDate.toISOString().slice(0, 10)} · priority {t.priority}
                    </p>
                    <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">{t.nextAction}</p>
                    <div className="mt-2 flex items-center gap-3">
                      {growthTaskHref(site.id, t.taskKey).startsWith("/") ? (
                        <Link href={growthTaskHref(site.id, t.taskKey)} className="text-xs underline">
                          Open related area
                        </Link>
                      ) : (
                        <a href={growthTaskHref(site.id, t.taskKey)} className="text-xs underline">
                          Open related area
                        </a>
                      )}
                      <form action={markGrowthTaskDoneForm} className="flex items-center gap-2">
                        <input type="hidden" name="siteId" value={site.id} />
                        <input type="hidden" name="taskId" value={t.id} />
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" name="confirmDone" required />
                          Done
                        </label>
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600"
                        >
                          Save
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">This month</h3>
            {dueThisMonth.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No pending cadence tasks due this month.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {dueThisMonth.map((t) => (
                  <li key={t.id} className="text-sm">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{t.description}</p>
                    <p className="text-xs text-zinc-500">
                      {t.cadence} · due {t.dueDate.toISOString().slice(0, 10)} · priority {t.priority}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>

      <section id="maintenance-phase" className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Maintenance alerts</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Manual operations panel. The system only surfaces triggers; you review and resolve.
            </p>
          </div>
          <form action={runMaintenanceScanForm}>
            <input type="hidden" name="siteId" value={site.id} />
            <button
              type="submit"
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
            >
              Run maintenance scan
            </button>
          </form>
        </div>

        <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {activeMaintenanceAlerts.length} active alert(s) · {maintenanceAlertsThisMonth} total this month
        </p>

        {activeMaintenanceAlerts.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No active maintenance alerts.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {activeMaintenanceAlerts.map((a) => {
              const trigger = MAINTENANCE_TRIGGER_COPY[a.triggerKey];
              const triggerName = trigger?.name ?? a.triggerKey;
              return (
                <li key={a.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{triggerName}</p>
                      <p className="mt-1 text-xs text-zinc-500">Priority: {a.priority}</p>
                    </div>
                    <form action={markMaintenanceAlertResolvedForm}>
                      <input type="hidden" name="siteId" value={site.id} />
                      <input type="hidden" name="alertId" value={a.id} />
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-600"
                      >
                        Mark resolved
                      </button>
                    </form>
                  </div>
                  <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">{a.reason}</p>
                  {trigger?.why ? (
                    <p className="mt-1 text-xs text-zinc-500">Why: {trigger.why}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-500">Next action: {a.nextAction}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {reportTemplateTexts ? <ReportTemplatesExportSection texts={reportTemplateTexts} /> : null}

      <div className="mt-6">
        <LaunchBlockersSection blockers={launchBlockers} />
      </div>
      <div className="mt-4">
        <LaunchWarningsSection warnings={launchWarnings} />
      </div>

      <GrowthPipelineSection
        opportunities={growthOpportunities}
        siteId={site.id}
        canCreateTasks={Boolean(homepage)}
        auditTaskQueuedByCheckId={auditTaskQueuedByCheckId}
        openOpportunityFixKeys={openOpportunityFixKeys}
        openOpportunityContentKeys={openOpportunityContentKeys}
      />

      <ContentOpportunityRulesSection findings={ruleBasedContentFindings} />

      <ContentPlannerSection
        siteId={site.id}
        columns={contentPlannerColumns}
        queuedOpportunityKeys={writerBriefRows.map((r) => r.opportunityKey)}
        queuedPipelineItems={writerBriefRows.map((r) => ({
          opportunityKey: r.opportunityKey,
          queueItemId: r.queueItemId,
        }))}
      />

      <ContentWriterBriefsSection siteId={site.id} briefs={writerBriefRows} />

      {performanceDashboard ? (
        <ContentPerformanceSection siteId={site.id} dashboard={performanceDashboard} />
      ) : null}

      <section
        className={
          nextBestAction.mode === "blockers"
            ? "mt-6 rounded-lg border-2 border-amber-400 bg-amber-50/90 p-5 dark:border-amber-700 dark:bg-amber-950/40"
            : nextBestAction.mode === "high_impact_fixes"
              ? "mt-6 rounded-lg border-2 border-sky-400 bg-sky-50/90 p-5 dark:border-sky-800 dark:bg-sky-950/40"
              : "mt-6 rounded-lg border-2 border-emerald-400 bg-emerald-50/90 p-5 dark:border-emerald-800 dark:bg-emerald-950/40"
        }
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Next best action
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {nextBestActionModeLabel(nextBestAction.mode)}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{nextBestAction.headline}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{nextBestAction.detail}</p>
        {nextBestAction.traceKey ? (
          <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">{nextBestAction.traceKey}</p>
        ) : null}
      </section>

      {msg ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {msg}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Metadata and keyword suggestions</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Deterministic options from onboarding brief + page type. Never auto-applied.
            </p>
          </div>
          <Link
            href={`/sites/${site.id}/metadata`}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
          >
            Open full metadata workspace
          </Link>
        </div>

        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{siteBrief.geoAreaNoteVisible || site.geoAreaNoteVisible}</p>

        <form method="get" className="mt-4 grid gap-3 md:grid-cols-3">
          <input type="hidden" name="runId" value={runIdParam ?? ""} />
          <input type="hidden" name="wl" value={wl ?? ""} />
          <input type="hidden" name="full" value={full ?? ""} />
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">Page</span>
            <select
              name="seoPageId"
              defaultValue={selectedSeoPage?.id ?? ""}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            >
              {sitePages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.url}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">Page type</span>
            <select
              name="seoPageType"
              defaultValue={selectedSeoPageType}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            >
              {PAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">Topic hint (blog)</span>
            <input
              name="seoTopicHint"
              defaultValue={seoTopicHint ?? ""}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
            >
              Refresh suggestions
            </button>
          </div>
        </form>

        {selectedSeoPage && seoMetadataOptions && seoKeywords ? (
          <form action={applyPageMetadataForm} className="mt-4 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <input type="hidden" name="siteId" value={site.id} />
            <input type="hidden" name="pageId" value={selectedSeoPage.id} />
            <input type="hidden" name="pageType" value={selectedSeoPageType} />
            {seoTopicHint ? <input type="hidden" name="topicHint" value={seoTopicHint} /> : null}

            <div className="space-y-2">
              {seoMetadataOptions.map((opt, idx) => (
                <label
                  key={`${opt.title}-${idx}`}
                  className="block rounded border border-zinc-200 p-3 text-sm dark:border-zinc-700"
                >
                  <div className="flex items-start gap-2">
                    <input type="radio" name="selectedOption" value={String(idx)} defaultChecked={idx === 0} />
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{opt.title}</p>
                      <p className="mt-1 text-zinc-700 dark:text-zinc-300">{opt.metaDescription}</p>
                      <p className="mt-1 text-xs text-zinc-500">{opt.reasoning}</p>
                      <p className="text-xs text-zinc-500">{opt.fitNote}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Keyword options (top 3)</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                {seoKeywords.map((k) => (
                  <li key={k.keyword}>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{k.keyword}</p>
                    <p className="text-xs text-zinc-500">
                      relevance {k.relevanceScore} · opportunity {k.opportunityScore} · intent {k.intentScore} · weighted{" "}
                      {k.weightedScore}
                    </p>
                    <p className="text-xs text-zinc-500">{k.reasoning}</p>
                  </li>
                ))}
              </ol>
            </div>

            <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" name="confirmed" value="1" className="mt-0.5" />
              <span>Confirm before apply. This writes only title/meta/page type; keywords remain suggestions.</span>
            </label>
            <button
              type="submit"
              className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Apply selected metadata option
            </button>
          </form>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Add at least one page to this site to preview metadata suggestions.</p>
        )}
      </section>

      <section
        className={
          nextPanel.kind === "ready"
            ? "mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40"
            : nextPanel.kind === "audit_failed"
              ? "mt-6 rounded-lg border border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40"
              : nextPanel.kind === "audit_warnings"
                ? "mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40"
                : nextPanel.kind === "onboarding"
                  ? "mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40"
                  : nextPanel.kind === "checklist"
                    ? "mt-6 rounded-lg border border-violet-300 bg-violet-50 p-5 dark:border-violet-900 dark:bg-violet-950/40"
                    : "mt-6 rounded-lg border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/60"
        }
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Next action
        </p>
        <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">{nextPanel.headline}</h2>
        {"detail" in nextPanel ? (
          <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{nextPanel.detail}</p>
        ) : null}
        {nextPanel.kind === "audit_failed" || nextPanel.kind === "audit_warnings" ? (
          <p className="mt-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">Check: {nextPanel.checkKey}</p>
        ) : null}
        {nextPanel.kind === "checklist" ? (
          <>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
              {nextPanel.remaining.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {nextPanel.auditGuidance.length > 0 ? (
              <div className="mt-4 border-t border-violet-200 pt-3 dark:border-violet-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  Guidance from latest audit
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  Suggestions for order only — still mark each checklist item yourself.
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
                  {nextPanel.auditGuidance.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section
        id="launch-checklist"
        className="mt-8 scroll-mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Go-live checklist</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Manual confirmations (stored on this site). Not inferred from audits.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Set &amp; Forget rows are one-time baseline setup items. Revisit only when a trigger event occurs.
        </p>
        <ul className="mt-4 space-y-4">
          {launchItems.map((item) => (
            <li
              key={item.key}
              className="flex flex-col gap-2 border-b border-zinc-100 pb-4 last:border-0 last:pb-0 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  {item.category}
                </div>
                <p
                  className={
                    item.done
                      ? "mt-0.5 text-sm text-zinc-500 line-through"
                      : "mt-0.5 text-sm text-zinc-800 dark:text-zinc-200"
                  }
                >
                  {item.label}
                </p>
              </div>
              <form action={setLaunchCheckItemForm} className="shrink-0">
                <input type="hidden" name="siteId" value={site.id} />
                <input type="hidden" name="key" value={item.key} />
                <input type="hidden" name="done" value={item.done ? "false" : "true"} />
                <input type="hidden" name="scrollTo" value="launch-checklist" />
                <button
                  type="submit"
                  className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-600"
                >
                  {item.done ? "Mark not done" : "Mark done"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {homepage ? (
        <section id="open-fix-tasks" className="mt-8 scroll-mt-8">
          <AutoOpenFixTaskFromHash />
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Open fix tasks</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Queued from audits (dedupe key). Same sort as before: now → next → later. Expand a row to work the
            task or use Open to jump and expand.
          </p>
          {openFixTasks.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No open tasks.</p>
          ) : (
            <div className="mt-5 space-y-8">
              {OPEN_FIX_WORKFLOW_ORDER.map((lane) => {
                const items = openFixTasksByWorkflow[lane];
                if (items.length === 0) return null;
                const copy = OPEN_FIX_WORKFLOW_COPY[lane];
                return (
                  <div key={lane}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 pb-1 dark:border-zinc-700">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                        {copy.title}{" "}
                        <span className="font-normal text-zinc-500">({items.length})</span>
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{copy.hint}</p>
                    <div className="mt-3 space-y-2">
                      {items.map((t) => (
                        <details
                          key={t.id}
                          id={`open-fix-task-${t.id}`}
                          className="group rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">{t.title}</span>
                                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                  {t.bucket}
                                </span>
                                <span className="text-xs tabular-nums text-zinc-500">p{t.priorityScore}</span>
                              </div>
                              <p className="mt-0.5 font-mono text-[10px] text-zinc-400">{t.dedupeKey}</p>
                            </div>
                            <FixTaskOpenLink taskId={t.id} />
                          </summary>
                          <div className="border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
                            {t.detail ? (
                              <p className="text-sm text-zinc-700 dark:text-zinc-300">{t.detail}</p>
                            ) : null}
                            <p className="mt-2 font-mono text-xs text-zinc-500">{homepage.url}</p>
                            <form action={completeSiteFixTaskForm} className="mt-3">
                              <input type="hidden" name="taskId" value={t.id} />
                              <input type="hidden" name="siteId" value={site.id} />
                              <input type="hidden" name="scrollTo" value={`open-fix-task:${t.id}`} />
                              <button
                                type="submit"
                                className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
                              >
                                Mark done
                              </button>
                            </form>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {!homepage ? (
        <p className="mt-8 text-sm text-zinc-500">No homepage page is linked to this site.</p>
      ) : !run ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No audit run yet for this homepage.</p>
          <form action={rerunSiteAuditForm}>
            <input type="hidden" name="siteId" value={site.id} />
            <button
              type="submit"
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Run audit
            </button>
          </form>
        </div>
      ) : (
        <>
          <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Audit summary</h2>
              <div className="text-xs text-zinc-500">
                Run {run.id.slice(0, 8)}… · {run.startedAt.toISOString()} ·{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{run.status}</span>
                {run.summary ? (
                  <span className="ml-2 text-zinc-600 dark:text-zinc-400">{formatRunSummary(run.summary)}</span>
                ) : null}
              </div>
            </div>
            <form action={rerunSiteAuditForm} className="mt-4">
              <input type="hidden" name="siteId" value={site.id} />
              <button
                type="submit"
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
              >
                Re-run audit
              </button>
            </form>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Recommended fixes</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Grouped as Immediate / Soon / Later from audit results (deterministic rules).
            </p>
            <div className="mt-4">
              <FixRecommendations grouped={fixGrouped} />
            </div>
          </section>

          <section id="check-results" className="mt-10 scroll-mt-8">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Check results</h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2 font-medium">Check</th>
                    <th className="px-4 py-2 font-medium">Result</th>
                    <th className="px-4 py-2 font-medium">Detail</th>
                    <th className="whitespace-nowrap px-4 py-2 font-medium">Task</th>
                  </tr>
                </thead>
                <tbody>
                  {run.results.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-zinc-500">
                        No check rows (run may have failed before checks were stored).
                      </td>
                    </tr>
                  ) : (
                    run.results.map((r) => {
                      const rec =
                        r.status !== "pass"
                          ? fixRecommendationForRunCheck(runInputs, {
                              checkKey: r.checkKey,
                              status: r.status,
                              message: r.message,
                            })
                          : null;
                      const queued = rec ? openDedupeKeys.has(rec.key) : false;
                      return (
                        <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
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
                          <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{r.message}</td>
                          <td className="px-4 py-2 align-top">
                            {r.status === "pass" ? (
                              <span className="text-xs text-zinc-400">—</span>
                            ) : queued ? (
                              <span className="text-xs text-zinc-500">On queue</span>
                            ) : (
                              <form action={createFixTaskFromCheckForm}>
                                <input type="hidden" name="siteId" value={site.id} />
                                <input type="hidden" name="checkResultId" value={r.id} />
                                <input type="hidden" name="scrollTo" value="check-results" />
                                <button
                                  type="submit"
                                  className="whitespace-nowrap rounded border border-zinc-300 px-2 py-1 text-xs font-medium dark:border-zinc-600"
                                >
                                  Add task
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
