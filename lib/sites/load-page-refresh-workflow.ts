import { prisma } from "@/lib/db";
import { loadContentPerformanceDashboard } from "@/lib/sites/load-content-performance-dashboard";
import { mergeStoredPageRefreshChecklist } from "@/lib/sites/page-refresh-checklist";
import type { ContentRefreshCandidate } from "@/lib/sites/content-refresh-rank";

const SNAPSHOT_ROWS = 8;

export type PageRefreshWorkflowData = {
  site: { id: string; businessName: string; rootUrl: string };
  page: {
    id: string;
    url: string;
    title: string | null;
    status: string;
    serviceName: string | null;
    updatedAt: Date;
  };
  performanceRows: {
    periodStart: string;
    periodEnd: string;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    engagedSessions: number | null;
    conversions: number | null;
    source: string;
  }[];
  refreshCandidate: ContentRefreshCandidate | null;
  queueItem: {
    status: string;
    reason: string;
    priority: number;
  } | null;
  checklist: Record<string, boolean>;
};

function ctrFromRow(
  impressions: number | null,
  clicks: number | null,
  ctr: number | null,
): number | null {
  if (ctr != null) return ctr;
  if (impressions != null && impressions > 0 && clicks != null) {
    return Math.round((clicks / impressions) * 1e6) / 1e6;
  }
  return null;
}

export async function loadPageRefreshWorkflow(
  siteId: string,
  pageId: string,
): Promise<PageRefreshWorkflowData | null> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, siteId },
    include: {
      site: { select: { id: true, businessName: true, rootUrl: true } },
      service: { select: { name: true } },
      contentRefreshQueueItem: { select: { status: true, reason: true, priority: true } },
      pageRefreshWorkflow: { select: { checklist: true } },
    },
  });

  if (!page?.site) return null;

  const snapshots = await prisma.contentPerformanceSnapshot.findMany({
    where: { siteId, pageId },
    orderBy: { periodEnd: "desc" },
    take: SNAPSHOT_ROWS,
  });

  const dashboard = await loadContentPerformanceDashboard(siteId);
  const refreshCandidate =
    dashboard?.refreshCandidates.find((c) => c.pageId === pageId) ?? null;

  const performanceRows = snapshots.map((s) => ({
    periodStart: s.periodStart.toISOString().slice(0, 10),
    periodEnd: s.periodEnd.toISOString().slice(0, 10),
    impressions: s.impressions,
    clicks: s.clicks,
    ctr: ctrFromRow(s.impressions, s.clicks, s.ctr),
    engagedSessions: s.engagedSessions,
    conversions: s.conversions,
    source: s.source,
  }));

  let storedChecklist: unknown = {};
  try {
    storedChecklist = JSON.parse(page.pageRefreshWorkflow?.checklist ?? "{}") as unknown;
  } catch {
    storedChecklist = {};
  }
  const checklist = mergeStoredPageRefreshChecklist(storedChecklist);

  return {
    site: page.site,
    page: {
      id: page.id,
      url: page.url,
      title: page.title,
      status: page.status,
      serviceName: page.service?.name ?? null,
      updatedAt: page.updatedAt,
    },
    performanceRows,
    refreshCandidate,
    queueItem: page.contentRefreshQueueItem,
    checklist,
  };
}
