import { GEO_AREA_NOTE_VISIBLE_CHECK_KEY } from "@/lib/audits/checks";
import type { LaunchChecklistKey } from "@/lib/sites/launch-checklist";

/**
 * Maps latest audit outcomes to short priority hints for open checklist rows.
 * Does not change checklist state — manual sign-off only.
 */

export function buildLaunchChecklistAuditGuidance(
  results: { checkKey: string; status: string }[],
  remainingKeys: readonly LaunchChecklistKey[],
): string[] {
  const open = new Set(remainingKeys);
  const lines: string[] = [];

  const meta = results.find((r) => r.checkKey === "meta_description_present");
  if (meta?.status === "warn" && open.has("seo_title_meta")) {
    lines.push(
      "Audit: meta description length looks off — review the “Homepage title and meta” checklist item first.",
    );
  }

  const geo = results.find((r) => r.checkKey === GEO_AREA_NOTE_VISIBLE_CHECK_KEY);
  if (geo?.status === "warn" && open.has("geo_visibility")) {
    lines.push(
      "Audit: onboarding location wording was not found in visible homepage text — prioritize the GEO visibility checklist item.",
    );
  }

  return lines;
}
