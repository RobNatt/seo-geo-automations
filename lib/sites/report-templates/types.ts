import type { LaunchBlocker } from "@/lib/sites/launch-blockers";
import type { LaunchReadinessSummary } from "@/lib/sites/launch-readiness-rules";
import type { GrowthOpportunity } from "@/lib/sites/content-pipeline";
import type { RankedContentGap } from "@/lib/sites/content-gap-rank";
import type { ContentRefreshCandidate } from "@/lib/sites/content-refresh-rank";

export type { ReportTemplateId } from "./constants";

export type SiteReportMonthWindow = {
  start: Date;
  end: Date;
  labelLong: string;
  labelShort: string;
};

/** Single load of site facts; all templates read from this shape only (no extra queries in renderers). */
export type SiteReportSnapshot = {
  generatedAt: Date;
  month: SiteReportMonthWindow;
  site: {
    businessName: string;
    rootUrl: string;
    geoHint: string | null;
    primaryFocus: string | null;
    onboardingStage: string;
  };
  homepageUrl: string | null;
  readiness: LaunchReadinessSummary;
  launchChecklistItems: { label: string; done: boolean; category: string }[];
  latestAudit: {
    status: string;
    summaryRaw: string | null;
    startedAt: Date | null;
    failCount: number;
    warnCount: number;
  } | null;
  openFixTasks: { title: string; detail: string | null; bucket: string; priorityScore: number }[];
  launchBlockers: LaunchBlocker[];
  doneFixesThisMonth: { title: string }[];
  performance: {
    rowCount: number;
    totalImp: number;
    totalClk: number;
    topPages: { url: string; imp: number; clk: number }[];
  };
  lighthouse: {
    performanceScore: number | null;
    accessibilityScore: number | null;
    bestPracticesScore: number | null;
    seoScore: number | null;
    lastAudited: Date | null;
  };
  maintenance: {
    activeCount: number;
    thisMonthCount: number;
  };
  growth: {
    pendingCount: number;
    doneThisMonthCount: number;
  };
  contentOpportunities: {
    openCount: number;
    doneThisMonthCount: number;
  };
  partnerships: {
    doneCount: number;
    inProgressCount: number;
    notStartedCount: number;
    activityThisMonthCount: number;
  };
  refreshHigh: { url: string; reasonLine: string }[];
  growthOpportunities: GrowthOpportunity[];
  rankedContentGaps: RankedContentGap[];
  refreshCandidates: ContentRefreshCandidate[];
};
