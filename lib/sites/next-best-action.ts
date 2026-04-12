import type { FixRecommendation } from "@/lib/audits/fix-plan";
import type { LaunchReadinessSummaryState } from "@/lib/sites/launch-readiness-rules";
import type { NextActionPanel } from "@/lib/sites/next-action-panel";

export type NextBestActionMode = "blockers" | "high_impact_fixes" | "optimization";

export type NextBestAction = {
  headline: string;
  detail: string;
  mode: NextBestActionMode;
  /** Check key or fix key for traceability. */
  traceKey?: string;
};

const BUCKET_ORDER = ["immediate", "soon", "later"] as const;

function sortFixesForPick(a: FixRecommendation, b: FixRecommendation): number {
  const bo =
    BUCKET_ORDER.indexOf(a.bucket as (typeof BUCKET_ORDER)[number]) -
    BUCKET_ORDER.indexOf(b.bucket as (typeof BUCKET_ORDER)[number]);
  if (bo !== 0) return bo;
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  return a.key.localeCompare(b.key);
}

function primaryFromBlockerPanel(panel: NextActionPanel): NextBestAction {
  switch (panel.kind) {
    case "checklist": {
      const first = panel.remaining[0];
      return {
        headline: panel.headline,
        detail:
          panel.remaining.length > 0 && first
            ? `${panel.remaining.length} item(s) left — start with: ${first}`
            : "Work through the launch checklist below.",
        mode: "blockers",
        traceKey: undefined,
      };
    }
    case "audit_failed":
    case "audit_warnings":
      return {
        headline: panel.headline,
        detail: panel.detail,
        mode: "blockers",
        traceKey: panel.checkKey,
      };
    case "onboarding":
    case "ready":
    case "fallback":
      return {
        headline: panel.headline,
        detail: panel.detail,
        mode: "blockers",
        traceKey: undefined,
      };
    default: {
      const _x: never = panel;
      return _x;
    }
  }
}

function pickHighImpactFix(fixes: FixRecommendation[]): FixRecommendation | null {
  const high = fixes.filter((f) => f.impact === "high");
  if (high.length === 0) return null;
  return [...high].sort(sortFixesForPick)[0] ?? null;
}

function pickFirstBucketFix(fixes: FixRecommendation[], bucket: FixRecommendation["bucket"]): FixRecommendation | null {
  const inB = fixes.filter((f) => f.bucket === bucket);
  if (inB.length === 0) return null;
  return [...inB].sort(sortFixesForPick)[0] ?? null;
}

function pickOptimizationFix(fixes: FixRecommendation[]): FixRecommendation | null {
  const later = fixes.filter((f) => f.bucket === "later");
  if (later.length > 0) return [...later].sort(sortFixesForPick)[0] ?? null;
  const soonNonHigh = fixes.filter((f) => f.bucket === "soon" && f.impact !== "high");
  if (soonNonHigh.length > 0) return [...soonNonHigh].sort(sortFixesForPick)[0] ?? null;
  const geo = fixes.filter((f) => f.checkKey === "geo_hint");
  if (geo.length > 0) return [...geo].sort(sortFixesForPick)[0] ?? null;
  return null;
}

/**
 * Single primary step from readiness tier + existing panel + latest-audit fix recommendations.
 * Read-only; does not mutate checklist or tasks.
 */
export function buildNextBestAction(input: {
  readinessState: LaunchReadinessSummaryState;
  nextPanel: NextActionPanel;
  fixesFromLatestAudit: FixRecommendation[];
}): NextBestAction {
  const { readinessState, nextPanel, fixesFromLatestAudit: fixes } = input;

  if (readinessState === "not_ready") {
    return primaryFromBlockerPanel(nextPanel);
  }

  if (readinessState === "nearly_ready") {
    const hi = pickHighImpactFix(fixes);
    if (hi) {
      return {
        headline: hi.title,
        detail: hi.detail,
        mode: "high_impact_fixes",
        traceKey: hi.key,
      };
    }
    const imm = pickFirstBucketFix(fixes, "immediate");
    if (imm) {
      return {
        headline: imm.title,
        detail: imm.detail,
        mode: "high_impact_fixes",
        traceKey: imm.key,
      };
    }
    return primaryFromBlockerPanel(nextPanel);
  }

  // ready
  const opt = pickOptimizationFix(fixes);
  if (opt) {
    return {
      headline: opt.title,
      detail: opt.detail,
      mode: "optimization",
      traceKey: opt.key,
    };
  }

  return {
    headline: "Optimize and grow",
    detail:
      "Baseline is clean — tighten analytics, structured data, and conversion paths, then re-run the homepage audit to verify.",
    mode: "optimization",
    traceKey: undefined,
  };
}

export function nextBestActionModeLabel(mode: NextBestActionMode): string {
  if (mode === "blockers") return "Launch blockers";
  if (mode === "high_impact_fixes") return "High-impact fix";
  return "Growth / optimization";
}
