/**
 * Launch blockers — issues that match the app’s “not ready to go live” bar
 * (same bar as `evaluateLaunchReadinessSummary` → `ready`).
 *
 * Rules (all that apply, fixed order):
 * 1. No homepage linked.
 * 2. No latest homepage audit run.
 * 3. Latest run status `running`.
 * 4. Onboarding stage `blocked`.
 * 5. Latest run status `failed`.
 * 6. Audit summary parse/error (`summaryHasError`).
 * 7. Any check row `fail` / `error` (keys from results, sorted).
 * 8. Any check row `warn` (keys from results, sorted).
 * 9. Each launch checklist item not marked done (title = checklist label).
 * 10. Each open fix task (title = task title).
 *
 * No inference beyond these inputs — only listed facts.
 */

export type LaunchBlocker = {
  id: string;
  title: string;
  detail?: string;
};

export type CollectLaunchBlockersInput = {
  hasHomepage: boolean;
  latestRunStatus: string | null;
  onboardingStage: string;
  summaryHasError: boolean;
  summaryErrorMessage: string | null;
  auditResults: { checkKey: string; status: string }[];
  checklistUndone: { key: string; label: string }[];
  openFixTasks: { dedupeKey: string; title: string }[];
};

export function collectLaunchBlockers(input: CollectLaunchBlockersInput): LaunchBlocker[] {
  const out: LaunchBlocker[] = [];

  if (!input.hasHomepage) {
    out.push({
      id: "no_homepage",
      title: "No homepage linked",
      detail: "Link the homepage in the page catalog or re-onboard.",
    });
  }

  if (input.hasHomepage && !input.latestRunStatus) {
    out.push({
      id: "no_audit",
      title: "No homepage audit",
      detail: "Run the homepage audit before go-live.",
    });
  }

  if (input.latestRunStatus === "running") {
    out.push({
      id: "audit_running",
      title: "Audit still running",
      detail: "Wait for completion, then review results.",
    });
  }

  if (input.onboardingStage === "blocked") {
    out.push({
      id: "onboarding_blocked",
      title: "Onboarding blocked",
      detail: "Clear the failed audit or unblock this site.",
    });
  }

  if (input.latestRunStatus === "failed") {
    out.push({
      id: "audit_run_failed",
      title: "Latest audit run failed",
      detail: "Fix the underlying issue and re-run.",
    });
  }

  if (input.summaryHasError) {
    const msg = input.summaryErrorMessage?.trim();
    out.push({
      id: "audit_summary_error",
      title: "Audit summary error",
      detail: msg || "Latest run summary could not be read reliably.",
    });
  }

  const sortedResults = [...input.auditResults].sort((a, b) =>
    a.checkKey.localeCompare(b.checkKey),
  );
  const failKeys = sortedResults
    .filter((r) => r.status === "fail" || r.status === "error")
    .map((r) => r.checkKey);
  if (failKeys.length > 0) {
    out.push({
      id: "audit_check_failures",
      title: "Failed checks on latest audit",
      detail: failKeys.join(", "),
    });
  }

  const warnKeys = sortedResults.filter((r) => r.status === "warn").map((r) => r.checkKey);
  if (warnKeys.length > 0) {
    out.push({
      id: "audit_check_warnings",
      title: "Warnings on latest audit",
      detail: warnKeys.join(", "),
    });
  }

  for (const item of input.checklistUndone) {
    out.push({
      id: `checklist:${item.key}`,
      title: item.label,
    });
  }

  for (const t of input.openFixTasks) {
    out.push({
      id: `open_fix:${t.dedupeKey}`,
      title: t.title,
    });
  }

  return out;
}
