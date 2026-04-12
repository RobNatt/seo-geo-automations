import type { ContentQueueItem, Page } from "@prisma/client";

import { prisma } from "@/lib/db";
import { CONTENT_QUEUE_STATUS } from "@/lib/sites/content-queue";
import {
  buildContentOpportunityBrief,
  type ContentOpportunityBrief,
  type ContentOpportunityBriefInput,
  parseClusterOpportunityKey,
} from "@/lib/sites/content-opportunity-brief";
import { parseClusterPrompts } from "@/lib/sites/prompt-clusters";

export type SiteWriterBriefRow = {
  queueItemId: string;
  opportunityKey: string;
  brief: ContentOpportunityBrief;
};

type QueueItemWithPage = ContentQueueItem & {
  page: Pick<Page, "url" | "title"> | null;
};

/** Deterministic brief for one queue row (shared with writer briefs and draft pipeline). */
export async function loadBriefForContentQueueItem(
  siteId: string,
  item: QueueItemWithPage,
): Promise<ContentOpportunityBrief> {
  const clusterKey = parseClusterOpportunityKey(item.opportunityKey);
  let cluster: ContentOpportunityBriefInput["cluster"] | undefined;
  if (clusterKey) {
    const row = await prisma.promptCluster.findFirst({
      where: { siteId, key: clusterKey },
      include: {
        pages: { orderBy: { url: "asc" }, select: { url: true, title: true } },
      },
    });
    if (row) {
      cluster = {
        title: row.title,
        prompts: parseClusterPrompts(row.prompts),
        targetPages: row.pages.map((p) => ({ url: p.url, title: p.title })),
      };
    }
  }

  return buildContentOpportunityBrief({
    opportunityKey: item.opportunityKey,
    queueTitle: item.title,
    queueDetail: item.detail,
    queuePage: item.page ? { url: item.page.url, title: item.page.title } : null,
    cluster,
  });
}

/** Open queue items with deterministic writer briefs (target, title line, intent line). */
export async function loadWriterBriefsForSite(siteId: string): Promise<SiteWriterBriefRow[]> {
  const items = await prisma.contentQueueItem.findMany({
    where: {
      siteId,
      status: { in: [CONTENT_QUEUE_STATUS.QUEUED, CONTENT_QUEUE_STATUS.IN_PROGRESS] },
    },
    orderBy: [{ priority: "desc" }, { opportunityKey: "asc" }],
    include: { page: { select: { url: true, title: true } } },
  });

  const out: SiteWriterBriefRow[] = [];

  for (const item of items) {
    const brief = await loadBriefForContentQueueItem(siteId, item);
    out.push({ queueItemId: item.id, opportunityKey: item.opportunityKey, brief });
  }

  return out;
}
