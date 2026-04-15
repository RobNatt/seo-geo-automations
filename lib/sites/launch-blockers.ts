/**
 * Launch blockers — issues that truly block the ready-to-go-live state.
 * Warnings are collected separately (see `collectLaunchWarnings`).
 */

export type LaunchBlocker = {
  id: string;
  title: string;
  detail?: string;
};

export type LaunchWarning = {
  id: string;
  title: string;
  detail?: string;
};

/**
 * Checks that default to advisory (warning-only), even if returned as fail/error.
 * They can be promoted to blockers via `hardBlockerCheckKeys`.
 */
export const WARNING_ONLY_CHECK_KEYS = new Set<string>(["geo_area_note_visible"]);

export type CollectLaunchBlockersInput = {
  hasHomepage: boolean;
  latestRunStatus: string | null;
  onboardingStage: string;
  summaryHasError: boolean;
  summaryErrorMessage: string | null;
  auditResults: { checkKey: string; status: string }[];
  checklistUndone: { key: string; label: string }[];
  openFixTasks: { dedupeKey: string; title: string; blocksLaunch?: boolean }[];
  /** Optional explicit overrides for warning-only checks that should block launch. */
  hardBlockerCheckKeys?: string[];
};

function asSet(keys: string[] | undefined): Set<string> {
  return new Set((keys ?? []).map((k) => k.trim()).filter(Boolean));
}

export function isHardBlockerCheckKey(checkKey: string, hardBlockerCheckKeys?: string[]): boolean {
  if (!WARNING_ONLY_CHECK_KEYS.has(checkKey)) return true;
  const overrides = asSet(hardBlockerCheckKeys);
  return overrides.has(checkKey);
}

export function summarizeAuditHardFailures(
  auditResults: { checkKey: string; status: string }[],
  hardBlockerCheckKeys?: string[],
): string[] {
  return [...auditResults]
    .filter((r) => (r.status === "fail" || r.status === "error") && isHardBlockerCheckKey(r.checkKey, hardBlockerCheckKeys))
    .map((r) => r.checkKey)
    .sort((a, b) => a.localeCompare(b));
}

export function summarizeAuditWarnings(
  auditResults: { checkKey: string; status: string }[],
  hardBlockerCheckKeys?: string[],
): string[] {
  return [...auditResults]
    .filter((r) => {
      if (r.status === "warn") return true;
      if (r.status === "fail" || r.status === "error") {
        return !isHardBlockerCheckKey(r.checkKey, hardBlockerCheckKeys);
      }
      return false;
    })
    .map((r) => r.checkKey)
    .sort((a, b) => a.localeCompare(b));
}

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

  const failKeys = summarizeAuditHardFailures(input.auditResults, input.hardBlockerCheckKeys);
  if (failKeys.length > 0) {
    out.push({
      id: "audit_check_failures",
      title: "Failed checks on latest audit",
      detail: failKeys.join(", "),
    });
  }

  for (const item of input.checklistUndone) {
    out.push({
      id: `checklist:${item.key}`,
      title: item.label,
    });
  }

  for (const t of input.openFixTasks) {
    if (t.blocksLaunch === false) continue;
    out.push({
      id: `open_fix:${t.dedupeKey}`,
      title: t.title,
    });
  }

  return out;
}

export function collectLaunchWarnings(input: {
  auditResults: { checkKey: string; status: string }[];
  hardBlockerCheckKeys?: string[];
}): LaunchWarning[] {
  const warnKeys = summarizeAuditWarnings(input.auditResults, input.hardBlockerCheckKeys);
  if (warnKeys.length === 0) return [];
  return [
    {
      id: "audit_check_warnings",
      title: "Advisory warnings on latest audit",
      detail: warnKeys.join(", "),
    },
  ];
}
