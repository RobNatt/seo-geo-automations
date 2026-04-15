import { prisma } from "@/lib/db";

/** Fixed keys — labels are for UI only; completion is stored per site. */
export const LAUNCH_CHECKLIST_DEF = [
  // Set & Forget baseline — technical/indexation
  {
    key: "indexation_gsc_bing_verified",
    category: "Set & Forget · Technical",
    label: "Google Search Console and Bing Webmaster are verified with sitemap submissions.",
  },
  {
    key: "indexation_robots_sitemap_alignment",
    category: "Set & Forget · Technical",
    label: "robots.txt allows public marketing URLs and aligns with sitemap intent.",
  },
  {
    key: "indexation_sitemap_indexable_urls",
    category: "Set & Forget · Technical",
    label: "sitemap-pages.xml includes all indexable priority URLs.",
  },
  {
    key: "indexation_redirect_301_strategy",
    category: "Set & Forget · Technical",
    label: "301 redirect strategy for retired/renamed URLs is defined and tested.",
  },

  // Set & Forget baseline — on-page template standards
  {
    key: "seo_title_meta",
    category: "Set & Forget · On-page",
    label: "Homepage title and meta description are set and reviewed for target queries.",
  },
  {
    key: "onpage_h1_single_intent",
    category: "Set & Forget · On-page",
    label: "Each priority page has one clear H1 aligned to page intent.",
  },
  {
    key: "onpage_canonical_urls",
    category: "Set & Forget · On-page",
    label: "Canonical URLs are configured on priority pages and match preferred routes.",
  },
  {
    key: "seo_indexing_intent",
    category: "SEO",
    label: "Indexing intent confirmed (launch URLs should be indexable unless intentionally excluded).",
  },

  // Set & Forget baseline — GEO / AI
  {
    key: "geo_visibility",
    category: "Set & Forget · GEO/AI",
    label: "Primary service area or location is clearly visible to users (not only in tags).",
  },
  {
    key: "geo_llms_txt_present",
    category: "Set & Forget · GEO/AI",
    label: "llms.txt is present and reflects current offerings, positioning, and key URLs.",
  },
  {
    key: "geo_entity_faq_baseline",
    category: "Set & Forget · GEO/AI",
    label: "Pillar pages include entity-focused FAQ content for AI and snippet extraction.",
  },

  // Set & Forget baseline — E-E-A-T
  {
    key: "eeat_author_bios",
    category: "Set & Forget · E-E-A-T",
    label: "Named author bios with credentials are linked where content is published.",
  },
  {
    key: "eeat_methodology_page",
    category: "Set & Forget · E-E-A-T",
    label: "Methodology/how-we-work page is published and linked from service content.",
  },
  {
    key: "eeat_case_studies",
    category: "Set & Forget · E-E-A-T",
    label: "At least one verifiable case study is published with measurable outcomes.",
  },

  // Set & Forget baseline — local trust
  {
    key: "local_gbp_baseline",
    category: "Set & Forget · Local trust",
    label: "Google Business Profile baseline is complete (category, services, hours, links, description).",
  },
  {
    key: "local_canonical_nap",
    category: "Set & Forget · Local trust",
    label: "Canonical NAP is locked and consistent across site and core profiles/directories.",
  },

  // Existing launch/ops checks (kept stable)
  {
    key: "analytics_live",
    category: "Analytics",
    label: "Analytics or core measurement is installed and receiving data.",
  },
  {
    key: "schema_deployed",
    category: "Set & Forget · GEO/AI",
    label: "Service/organization schema baseline is deployed and validated.",
  },
  {
    key: "conversion_primary_path",
    category: "Conversion",
    label: "Primary CTA or contact path is live and tested end-to-end.",
  },
] as const;

/** Set & Forget subset used by site-level baseline card. */
export const SET_FORGET_BASELINE_KEYS = [
  "indexation_gsc_bing_verified",
  "indexation_robots_sitemap_alignment",
  "indexation_sitemap_indexable_urls",
  "indexation_redirect_301_strategy",
  "seo_title_meta",
  "onpage_h1_single_intent",
  "onpage_canonical_urls",
  "geo_visibility",
  "geo_llms_txt_present",
  "geo_entity_faq_baseline",
  "schema_deployed",
  "eeat_author_bios",
  "eeat_methodology_page",
  "eeat_case_studies",
  "local_gbp_baseline",
  "local_canonical_nap",
] as const satisfies readonly LaunchChecklistKey[];

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
