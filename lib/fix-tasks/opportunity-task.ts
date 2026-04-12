import type { FixBucket } from "@/lib/audits/fix-plan";

/** Manual tasks created from content opportunities (prompt clusters). */
export type OpportunityTaskKind = "fix" | "content";

/** Stable per-site dedupe: one open row per (site, kind, cluster key). */
export function opportunityTaskDedupeKey(clusterKey: string, kind: OpportunityTaskKind): string {
  return `opp:${kind}:${clusterKey}`;
}

export function tryParseOpportunityTaskDedupe(
  dedupeKey: string,
): { kind: OpportunityTaskKind; clusterKey: string } | null {
  if (!dedupeKey.startsWith("opp:")) return null;
  const rest = dedupeKey.slice(4);
  const i = rest.indexOf(":");
  if (i <= 0) return null;
  const kind = rest.slice(0, i);
  if (kind !== "fix" && kind !== "content") return null;
  const clusterKey = rest.slice(i + 1);
  if (!clusterKey) return null;
  return { kind: kind as OpportunityTaskKind, clusterKey };
}

export function opportunityTaskBucket(kind: OpportunityTaskKind): FixBucket {
  return kind === "fix" ? "soon" : "later";
}

/** Map gap priority into the same numeric scale used for ordering within a bucket. */
export function opportunityTaskPriorityScore(compositePriority: number): number {
  return Math.max(10, Math.min(95, Math.round(55 + compositePriority / 4)));
}
