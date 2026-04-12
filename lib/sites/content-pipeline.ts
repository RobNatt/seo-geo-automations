import { GEO_AREA_NOTE_VISIBLE_CHECK_KEY } from "@/lib/audits/checks";
import type { RankedContentGap } from "@/lib/sites/content-gap-rank";
import { classifyPromptClusterKind } from "@/lib/sites/content-opportunity-kind";

/**
 * Unified growth backlog: homepage audit gaps + ranked prompt clusters.
 * Scores are 0–100; composite = impact + confidence − effort (deterministic, no AI).
 */

export type GrowthOpportunitySegment = "service" | "faq" | "supporting" | "onpage";

export type GrowthOpportunitySource = "audit" | "prompt_cluster";

export type GrowthOpportunity = {
  stableId: string;
  source: GrowthOpportunitySource;
  segment: GrowthOpportunitySegment;
  headline: string;
  shortDetail: string;
  impactScore: number;
  confidenceScore: number;
  effortScore: number;
  composite: number;
  reasons: string[];
  summaryReason: string;
  checkResultId?: string;
  clusterKey?: string;
};

export type AuditResultRowInput = {
  id: string;
  checkKey: string;
  status: string;
  message: string | null;
};

export type BuildSiteGrowthOpportunitiesInput = {
  /** Homepage (or primary audited page) id for stable audit ids. */
  homepagePageId: string | null;
  auditResults: AuditResultRowInput[];
  rankedClusters: RankedContentGap[];
};

const PIPELINE_INCLUDE_CHECKS = new Set<string>([
  "url_resolvable",
  "title_present",
  "meta_description_present",
  GEO_AREA_NOTE_VISIBLE_CHECK_KEY,
]);

export const GROWTH_PIPELINE_DEFAULT_LIMIT = 20;

export function segmentLabel(s: GrowthOpportunitySegment): string {
  switch (s) {
    case "service":
      return "Service";
    case "faq":
      return "FAQ";
    case "supporting":
      return "Supporting";
    case "onpage":
      return "On-page / GEO";
    default:
      return s;
  }
}

function clusterToSegment(clusterKey: string): GrowthOpportunitySegment {
  const k = classifyPromptClusterKind(clusterKey);
  if (k === "service") return "service";
  if (k === "faq") return "faq";
  return "supporting";
}

function auditHeadlineAndScores(row: AuditResultRowInput): {
  headline: string;
  impactScore: number;
  confidenceScore: number;
  effortScore: number;
  reasons: string[];
} | null {
  const { checkKey, status } = row;
  const isFail = status === "fail" || status === "error";
  const isWarn = status === "warn";
  const isSkipped = status === "skipped";

  if (checkKey === GEO_AREA_NOTE_VISIBLE_CHECK_KEY) {
    if (!isWarn) return null;
    return {
      headline: "Clarify service area in visible copy",
      impactScore: 68,
      confidenceScore: 82,
      effortScore: 34,
      reasons: [
        "Impact 68: GEO visibility affects local and LLM surfacing.",
        "Confidence 82: onboarding GEO note missing from visible text (deterministic substring check).",
        "Effort 34: copy/layout updates on key templates.",
      ],
    };
  }

  if (checkKey === "url_resolvable") {
    if (!isFail) return null;
    return {
      headline: "Restore homepage availability",
      impactScore: 98,
      confidenceScore: 96,
      effortScore: 72,
      reasons: [
        "Impact 98: page unreachable — search and users cannot access content.",
        "Confidence 96: fetch failed in the latest audit run.",
        "Effort 72: may need DNS, TLS, hosting, or edge fixes.",
      ],
    };
  }

  if (checkKey === "title_present") {
    if (isFail) {
      return {
        headline: "Add a strong page title",
        impactScore: 88,
        confidenceScore: 92,
        effortScore: 16,
        reasons: [
          "Impact 88: title is a primary SEO and SERP signal.",
          "Confidence 92: empty or missing <title> detected.",
          "Effort 16: usually a quick template or CMS edit.",
        ],
      };
    }
    if (isSkipped) {
      return {
        headline: "Unblock title evaluation",
        impactScore: 74,
        confidenceScore: 52,
        effortScore: 46,
        reasons: [
          "Impact 74: title not evaluated because HTML was unavailable.",
          "Confidence 52: indirect signal until fetch succeeds.",
          "Effort 46: fix fetch/HTML first, then re-audit.",
        ],
      };
    }
    return null;
  }

  if (checkKey === "meta_description_present") {
    if (isFail) {
      return {
        headline: "Add a meta description",
        impactScore: 78,
        confidenceScore: 88,
        effortScore: 20,
        reasons: [
          "Impact 78: snippet controls CTR and query relevance.",
          "Confidence 88: meta description missing.",
          "Effort 20: short CMS or markup change.",
        ],
      };
    }
    if (isWarn) {
      return {
        headline: "Tune meta description length",
        impactScore: 56,
        confidenceScore: 72,
        effortScore: 26,
        reasons: [
          "Impact 56: length outside ideal band affects snippet quality.",
          "Confidence 72: description present but flagged (length).",
          "Effort 26: rewrite to fit recommended character range.",
        ],
      };
    }
    return null;
  }

  return null;
}

function buildAuditOpportunities(
  homepagePageId: string | null,
  rows: AuditResultRowInput[],
): GrowthOpportunity[] {
  const out: GrowthOpportunity[] = [];
  const pagePart = homepagePageId ?? "unknown";
  for (const row of rows) {
    if (!PIPELINE_INCLUDE_CHECKS.has(row.checkKey)) continue;
    const spec = auditHeadlineAndScores(row);
    if (!spec) continue;
    const { headline, impactScore, confidenceScore, effortScore, reasons } = spec;
    const composite = impactScore + confidenceScore - effortScore;
    const shortDetail =
      row.message?.trim() ||
      (row.checkKey === "url_resolvable"
        ? "Homepage request did not return usable HTML."
        : "See latest audit run for this check.");
    out.push({
      stableId: `audit:${pagePart}:${row.checkKey}:${row.status}:${row.id}`,
      source: "audit",
      segment: "onpage",
      headline,
      shortDetail,
      impactScore,
      confidenceScore,
      effortScore,
      composite,
      reasons,
      summaryReason: reasons[0] ?? headline,
      checkResultId: row.id,
    });
  }
  return out;
}

function buildClusterOpportunities(ranked: RankedContentGap[]): GrowthOpportunity[] {
  return ranked.map((r) => {
    const impactScore = Math.min(
      100,
      Math.round(0.45 * r.businessImpact.score + 0.55 * r.searchValue.score),
    );
    const confidenceScore = Math.min(
      100,
      Math.round(
        18 +
          (r.row.targetPages.length > 0 ? 28 : 6) +
          (r.row.prompts.length > 0 ? 16 : 0) +
          r.businessImpact.score * 0.32,
      ),
    );
    const effortScore = r.implementationEffort.score;
    const composite = impactScore + confidenceScore - effortScore;
    const reasons = [
      `Impact ${impactScore}: blend of business fit (${r.businessImpact.score}) and query breadth (${r.searchValue.score}).`,
      `Confidence ${confidenceScore}: data completeness (targets, prompts) and focus alignment.`,
      `Effort ${effortScore}: same implementation estimate as content planner (${r.implementationEffort.reasons[0] ?? "see cluster"}).`,
    ];
    const firstPrompt = r.row.prompts[0];
    const shortDetail =
      firstPrompt && firstPrompt.length > 160
        ? `${firstPrompt.slice(0, 157)}…`
        : firstPrompt ?? "Define prompts and target pages for this cluster.";
    return {
      stableId: `cluster:${r.clusterKey}`,
      source: "prompt_cluster",
      segment: clusterToSegment(r.clusterKey),
      headline: r.clusterTitle,
      shortDetail,
      impactScore,
      confidenceScore,
      effortScore,
      composite,
      reasons,
      summaryReason: reasons[0],
      clusterKey: r.clusterKey,
    };
  });
}

export function buildSiteGrowthOpportunities(
  input: BuildSiteGrowthOpportunitiesInput,
): GrowthOpportunity[] {
  const audit = buildAuditOpportunities(input.homepagePageId, input.auditResults);
  const clusters = buildClusterOpportunities(input.rankedClusters);
  const merged = [...audit, ...clusters];
  merged.sort((a, b) => {
    if (b.composite !== a.composite) return b.composite - a.composite;
    return a.stableId.localeCompare(b.stableId);
  });
  return merged;
}

export function limitGrowthOpportunities(
  rows: GrowthOpportunity[],
  limit: number = GROWTH_PIPELINE_DEFAULT_LIMIT,
): GrowthOpportunity[] {
  if (limit <= 0) return rows;
  return rows.slice(0, limit);
}
