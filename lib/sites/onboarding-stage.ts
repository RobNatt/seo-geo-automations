/** Stored on `Site.onboardingStage` — updated by `runPageAudit` (not ad hoc). */
export const SITE_ONBOARDING_STAGES = ["intake", "audited", "blocked"] as const;
export type SiteOnboardingStage = (typeof SITE_ONBOARDING_STAGES)[number];

export const SITE_STAGE_LABEL: Record<SiteOnboardingStage, string> = {
  intake: "Intake — awaiting a successful audit",
  audited: "Audited — last run completed",
  blocked: "Blocked — last run failed",
};

/** Short label for dense dashboards. */
export const SITE_STAGE_SHORT: Record<SiteOnboardingStage, string> = {
  intake: "Intake",
  audited: "Audited",
  blocked: "Blocked",
};

export function isSiteOnboardingStage(s: string): s is SiteOnboardingStage {
  return (SITE_ONBOARDING_STAGES as readonly string[]).includes(s);
}
