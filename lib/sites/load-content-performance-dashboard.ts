import { prisma } from "@/lib/db";
import {
  buildPageUrlLookup,
} from "@/lib/sites/content-performance-url";
import {
  buildContentPerformanceInsights,
  type ContentPerformanceInsightRow,
} from "@/lib/sites/content-performance-insights";
import {
  rankPagesForContentRefresh,
  type ContentRefreshCandidate,
  type PerformanceSnapshotInput,
} from "@/lib/sites/content-refresh-rank";

const LOOKBACK_DAYS = 120;

export type { ContentPerformanceInsightRow };

export type ContentPerformanceDashboard = {
  snapshotCount: number;
  latestImportHint: string | null;
  refreshCandidates: ContentRefreshCandidate[];
  topPerforming: ContentPerformanceInsightRow[];
  declining: ContentPerformanceInsightRow[];
  needingRefresh: ContentPerformanceInsightRow[];
  recentSnapshots: {
    pageUrl: string;
    pageTitle: string | null;
    periodStart: string;
    periodEnd: string;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    source: string;
  }[];
};

export async function loadContentPerformanceDashboard(siteId: string): Promise<ContentPerformanceDashboard | null> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, rootUrl: true },
  });
  if (!site) return null;

  const pages = await prisma.page.findMany({
    where: { siteId },
    select: { id: true, url: true, title: true },
    orderBy: { url: "asc" },
  });

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - LOOKBACK_DAYS);

  const snapshots = await prisma.contentPerformanceSnapshot.findMany({
    where: { siteId, periodEnd: { gte: cutoff } },
    orderBy: [{ periodEnd: "desc" }, { pageId: "asc" }],
  });

  const queueRows = await prisma.contentQueueItem.findMany({
    where: { siteId, pageId: { not: null } },
    select: { pageId: true, opportunityKey: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const opportunityByPageId: Record<string, string> = {};
  for (const r of queueRows) {
    if (!r.pageId) continue;
    if (opportunityByPageId[r.pageId]) continue;
    opportunityByPageId[r.pageId] = r.opportunityKey;
  }

  const clusterLinks = await prisma.promptCluster.findMany({
    where: { siteId },
    select: {
      key: true,
      pages: { where: { siteId }, select: { id: true } },
    },
  });
  const clusterByPageId: Record<string, string> = {};
  for (const c of clusterLinks) {
    for (const pg of c.pages) {
      if (clusterByPageId[pg.id]) {
        if (c.key.localeCompare(clusterByPageId[pg.id]!) < 0) {
          clusterByPageId[pg.id] = c.key;
        }
      } else {
        clusterByPageId[pg.id] = c.key;
      }
    }
  }

  const snapInput: PerformanceSnapshotInput[] = snapshots.map((s) => ({
    pageId: s.pageId,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    impressions: s.impressions,
    clicks: s.clicks,
    ctr: s.ctr,
    engagedSessions: s.engagedSessions,
    conversions: s.conversions,
  }));

  const refreshCandidates = rankPagesForContentRefresh({
    pages,
    snapshots: snapInput,
    opportunityByPageId,
    clusterByPageId,
  });

  const { topPerforming, declining, needingRefresh } = buildContentPerformanceInsights({
    pages,
    snapshots: snapInput,
    refreshCandidates,
  });

  const recentSnapshots = snapshots.slice(0, 12).map((s) => {
    const page = pages.find((p) => p.id === s.pageId);
    return {
      pageUrl: page?.url ?? s.pageId,
      pageTitle: page?.title ?? null,
      periodStart: s.periodStart.toISOString().slice(0, 10),
      periodEnd: s.periodEnd.toISOString().slice(0, 10),
      impressions: s.impressions,
      clicks: s.clicks,
      ctr:
        s.ctr != null ?
          s.ctr
        : s.impressions != null && s.impressions > 0 && s.clicks != null ?
          Math.round((s.clicks / s.impressions) * 1e6) / 1e6
        : null,
      source: s.source,
    };
  });

  const latest = snapshots[0];
  const latestImportHint =
    latest ?
      `Latest row: ${latest.periodEnd.toISOString().slice(0, 10)} · ${pages.find((p) => p.id === latest.pageId)?.url ?? latest.pageId}`
    : null;

  return {
    snapshotCount: snapshots.length,
    latestImportHint,
    refreshCandidates,
    topPerforming,
    declining,
    needingRefresh,
    recentSnapshots,
  };
}

export { buildPageUrlLookup };
