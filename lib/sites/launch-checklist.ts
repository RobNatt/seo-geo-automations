import { prisma } from "@/lib/db";

/** Fixed keys — labels are for UI only; completion is stored per site. */
export const LAUNCH_CHECKLIST_DEF = [
  {
    key: "seo_title_meta",
    category: "SEO",
    label: "Homepage title and meta description are set and reviewed for target queries.",
  },
  {
    key: "seo_indexing_intent",
    category: "SEO",
    label: "Indexing intent confirmed (launch URLs should be indexable unless intentionally excluded).",
  },
  {
    key: "geo_visibility",
    category: "GEO",
    label: "Primary service area or location is clearly visible to users (not only in tags).",
  },
  {
    key: "analytics_live",
    category: "Analytics",
    label: "Analytics or core measurement is installed and receiving data.",
  },
  {
    key: "schema_deployed",
    category: "Schema",
    label: "Key structured data is deployed or scheduled (e.g. Organization, LocalBusiness, or service schema).",
  },
  {
    key: "conversion_primary_path",
    category: "Conversion",
    label: "Primary CTA or contact path is live and tested end-to-end.",
  },
] as const;

export type LaunchChecklistKey = (typeof LAUNCH_CHECKLIST_DEF)[number]["key"];

const KEY_SET = new Set<string>(LAUNCH_CHECKLIST_DEF.map((d) => d.key));

export function isLaunchChecklistKey(k: string): k is LaunchChecklistKey {
  return KEY_SET.has(k);
}

/** Backfill missing rows for sites created before checklist existed. */
export async function ensureLaunchChecklistForSite(siteId: string) {
  const existing = await prisma.siteLaunchCheckItem.findMany({
    where: { siteId },
    select: { key: true },
  });
  const have = new Set(existing.map((e) => e.key));
  const missing = LAUNCH_CHECKLIST_DEF.filter((d) => !have.has(d.key));
  if (missing.length === 0) return;

  await prisma.siteLaunchCheckItem.createMany({
    data: missing.map((d) => ({ siteId, key: d.key, done: false })),
  });
}

export function mergeLaunchChecklistRows(
  rows: { key: string; done: boolean }[],
): { key: LaunchChecklistKey; category: string; label: string; done: boolean }[] {
  const byKey = new Map(rows.map((r) => [r.key, r.done]));
  return LAUNCH_CHECKLIST_DEF.map((def) => ({
    key: def.key,
    category: def.category,
    label: def.label,
    done: byKey.get(def.key) ?? false,
  }));
}
