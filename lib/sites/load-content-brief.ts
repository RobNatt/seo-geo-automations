import type { ContentQueueItem, Page, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  buildContentBriefSeedFromOpportunity,
  parsePrimaryPointsJson,
  parseRepurposingTargetsJson,
  type ContentBriefView,
} from "@/lib/sites/content-brief";
import { parseClusterOpportunityKey } from "@/lib/sites/content-opportunity-brief";
import { loadBriefForContentQueueItem } from "@/lib/sites/load-content-opportunity-briefs";
import { parseClusterPrompts } from "@/lib/sites/prompt-clusters";

type QueueItemWithPage = ContentQueueItem & {
  page: Pick<Page, "url" | "title"> | null;
};

function jsonForPrisma(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function loadClusterPromptLinesForOpportunity(
  siteId: string,
  opportunityKey: string,
): Promise<string[]> {
  const clusterKey = parseClusterOpportunityKey(opportunityKey);
  if (!clusterKey) return [];
  const row = await prisma.promptCluster.findFirst({
    where: { siteId, key: clusterKey },
    select: { prompts: true },
  });
  if (!row) return [];
  return parseClusterPrompts(row.prompts).map((p) => p.trim()).filter(Boolean);
}

export function contentBriefRowToView(
  row: {
    id: string;
    pageId: string | null;
    topic: string;
    intent: string;
    audience: string;
    primaryPoints: unknown;
    repurposingTargets: unknown;
    page: Pick<Page, "url" | "title"> | null;
  },
): ContentBriefView {
  return {
    id: row.id,
    pageId: row.pageId,
    targetPageUrl: row.page?.url ?? null,
    targetPageTitle: row.page?.title ?? null,
    topic: row.topic,
    intent: row.intent,
    audience: row.audience,
    primaryPoints: parsePrimaryPointsJson(row.primaryPoints),
    repurposingTargets: parseRepurposingTargetsJson(row.repurposingTargets),
  };
}

/**
 * Ensures a ContentBrief row exists for this queue item (idempotent).
 * Seeds are deterministic from opportunity rules + cluster prompts.
 */
export async function ensureContentBriefForQueueItem(
  siteId: string,
  item: QueueItemWithPage,
): Promise<ContentBriefView> {
  const existing = await prisma.contentBrief.findUnique({
    where: { contentQueueItemId: item.id },
    include: { page: { select: { url: true, title: true } } },
  });
  if (existing) {
    return contentBriefRowToView(existing);
  }

  const writerBrief = await loadBriefForContentQueueItem(siteId, item);
  const promptLines = await loadClusterPromptLinesForOpportunity(siteId, item.opportunityKey);
  const seed = buildContentBriefSeedFromOpportunity(
    writerBrief,
    item.category,
    item.pageId,
    promptLines,
  );

  const created = await prisma.contentBrief.create({
    data: {
      siteId,
      contentQueueItemId: item.id,
      pageId: seed.pageId,
      topic: seed.topic,
      intent: seed.intent,
      audience: seed.audience,
      primaryPoints: jsonForPrisma(seed.primaryPoints),
      repurposingTargets: jsonForPrisma(seed.repurposingTargets),
    },
    include: { page: { select: { url: true, title: true } } },
  });

  return contentBriefRowToView(created);
}
