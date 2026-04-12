/**
 * Onboarding re-exports audit fix planning (same engine as the audit dashboard).
 */

export type { AuditResultInput, FixBucket, FixRecommendation } from "@/lib/audits/fix-plan";
export {
  assignBucket,
  buildFixRecommendations,
  computePriorityScore,
  formatRankingNote,
  groupFixesByBucket,
} from "@/lib/audits/fix-plan";

import {
  buildFixRecommendations,
  type AuditResultInput,
} from "@/lib/audits/fix-plan";

/** Flat list sorted by bucket then score — prefer `buildFixRecommendations` + `groupFixesByBucket` in UI. */
export function buildOnboardingPlan(results: AuditResultInput[], geoHint: string | null) {
  return buildFixRecommendations(results, { geoHint });
}
