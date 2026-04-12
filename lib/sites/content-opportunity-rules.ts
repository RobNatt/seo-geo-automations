import { GEO_AREA_NOTE_VISIBLE_CHECK_KEY } from "@/lib/audits/checks";

/**
 * Deterministic content-opportunity rules from site, audit, checklist, fix-queue, and cluster shape.
 * No AI — only thresholds, counts, and check statuses. Stable `key` for dedupe and tests.
 */

export type ContentOpportunityRuleCategory = "service" | "faq" | "geo" | "snippet";

export type RuleBasedContentOpportunity = {
  /** Stable id, e.g. `content_opp:service:gap:plumbing` */
  key: string;
  category: ContentOpportunityRuleCategory;
  title: string;
  detail: string;
  reasons: string[];
};

export type ContentOpportunityRulesInput = {
  /** Launch checklist key → done */
  checklistDoneByKey: Record<string, boolean>;
  /** Latest relevant audit rows (e.g. homepage) */
  auditChecks: { checkKey: string; status: string }[];
  /** Prompt clusters: key + non-empty prompt count */
  clusters: { key: string; promptCount: number }[];
  /** Site pages (respect `status === "active"` only when filtering) */
  sitePages: { status: string; serviceId: string | null }[];
  /** Every service slug in the catalog */
  catalogServiceSlugs: string[];
  /** Slugs that have at least one page linked anywhere in the DB */
  globallyLinkedServiceSlugs: string[];
  /** Service slugs linked from at least one active page on this site */
  siteLinkedServiceSlugs: string[];
  /** Open fix-task dedupe keys for this site */
  openFixDedupeKeys: string[];
  /** Cap how many `service:gap:*` rows to emit (deterministic order by slug) */
  maxServiceGapRows?: number;
};

export function isFaqClusterKey(clusterKey: string): boolean {
  const head = clusterKey.toLowerCase().split("_")[0] ?? "";
  return head === "faq" || head === "faqs";
}

const THIN_FAQ_PROMPT_THRESHOLD = 2;

function activeSitePages(pages: ContentOpportunityRulesInput["sitePages"]) {
  return pages.filter((p) => p.status === "active" || p.status === "");
}

function ruleGeo(input: ContentOpportunityRulesInput): RuleBasedContentOpportunity[] {
  const out: RuleBasedContentOpportunity[] = [];
  const geoCheck = input.auditChecks.find((c) => c.checkKey === GEO_AREA_NOTE_VISIBLE_CHECK_KEY);
  if (geoCheck?.status === "warn") {
    out.push({
      key: "content_opp:geo:audit_visible_text",
      category: "geo",
      title: "GEO: location or service area not obvious in visible copy",
      detail:
        "Latest audit did not find the onboarding GEO note in visible text. Add clear service-area or location language users (and LLMs) can see.",
      reasons: [
        `Audit check ${GEO_AREA_NOTE_VISIBLE_CHECK_KEY} is warn (deterministic substring vs geo hint).`,
      ],
    });
    return out;
  }

  const checklistGeo = input.checklistDoneByKey["geo_visibility"];
  if (checklistGeo === false) {
    out.push({
      key: "content_opp:geo:checklist_visibility",
      category: "geo",
      title: "GEO: launch checklist — visibility not confirmed",
      detail:
        "Mark the GEO visibility item when primary service area or location is clearly visible on the site (not only meta).",
      reasons: [
        "Launch checklist key geo_visibility is not done — manual signal that on-page GEO may still be weak.",
      ],
    });
  } else if (
    geoCheck?.status === "pass" &&
    input.openFixDedupeKeys.some(
      (k) => k === GEO_AREA_NOTE_VISIBLE_CHECK_KEY || k.startsWith(`${GEO_AREA_NOTE_VISIBLE_CHECK_KEY}:`),
    )
  ) {
    out.push({
      key: "content_opp:geo:fix_task_pending",
      category: "geo",
      title: "GEO: open fix task still references visibility",
      detail:
        "Audit now passes the visible-text GEO check, but an open fix task still tracks this area — review and close or refresh tasks after changes.",
      reasons: [
        "Open queue contains a geo_area_note_visible task while the latest audit reports pass — reconcile manual work.",
      ],
    });
  }

  return out;
}

function ruleService(input: ContentOpportunityRulesInput): RuleBasedContentOpportunity[] {
  const out: RuleBasedContentOpportunity[] = [];
  const active = activeSitePages(input.sitePages);
  if (active.length === 0 || input.catalogServiceSlugs.length === 0) return out;

  const pagesWithService = active.filter((p) => p.serviceId != null).length;
  const maxGaps = input.maxServiceGapRows ?? 12;

  if (pagesWithService === 0 && input.globallyLinkedServiceSlugs.length > 0) {
    out.push({
      key: "content_opp:service:no_catalog_mapping",
      category: "service",
      title: "Service coverage: no catalog pages linked to offerings",
      detail:
        "The site has active pages and the service catalog is in use elsewhere, but no page on this site is linked to a Service record — map URLs to offerings for clearer IA and reporting.",
      reasons: [
        `Active pages: ${active.length}; pages with serviceId: 0.`,
        `Catalog services in use globally: ${input.globallyLinkedServiceSlugs.length}.`,
      ],
    });
    return out;
  }

  const siteLinked = new Set(input.siteLinkedServiceSlugs);
  const gapSlugs = input.globallyLinkedServiceSlugs
    .filter((slug) => !siteLinked.has(slug))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, maxGaps);

  for (const slug of gapSlugs) {
    out.push({
      key: `content_opp:service:gap:${slug}`,
      category: "service",
      title: `Service coverage: no page mapped to “${slug}”`,
      detail:
        "This service exists in the catalog and is linked from at least one page somewhere, but not from this site — add or link a service URL.",
      reasons: [
        `Service slug "${slug}" is globally linked on ≥1 page but has no page on this site with that serviceId.`,
      ],
    });
  }

  return out;
}

function ruleFaq(input: ContentOpportunityRulesInput): RuleBasedContentOpportunity[] {
  const out: RuleBasedContentOpportunity[] = [];
  const faqClusters = input.clusters.filter((c) => isFaqClusterKey(c.key));

  if (faqClusters.length === 0) {
    out.push({
      key: "content_opp:faq:no_cluster",
      category: "faq",
      title: "FAQ coverage: no FAQ prompt cluster",
      detail:
        "Create at least one cluster whose key starts with faq_ or faqs_ so question-style intents are tracked and ranked.",
      reasons: ["No cluster key with prefix faq_ / faqs_ found for this site."],
    });
    return out;
  }

  const thin = faqClusters
    .filter((c) => c.promptCount < THIN_FAQ_PROMPT_THRESHOLD)
    .sort((a, b) => a.key.localeCompare(b.key));

  for (const c of thin) {
    out.push({
      key: `content_opp:faq:thin_prompts:${c.key}`,
      category: "faq",
      title: `FAQ coverage: thin cluster “${c.key}”`,
      detail: `Add more distinct FAQ-style prompts (threshold ≥${THIN_FAQ_PROMPT_THRESHOLD} non-empty prompts).`,
      reasons: [
        `Cluster "${c.key}" has promptCount=${c.promptCount} (< ${THIN_FAQ_PROMPT_THRESHOLD}).`,
      ],
    });
  }

  return out;
}

function ruleSnippetFromFixQueue(input: ContentOpportunityRulesInput): RuleBasedContentOpportunity[] {
  const out: RuleBasedContentOpportunity[] = [];
  const keys = new Set(input.openFixDedupeKeys);

  if (keys.has("title_present:fail") || keys.has("title_present:skipped")) {
    out.push({
      key: "content_opp:snippet:title_task_open",
      category: "snippet",
      title: "Snippet: open task for page title",
      detail: "Resolve the queued title fix — titles anchor queries and SERP presentation.",
      reasons: ["Open fix-task dedupeKey matches title_present:fail or title_present:skipped."],
    });
  }

  if (keys.has("meta_description_present:fail") || keys.has("meta_description_present:warn")) {
    out.push({
      key: "content_opp:snippet:meta_task_open",
      category: "snippet",
      title: "Snippet: open task for meta description",
      detail: "Resolve the queued meta description task to strengthen snippets and intent match.",
      reasons: ["Open fix-task dedupeKey matches meta_description_present:fail or :warn."],
    });
  }

  return out;
}

/**
 * Returns rule hits in deterministic order (sorted by `key`).
 */
export function findRuleBasedContentOpportunities(
  input: ContentOpportunityRulesInput,
): RuleBasedContentOpportunity[] {
  const merged = [
    ...ruleGeo(input),
    ...ruleService(input),
    ...ruleFaq(input),
    ...ruleSnippetFromFixQueue(input),
  ];
  merged.sort((a, b) => a.key.localeCompare(b.key));
  return merged;
}
