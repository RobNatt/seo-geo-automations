/**
 * Single “what to do next” panel for site detail (deterministic priority).
 * Order: onboarding → audit failure → launch checklist → ready → warnings → fallback.
 */

import { buildLaunchChecklistAuditGuidance } from "@/lib/sites/checklist-audit-guidance";
import { isLaunchAuditHardFailed } from "@/lib/sites/launch-readiness-rules";
import type { LaunchChecklistKey } from "@/lib/sites/launch-checklist";

export type NextActionPanel =
  | { kind: "onboarding"; headline: string; detail: string }
  | { kind: "audit_failed"; headline: string; checkKey: string; detail: string }
  | {
      kind: "checklist";
      headline: string;
      remaining: string[];
      /** Audit-derived priority hints; checklist completion stays manual. */
      auditGuidance: string[];
    }
  | { kind: "audit_warnings"; headline: string; checkKey: string; detail: string }
  | { kind: "ready"; headline: string; detail: string }
  | { kind: "fallback"; headline: string; detail: string };

function pickTopResult(
  results: { checkKey: string; status: string; message: string | null }[],
  predicate: (status: string) => boolean,
): { checkKey: string; detail: string } | null {
  const sorted = [...results].sort((a, b) => a.checkKey.localeCompare(b.checkKey));
  const row = sorted.find((r) => predicate(r.status));
  if (!row) return null;
  return { checkKey: row.checkKey, detail: row.message?.trim() || "No message stored for this check." };
}

export function buildNextActionPanel(input: {
  hasHomepage: boolean;
  latestRunStatus: string | null;
  onboardingStage: string;
  results: { checkKey: string; status: string; message: string | null }[];
  launchRemainingLabels: string[];
  launchRemainingKeys: LaunchChecklistKey[];
  checkFailCount: number;
  checkWarnCount: number;
  summaryHasError: boolean;
  summaryErrorMessage: string | null;
}): NextActionPanel {
  const {
    hasHomepage,
    latestRunStatus,
    results,
    launchRemainingLabels,
    checkFailCount,
    checkWarnCount,
    summaryHasError,
    summaryErrorMessage,
  } = input;

  if (!hasHomepage) {
    return {
      kind: "onboarding",
      headline: "Finish onboarding",
      detail:
        "No homepage page is linked to this site. Fix the page catalog or register the site again with the correct homepage URL.",
    };
  }

  if (!latestRunStatus) {
    return {
      kind: "onboarding",
      headline: "Finish onboarding",
      detail: "Run the first homepage audit to capture a baseline and unlock automated fix tasks.",
    };
  }

  if (latestRunStatus === "running") {
    return {
      kind: "onboarding",
      headline: "Finish onboarding",
      detail: "A homepage audit is in progress — refresh this page shortly to see results.",
    };
  }

  if (
    isLaunchAuditHardFailed({
      latestRunStatus,
      onboardingStage: input.onboardingStage,
      checkFailCount,
      summaryHasError,
    })
  ) {
    if (summaryHasError && summaryErrorMessage) {
      return {
        kind: "audit_failed",
        headline: "Fix the top audit issue",
        checkKey: "audit_run",
        detail: summaryErrorMessage,
      };
    }
    const top = pickTopResult(results, (s) => s === "fail" || s === "error");
    if (top) {
      return {
        kind: "audit_failed",
        headline: "Fix the top failed check",
        checkKey: top.checkKey,
        detail: top.detail,
      };
    }
    return {
      kind: "audit_failed",
      headline: "Fix the audit failure",
      checkKey: "homepage_fetch",
      detail:
        "The audit did not finish with passing checks. Re-run after fixing availability, TLS, or server errors, then review check results below.",
    };
  }

  if (launchRemainingLabels.length > 0) {
    const auditGuidance = buildLaunchChecklistAuditGuidance(
      results.map((r) => ({ checkKey: r.checkKey, status: r.status })),
      input.launchRemainingKeys,
    );
    return {
      kind: "checklist",
      headline: "Complete the launch checklist",
      remaining: launchRemainingLabels,
      auditGuidance,
    };
  }

  if (
    latestRunStatus === "completed" &&
    checkFailCount === 0 &&
    checkWarnCount === 0 &&
    !summaryHasError
  ) {
    return {
      kind: "ready",
      headline: "Ready to launch",
      detail:
        "Onboarding is complete, the latest audit has no failures or warnings, and the go-live checklist is finished. Publish when you are satisfied.",
    };
  }

  if (latestRunStatus === "completed" && checkWarnCount > 0) {
    const tw = pickTopResult(results, (s) => s === "warn");
    if (tw) {
      return {
        kind: "audit_warnings",
        headline: "Review the top warning",
        checkKey: tw.checkKey,
        detail: tw.detail,
      };
    }
  }

  return {
    kind: "fallback",
    headline: "Next step",
    detail: "Review the sections below, then re-run the homepage audit after you make changes.",
  };
}

/** One-line summary for dense list views (e.g. sites dashboard). */
export function summarizeNextActionPanel(panel: NextActionPanel): string {
  if (panel.kind === "checklist") {
    const base = `${panel.headline} (${panel.remaining.length} left)`;
    const hint = panel.auditGuidance[0];
    if (!hint) return base;
    const short = hint.length > 90 ? `${hint.slice(0, 87)}…` : hint;
    return `${base} — ${short}`;
  }
  return panel.headline;
}
