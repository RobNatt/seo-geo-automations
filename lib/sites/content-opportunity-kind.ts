import type { RankedContentGap } from "@/lib/sites/content-gap-rank";

/**
 * Buckets for the site content-opportunity panel. Deterministic: use cluster key prefix
 * before the first underscore, e.g. `service_plumbing`, `faq_pricing`, `blog_guides`.
 */
export type ContentOpportunityKind = "service" | "faq" | "blog";

export function classifyPromptClusterKind(
  clusterKey: string,
): ContentOpportunityKind | "other" {
  const head = clusterKey.toLowerCase().split("_")[0] ?? "";
  if (head === "faq" || head === "faqs") return "faq";
  if (head === "blog") return "blog";
  if (head === "service" || head === "services" || head === "svc") return "service";
  return "other";
}

export type PartitionedRankedOpportunities = Record<ContentOpportunityKind, RankedContentGap[]> & {
  other: RankedContentGap[];
};

/** Preserves global rank order within each bucket. */
export function partitionRankedOpportunitiesByKind(
  ranked: RankedContentGap[],
): PartitionedRankedOpportunities {
  const out: PartitionedRankedOpportunities = {
    service: [],
    faq: [],
    blog: [],
    other: [],
  };
  for (const r of ranked) {
    const k = classifyPromptClusterKind(r.clusterKey);
    out[k].push(r);
  }
  return out;
}
