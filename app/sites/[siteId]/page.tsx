import type { SiteFixTask } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setLaunchCheckItemForm } from "@/app/actions/launch-checklist";
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
import { readinessSummaryStateBadgeClass } from "@/lib/sites/readiness-display";
import { collectLaunchBlockers } from "@/lib/sites/launch-blockers";
import {
  buildNextBestAction,
  nextBestActionModeLabel,
} from "@/lib/sites/next-best-action";
import { buildNextActionPanel } from "@/lib/sites/next-action-panel";
import {
  SITE_STAGE_LABEL,
  isSiteOnboardingStage,
} from "@/lib/sites/onboarding-stage";
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

export const dynamic = "force-dynamic";

/** Vercel Pro+: raises the default ~10s cap so this data-heavy page can finish. Hobby tier still caps at 10s. */
export const maxDuration = 60;

export default async function SiteSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ runId?: string; msg?: string; wl?: string; full?: string }>;
}) {
  const { siteId } = await params;
  const { runId: runIdParam, msg, wl, full } = await searchParams;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });
  if (!site) notFound();

  await ensureLaunchChecklistForSite(site.id);
  const [launchRows, homepage] = await Promise.all([
    prisma.siteLaunchCheckItem.findMany({
      where: { siteId: site.id },
    }),
    prisma.page.findFirst({
      where: { siteId: site.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const launchItems = mergeLaunchChecklistRows(launchRows);
  const launchDone = launchItems.filter((i) => i.done).length;
  const launchTotal = LAUNCH_CHECKLIST_DEF.length;
  const launchPct = launchTotal ? Math.round((launchDone / launchTotal) * 100) : 0;

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
  const openFixTaskCount = openFixTasks.length;
  const readinessSummary = evaluateLaunchReadinessSummary({
    hasHomepage: Boolean(homepage),
    latestRunStatus: latestRun?.status ?? null,
    onboardingStage: site.onboardingStage,
    checkFailCount: latestCounts.fail,
    checkWarnCount: latestCounts.warn,
    summaryHasError: latestCounts.hasError,
    launchDone,
    launchExpected: launchTotal,
    openFixTaskCount,
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
    auditResults:
      latestRun?.results?.map((r) => ({ checkKey: r.checkKey, status: r.status })) ?? [],
    checklistUndone: launchItems.filter((i) => !i.done).map((i) => ({ key: i.key, label: i.label })),
    openFixTasks: openFixTasks.map((t) => ({ dedupeKey: t.dedupeKey, title: t.title })),
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
      }
    : null;

  if (isWhiteLabelSiteSummaryMode({ wl, full })) {
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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Suspense fallback={null}>
        <PostActionScrollFocus variant="site" />
      </Suspense>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{site.businessName}</h1>
          <p className="mt-1 font-mono text-sm text-zinc-600 dark:text-zinc-400">{site.rootUrl}</p>
          {site.geoHint ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              GEO: {site.geoHint}
            </p>
          ) : null}
          {site.primaryFocus ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Focus: {site.primaryFocus}
            </p>
          ) : null}
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
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Launch readiness summary
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium ${readinessSummaryStateBadgeClass(readinessSummary.state)}`}
          >
            {readinessSummary.stateLabel}
          </span>
        </div>
        <p className="mt-2 text-sm leading-snug text-zinc-800 dark:text-zinc-200">
          {readinessSummary.nextStep}
        </p>
        <div className="mt-3 rounded-md border border-zinc-200 bg-white/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Recommended focus
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {readinessRecommended.headline}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-400">
            {readinessRecommended.detail}
          </p>
        </div>
        <ul className="mt-3 space-y-1.5 border-t border-zinc-200 pt-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          <li>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Onboarding:</span>{" "}
            {isSiteOnboardingStage(site.onboardingStage)
              ? SITE_STAGE_LABEL[site.onboardingStage]
              : site.onboardingStage}
          </li>
          <li>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Latest audit:</span>{" "}
            {latestRun
              ? `${latestRun.status}${latestRun.summary ? ` · ${formatRunSummary(latestRun.summary)}` : ""}`
              : "No run yet"}
          </li>
          <li>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Launch checklist:</span>{" "}
            {launchDone}/{launchTotal} complete ({launchPct}%)
          </li>
          <li>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Open fix tasks:</span>{" "}
            {openFixTaskCount === 0 ? "None" : `${openFixTaskCount} open`}
          </li>
        </ul>
      </section>

      {reportTemplateTexts ? <ReportTemplatesExportSection texts={reportTemplateTexts} /> : null}

      <div className="mt-6">
        <LaunchBlockersSection blockers={launchBlockers} />
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
