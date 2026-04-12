import type {
  LaunchReadinessLevel,
  LaunchReadinessSummaryState,
} from "@/lib/sites/launch-readiness-rules";

/** Tailwind classes for dashboard tri-state readiness pills (`evaluateLaunchReadiness`). */
export function readinessLevelBadgeClass(level: LaunchReadinessLevel): string {
  if (level === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
  }
  if (level === "partly_ready") {
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100";
  }
  return "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100";
}

/** Tailwind classes for site summary / report three-state readiness (`evaluateLaunchReadinessSummary`). */
export function readinessSummaryStateBadgeClass(state: LaunchReadinessSummaryState): string {
  if (state === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
  }
  if (state === "nearly_ready") {
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100";
  }
  return "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100";
}
