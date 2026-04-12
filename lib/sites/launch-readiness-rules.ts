/**
 * Launch readiness — single source of truth for tri-state readiness and dashboard urgency.
 *
 * ## Readiness (first matching rule wins)
 *
 * 1. **not_ready** — No homepage linked, or no latest audit run yet.
 * 2. **partly_ready** — Latest run status is `running` (“In progress”).
 * 3. **not_ready** — **Audit hard failure** (see `isLaunchAuditHardFailed`): run `failed`,
 *    onboarding `blocked`, summary parse error, or `completed` with at least one failed check.
 * 4. **partly_ready** — `completed`, audit clean so far, but checklist not fully done.
 * 5. **ready** — `completed`, no fails/warnings/summary error, checklist complete.
 * 6. **partly_ready** — Fallback (e.g. `completed` with warnings after checklist done).
 *
 * ## Urgency (sort: higher score first)
 *
 * `ready` → **0**. Otherwise additive tiers (deterministic, stable inputs):
 *
 * | Tier | Weight |
 * |------|--------|
 * | No audit run yet | +1000 |
 * | Run failed or stage blocked | +900 |
 * | Summary error or positive fail count | +850 |
 * | Open fix tasks | +400 + 8×min(count, 50) |
 * | Each incomplete checklist item | +200 + 30×missing |
 * | Warning count | +100 + 10×warns |
 * | Run in progress | +50 |
 * | Partly ready (baseline) | +25 |
 */

export type LaunchReadinessLevel = "not_ready" | "partly_ready" | "ready";

export type LaunchReadinessSignals = {
  hasHomepage: boolean;
  latestRunStatus: string | null;
  onboardingStage: string;
  checkFailCount: number;
  checkWarnCount: number;
  summaryHasError: boolean;
  launchDone: number;
  launchExpected: number;
};

export type LaunchUrgencySignals = LaunchReadinessSignals & {
  openFixTaskCount: number;
};

/** Shared gate with “next action” audit failure branch. */
export function isLaunchAuditHardFailed(
  s: Pick<
    LaunchReadinessSignals,
    "latestRunStatus" | "onboardingStage" | "checkFailCount" | "summaryHasError"
  >,
): boolean {
  return (
    s.latestRunStatus === "failed" ||
    s.onboardingStage === "blocked" ||
    s.summaryHasError ||
    (s.latestRunStatus === "completed" && s.checkFailCount > 0)
  );
}

export function evaluateLaunchReadiness(
  s: LaunchReadinessSignals,
): { level: LaunchReadinessLevel; label: string } {
  if (!s.hasHomepage || !s.latestRunStatus) {
    return { level: "not_ready", label: "Not ready" };
  }

  if (s.latestRunStatus === "running") {
    return { level: "partly_ready", label: "In progress" };
  }

  if (
    isLaunchAuditHardFailed({
      latestRunStatus: s.latestRunStatus,
      onboardingStage: s.onboardingStage,
      checkFailCount: s.checkFailCount,
      summaryHasError: s.summaryHasError,
    })
  ) {
    return { level: "not_ready", label: "Not ready" };
  }

  if (s.latestRunStatus === "completed" && s.launchDone < s.launchExpected) {
    return { level: "partly_ready", label: "Partly ready" };
  }

  if (
    s.latestRunStatus === "completed" &&
    s.checkFailCount === 0 &&
    s.checkWarnCount === 0 &&
    !s.summaryHasError &&
    s.launchDone >= s.launchExpected
  ) {
    return { level: "ready", label: "Ready" };
  }

  return { level: "partly_ready", label: "Partly ready" };
}

function urgencyScoreForLevel(s: LaunchUrgencySignals, level: LaunchReadinessLevel): number {
  if (level === "ready") {
    return 0;
  }

  let score = 0;
  if (!s.latestRunStatus) score += 1000;
  if (s.latestRunStatus === "failed" || s.onboardingStage === "blocked") score += 900;
  if (s.summaryHasError || s.checkFailCount > 0) score += 850;
  if (s.openFixTaskCount > 0) score += 400 + Math.min(s.openFixTaskCount, 50) * 8;
  if (s.launchDone < s.launchExpected) {
    score += 200 + (s.launchExpected - s.launchDone) * 30;
  }
  if (s.checkWarnCount > 0) score += 100 + s.checkWarnCount * 10;
  if (s.latestRunStatus === "running") score += 50;
  if (level === "partly_ready") score += 25;
  return score;
}

/** Readiness + urgency in one pass (e.g. sites dashboard). */
export function launchReadinessMetrics(s: LaunchUrgencySignals): {
  readiness: { level: LaunchReadinessLevel; label: string };
  urgencyScore: number;
} {
  const readiness = evaluateLaunchReadiness(s);
  return {
    readiness,
    urgencyScore: urgencyScoreForLevel(s, readiness.level),
  };
}

/**
 * Site-detail summary: three admin-facing states (explicit order).
 *
 * 1. **not_ready** — No homepage, no audit yet, run in progress, or audit hard failure
 *    (same gate as `isLaunchAuditHardFailed`, including missing run).
 * 2. **ready** — Latest run `completed`, zero fails/warnings/summary error, checklist
 *    complete, zero open fix tasks.
 * 3. **nearly_ready** — All other cases (e.g. audit warnings, incomplete checklist,
 *    or open fix tasks while audit has no hard failures).
 */
export type LaunchReadinessSummaryState = "not_ready" | "nearly_ready" | "ready";

export type LaunchReadinessSummary = {
  state: LaunchReadinessSummaryState;
  /** Display title for the state. */
  stateLabel: string;
  /** One short operational line. */
  nextStep: string;
};

export function evaluateLaunchReadinessSummary(s: LaunchUrgencySignals): LaunchReadinessSummary {
  if (!s.hasHomepage || !s.latestRunStatus) {
    return {
      state: "not_ready",
      stateLabel: "Not ready",
      nextStep: "Link a homepage and run the first audit before tracking launch readiness.",
    };
  }

  if (s.latestRunStatus === "running") {
    return {
      state: "not_ready",
      stateLabel: "Not ready",
      nextStep: "Wait for the in-flight audit to finish, then review results and fix tasks.",
    };
  }

  if (
    isLaunchAuditHardFailed({
      latestRunStatus: s.latestRunStatus,
      onboardingStage: s.onboardingStage,
      checkFailCount: s.checkFailCount,
      summaryHasError: s.summaryHasError,
    })
  ) {
    return {
      state: "not_ready",
      stateLabel: "Not ready",
      nextStep: "Resolve failed checks, blocked onboarding, or audit errors, then re-run the homepage audit.",
    };
  }

  const auditClean =
    s.latestRunStatus === "completed" &&
    s.checkFailCount === 0 &&
    s.checkWarnCount === 0 &&
    !s.summaryHasError;
  const checklistComplete = s.launchDone >= s.launchExpected;
  const noOpenFixes = s.openFixTaskCount === 0;

  if (auditClean && checklistComplete && noOpenFixes) {
    return {
      state: "ready",
      stateLabel: "Ready",
      nextStep: "No blockers in this view — publish when your final human review is done.",
    };
  }

  return {
    state: "nearly_ready",
    stateLabel: "Nearly ready",
    nextStep:
      "Finish the launch checklist, close open fix tasks, and clear any audit warnings before go-live.",
  };
}
