import { shortOpportunityRecommendation, type RankedContentGap } from "@/lib/sites/content-gap-rank";
import { clampContentQueuePriority, type ContentQueueCategory } from "@/lib/sites/content-queue";
import { partitionRankedOpportunitiesByKind } from "@/lib/sites/content-opportunity-kind";
import type { RuleBasedContentOpportunity } from "@/lib/sites/content-opportunity-rules";

/** Max rows per planner column (clusters + rules), deterministic trim. */
export const CONTENT_PLANNER_MAX_PER_COLUMN = 12;

export type ContentPlannerRow = {
  opportunityKey: string;
  queueCategory: ContentQueueCategory;
  headline: string;
  summaryReason: string;
  priority: number;
  detail: string | null;
  targetPageId: string | null;
};

export type ContentPlannerColumns = {
  service: ContentPlannerRow[];
  faq: ContentPlannerRow[];
  supporting: ContentPlannerRow[];
};

function clusterPlannerRow(r: RankedContentGap, queueCategory: ContentQueueCategory): ContentPlannerRow {
  const firstPage = r.row.targetPages[0];
  return {
    opportunityKey: `cluster:${r.clusterKey}`,
    queueCategory,
    headline: r.clusterTitle,
    summaryReason: shortOpportunityRecommendation(r),
    priority: clampContentQueuePriority(50 + Math.round(r.compositePriority / 4)),
    detail: r.row.prompts.length > 0 ? r.row.prompts.slice(0, 5).join("\n") : null,
    targetPageId: firstPage?.id ?? null,
  };
}

function rulePlannerRow(f: RuleBasedContentOpportunity): ContentPlannerRow {
  const queueCategory: ContentQueueCategory =
    f.category === "service"
      ? "service"
      : f.category === "faq"
        ? "faq"
        : f.category === "geo"
          ? "geo"
          : "snippet";
  const summary = f.reasons[0]?.trim() || f.detail.slice(0, 140);
  return {
    opportunityKey: f.key,
    queueCategory,
    headline: f.title,
    summaryReason: summary.length > 140 ? `${summary.slice(0, 137)}…` : summary,
    priority: 55,
    detail: f.detail,
    targetPageId: null,
  };
}

function rulePlannerColumn(f: RuleBasedContentOpportunity): keyof ContentPlannerColumns {
  if (f.category === "service") return "service";
  if (f.category === "faq") return "faq";
  return "supporting";
}

/**
 * Build planner columns: ranked clusters first (highest composite first per partition), then rule hits (key order).
 */
export function buildContentPlannerColumns(
  rankedClusters: RankedContentGap[],
  ruleFindings: RuleBasedContentOpportunity[],
): ContentPlannerColumns {
  const p = partitionRankedOpportunitiesByKind(rankedClusters);

  const service: ContentPlannerRow[] = [
    ...p.service.map((r) => clusterPlannerRow(r, "service")),
    ...ruleFindings
      .filter((f) => rulePlannerColumn(f) === "service")
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(rulePlannerRow),
  ];

  const faq: ContentPlannerRow[] = [
    ...p.faq.map((r) => clusterPlannerRow(r, "faq")),
    ...ruleFindings
      .filter((f) => rulePlannerColumn(f) === "faq")
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(rulePlannerRow),
  ];

  const supporting: ContentPlannerRow[] = [
    ...p.blog.map((r) => clusterPlannerRow(r, "supporting")),
    ...p.other.map((r) => clusterPlannerRow(r, "supporting")),
    ...ruleFindings
      .filter((f) => rulePlannerColumn(f) === "supporting")
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(rulePlannerRow),
  ];

  const max = CONTENT_PLANNER_MAX_PER_COLUMN;
  return {
    service: service.slice(0, max),
    faq: faq.slice(0, max),
    supporting: supporting.slice(0, max),
  };
}
