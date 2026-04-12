import { prisma } from "@/lib/db";
import { CONTENT_QUEUE_STATUS } from "@/lib/sites/content-queue";
import {
  buildReviewChecklist,
  draftScaffold,
  normalizePipelineStage,
  parsePipelineArtifacts,
  repurposeGuidance,
  runSanitize,
  type DraftPipelineContext,
  type PipelineArtifactsV1,
  type PipelineStage,
  type ReviewChecklistItem,
} from "@/lib/sites/content-draft-pipeline";
import { contentBriefViewToOpportunityBrief, type ContentBriefView } from "@/lib/sites/content-brief";
import {
  runDraftWorkspaceQa,
  type DraftWorkspaceQaItem,
} from "@/lib/sites/draft-workspace-qa";
import {
  buildRepurposeBlocksFromDraft,
  formatRepurposePackPlain,
  type RepurposeBlocks,
} from "@/lib/sites/repurpose-from-draft";
import { ensureContentBriefForQueueItem } from "@/lib/sites/load-content-brief";
import type { ContentOpportunityBrief } from "@/lib/sites/content-opportunity-brief";
import {
  buildPublishReadyChecklistItems,
  type PublishReadyChecklistItem,
} from "@/lib/sites/publish-ready-checklist";

export type ContentDraftPipelinePageState = {
  siteId: string;
  siteName: string;
  queueItemId: string;
  opportunityKey: string;
  queueTitle: string;
  queueStatus: string;
  pipelineStage: PipelineStage | null;
  artifacts: PipelineArtifactsV1;
  /** Canonical stored brief (topic, intent, audience, points, repurposing). */
  contentBrief: ContentBriefView;
  /** Derived for scaffolds / legacy checks — same topic/intent/page as `contentBrief`. */
  brief: ContentOpportunityBrief;
  ctx: DraftPipelineContext;
  checklist: ReviewChecklistItem[];
  guidance: ReturnType<typeof repurposeGuidance>;
  scaffold: ReturnType<typeof draftScaffold>;
  sanitize: ReturnType<typeof runSanitize>;
  /** Rule-based drafting QA (SEO body + brief); refreshed on each load after save. */
  draftWorkspaceQa: DraftWorkspaceQaItem[];
  /** Deterministic repurposing shells from brief + drafts. */
  repurposeBlocks: RepurposeBlocks;
  repurposePackPlain: string;
  publishReadyChecklist: PublishReadyChecklistItem[];
};

export async function loadContentDraftPipelinePageState(
  siteId: string,
  queueItemId: string,
): Promise<ContentDraftPipelinePageState | null> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, businessName: true },
  });
  if (!site) return null;

  const item = await prisma.contentQueueItem.findFirst({
    where: { id: queueItemId, siteId },
    include: { page: { select: { url: true, title: true } } },
  });
  if (!item) return null;

  const contentBrief = await ensureContentBriefForQueueItem(siteId, item);
  const brief = contentBriefViewToOpportunityBrief(contentBrief, item.opportunityKey);
  const artifacts = parsePipelineArtifacts(item.pipelineArtifacts);
  const stage = normalizePipelineStage(item.pipelineStage);
  const ctx: DraftPipelineContext = {
    opportunityKey: item.opportunityKey,
    category: item.category,
  };
  const checklist = buildReviewChecklist(ctx);
  const guidance = repurposeGuidance(ctx);
  const scaffold = draftScaffold(brief, ctx);
  const sanitize = runSanitize(artifacts, ctx);
  const draftWorkspaceQa = runDraftWorkspaceQa({
    seoBody: artifacts.seoBody,
    geoNotes: artifacts.geoNotes,
    linkedinPost: artifacts.linkedinPost,
    contentBrief,
    category: item.category,
    opportunityKey: item.opportunityKey,
  });

  const repurposeBlocks = buildRepurposeBlocksFromDraft({
    contentBrief,
    seoBody: artifacts.seoBody,
    geoNotes: artifacts.geoNotes,
    linkedinPost: artifacts.linkedinPost,
  });
  const repurposePackPlain = formatRepurposePackPlain(repurposeBlocks, artifacts.linkedinPost);

  const publishReadyChecklist = buildPublishReadyChecklistItems({
    contentBrief,
    seoBody: artifacts.seoBody,
    category: item.category,
    opportunityKey: item.opportunityKey,
  });

  return {
    siteId: site.id,
    siteName: site.businessName,
    queueItemId: item.id,
    opportunityKey: item.opportunityKey,
    queueTitle: item.title,
    queueStatus: item.status,
    pipelineStage: stage,
    artifacts,
    contentBrief,
    brief,
    ctx,
    checklist,
    guidance,
    scaffold,
    sanitize,
    draftWorkspaceQa,
    repurposeBlocks,
    repurposePackPlain,
    publishReadyChecklist,
  };
}

/** True when the queue row may use the drafting pipeline (open work only). */
export function contentQueueItemAllowsPipeline(status: string): boolean {
  return status === CONTENT_QUEUE_STATUS.QUEUED || status === CONTENT_QUEUE_STATUS.IN_PROGRESS;
}
