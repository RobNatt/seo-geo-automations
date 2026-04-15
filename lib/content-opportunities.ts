import { buildSiteBriefFromSite } from "@/lib/site-brief";

export type ContentOpportunityType = "service" | "faq" | "supporting";
export type ContentOpportunityPriority = "high" | "medium" | "low";

export type GeneratedContentOpportunity = {
  type: ContentOpportunityType;
  topic: string;
  priority: ContentOpportunityPriority;
  reason: string;
  nextAction: string;
  keywordSuggestions: string[];
  dueDate: Date;
};

type SiteShape = {
  businessName: string;
  primaryFocus: string | null;
  geoHint: string | null;
  primaryServices: unknown;
  targetAudience: string | null;
  marketFocus: string | null;
  serviceArea: unknown;
  primaryConversionGoal: string | null;
  brandTone: string | null;
  optionalPriorityKeyword: string | null;
  priorityKeyword: string | null;
  geoAreaNoteVisible: string | null;
};

function uniqueStrings(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of input.map((x) => x.trim()).filter(Boolean)) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function topService(siteBriefServices: string[]): string {
  return siteBriefServices[0] ?? "service";
}

function topLocation(serviceArea: string[], geoHint: string | null): string {
  if (serviceArea[0]) return serviceArea[0];
  return geoHint?.trim() || "your area";
}

function keywordPack(base: string, location: string, audience: string): string[] {
  return uniqueStrings([
    `${base} ${location}`,
    `${base} ${location} ${audience || "small business"}`,
    `best ${base} ${location}`,
  ]);
}

/**
 * Deterministic 3-5 opportunities from onboarding brief + GEO + growth signals.
 */
export function buildContentOpportunities(input: {
  site: SiteShape;
  lowCtrPageCount: number;
  openGrowthTaskKeys: string[];
}): GeneratedContentOpportunity[] {
  const brief = buildSiteBriefFromSite(input.site);
  const service = topService(brief.primaryServices);
  const location = topLocation(brief.serviceArea, input.site.geoHint);
  const audience = brief.targetAudience || "businesses";
  const now = new Date();

  const out: GeneratedContentOpportunity[] = [];

  // 1) Service/location page opportunity (high)
  out.push({
    type: "service",
    topic: `${service} ${location}`.trim(),
    priority: "high",
    reason:
      "Onboarding service + GEO location combination is the highest intent baseline page type and should be explicit.",
    nextAction: "Plan or update a location-qualified service page and align title/meta/FAQ schema.",
    keywordSuggestions: keywordPack(service, location, audience),
    dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  });

  // 2) FAQ cluster from field-guide GEO baseline (high)
  out.push({
    type: "faq",
    topic: `${service} questions`,
    priority: "high",
    reason:
      "Field guide GEO baseline requires entity + FAQ-style answers; FAQ clusters improve snippet and AI extraction coverage.",
    nextAction: "Draft 5-8 service FAQs and add FAQ schema on the relevant pillar/service page.",
    keywordSuggestions: uniqueStrings([
      `${service} faq`,
      `how much does ${service} cost`,
      `how long does ${service} take`,
    ]),
    dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
  });

  // 3) Supporting educational guide (medium)
  out.push({
    type: "supporting",
    topic: `${location} ${service} maintenance guide`,
    priority: "medium",
    reason:
      "Supporting evergreen guides help internal linking and conversion pre-qualification while matching local intent.",
    nextAction: "Create a supporting guide and internally link it to service page + conversion path.",
    keywordSuggestions: uniqueStrings([
      `${location} ${service} guide`,
      `${service} maintenance checklist`,
      `${service} tips ${location}`,
    ]),
    dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
  });

  // 4) GSC-gap inspired blog/supporting angle (medium)
  if (input.lowCtrPageCount > 0 || input.openGrowthTaskKeys.includes("refresh_low_ctr_pages")) {
    out.push({
      type: "supporting",
      topic: `${service} buyer questions (${location})`,
      priority: "medium",
      reason:
        "Growth cadence flagged low-CTR/refinement work; question-led content can lift CTR and support refresh tasks.",
      nextAction: "Publish one question-led post and test title/meta variants for CTR improvements.",
      keywordSuggestions: uniqueStrings([
        `why choose ${service} ${location}`,
        `is ${service} worth it ${location}`,
        `${service} vs alternatives ${location}`,
      ]),
      dueDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
    });
  }

  // 5) GEO tie-in: llms + FAQ/schema update opportunity (medium)
  out.push({
    type: "faq",
    topic: `Update llms + FAQ schema for ${service}`,
    priority: "medium",
    reason:
      "GEO visibility improves when llms.txt positioning, FAQ answers, and schema stay in sync with service/location language.",
    nextAction: "Refresh llms.txt positioning and ensure FAQ/Service schema reflects current offer and area served.",
    keywordSuggestions: uniqueStrings([
      `${service} ${location} faq`,
      `${service} area served`,
      `${service} local service ${location}`,
    ]),
    dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
  });

  return out.slice(0, 5);
}
