/**
 * One-line next step per site for the Sites dashboard (deterministic, no AI).
 */
export function siteDashboardNextStep(input: {
  hasHomepage: boolean;
  latestRunStatus: string | null;
  onboardingStage: string;
  openFixTaskCount: number;
  checkFailCount: number;
  checkWarnCount: number;
  summaryHasError: boolean;
}): string {
  if (!input.hasHomepage) {
    return "Fix site record: no homepage page is linked.";
  }
  if (!input.latestRunStatus) {
    return "Run audit to capture a baseline.";
  }
  if (input.latestRunStatus === "failed" || input.onboardingStage === "blocked") {
    return "Fix the error, then re-run audit.";
  }
  if (input.openFixTaskCount > 0) {
    return `Open site and complete ${input.openFixTaskCount} open action(s).`;
  }
  if (input.latestRunStatus === "completed") {
    if (input.summaryHasError) {
      return "Open site summary — last run reported an error in summary.";
    }
    if (input.checkFailCount > 0 || input.checkWarnCount > 0) {
      return "Review failing checks on site detail, then re-run audit when ready.";
    }
    return "No open actions — re-audit after you change the site.";
  }
  if (input.latestRunStatus === "running") {
    return "Audit in progress — refresh shortly.";
  }
  return "Open site summary for details.";
}
