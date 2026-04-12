import type {
  LaunchReadinessLevel,
  LaunchReadinessSummaryState,
} from "@/lib/sites/launch-readiness-rules";

/**
 * Operational focus by readiness tier (deterministic copy only).
 *
 * | State        | Focus |
 * |--------------|--------|
 * | Not ready    | Fix blockers first |
 * | Nearly ready | High-priority audit / queue issues |
 * | Ready        | Conversion and growth |
 *
 * Dashboard uses `LaunchReadinessLevel` (`partly_ready` ≡ nearly-ready tier).
 */

export type ReadinessRecommendedFocus = {
  headline: string;
  detail: string;
};

export function recommendedActionsForReadinessState(
  state: LaunchReadinessSummaryState,
): ReadinessRecommendedFocus {
  switch (state) {
    case "not_ready":
      return {
        headline: "Fix blockers first",
        detail:
          "Clear homepage, audit failures, checklist gaps, and open fix tasks before go-live tuning.",
      };
    case "nearly_ready":
      return {
        headline: "Resolve high-priority audit issues",
        detail: "Work immediate fix tasks, audit warnings, and remaining checklist sign-offs.",
      };
    case "ready":
      return {
        headline: "Improve conversion and growth",
        detail: "Ship measurement, schema, and content experiments — re-run audits after changes.",
      };
  }
}

/** Maps dashboard tri-state (`partly_ready` → same focus as summary `nearly_ready`). */
export function recommendedActionsForReadinessLevel(
  level: LaunchReadinessLevel,
): ReadinessRecommendedFocus {
  if (level === "partly_ready") {
    return recommendedActionsForReadinessState("nearly_ready");
  }
  return recommendedActionsForReadinessState(level);
}
