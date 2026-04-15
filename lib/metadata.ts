import type { SiteBriefModel } from "@/lib/site-brief";

export const PAGE_TYPES = ["homepage", "service", "location", "blog", "about"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export type MetadataOption = {
  title: string;
  metaDescription: string;
  reasoning: string;
  fitNote: string;
};

function smartTrim(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const i = cut.lastIndexOf(" ");
  return `${(i > 20 ? cut.slice(0, i) : cut).trim()}…`;
}

function service(brief: SiteBriefModel, fallback?: string | null): string {
  return fallback?.trim() || brief.primaryServices[0] || "Growth services";
}

function outcome(goal: string): string {
  const g = goal.toLowerCase();
  if (/call|book|appointment/.test(g)) return "booked calls";
  if (/lead|form|quote/.test(g)) return "qualified leads";
  if (/sale|revenue|order/.test(g)) return "revenue growth";
  return "measurable growth";
}

function loc(brief: SiteBriefModel): string {
  return brief.serviceArea[0] || "your area";
}

function maybeLocation(brief: SiteBriefModel): string {
  if (brief.marketFocus === "local" || brief.marketFocus === "regional") return loc(brief);
  return "";
}

function titleForType(brief: SiteBriefModel, pageType: PageType, linkedService?: string | null, topicHint?: string): string {
  const brand = brief.businessName;
  const svc = service(brief, linkedService);
  const out = outcome(brief.primaryConversionGoal);
  const location = maybeLocation(brief);
  switch (pageType) {
    case "homepage":
      return smartTrim(`${brand} | ${svc} & ${out}`, 60);
    case "service":
      return smartTrim(location ? `${svc} | ${brand} - ${location}` : `${svc} | ${brand}`, 60);
    case "location":
      return smartTrim(`${svc} ${loc(brief)} | ${brand}`, 60);
    case "blog":
      return smartTrim(`${topicHint?.trim() || `How ${svc} drives ${out}`} | ${brand}`, 60);
    case "about":
      return smartTrim(`${brand} | Trusted ${brief.brandTone} team`, 60);
    default:
      return smartTrim(`${brand} | ${svc}`, 60);
  }
}

function metaForType(brief: SiteBriefModel, pageType: PageType, linkedService?: string | null, topicHint?: string): string {
  const svc = service(brief, linkedService);
  const audience = brief.targetAudience || "growth-focused teams";
  const out = outcome(brief.primaryConversionGoal);
  const location = maybeLocation(brief);
  const locationLine =
    brief.marketFocus === "local"
      ? ` Serving ${loc(brief)} and nearby metro areas.`
      : brief.marketFocus === "regional"
        ? ` Serving ${brief.serviceArea.join(", ")}.`
        : brief.marketFocus === "dual"
          ? ` Local execution in ${loc(brief)} with national growth reach.`
          : " Serving clients nationwide.";

  switch (pageType) {
    case "homepage":
      return smartTrim(`${brief.businessName} helps ${audience} with ${svc}.${locationLine} Built for ${out}.`, 155);
    case "service":
      return smartTrim(`${svc} for ${audience}.${location ? ` In ${location}.` : ""} Designed for ${out}.`, 155);
    case "location":
      return smartTrim(`${svc} in ${loc(brief)} for ${audience}. Clear process, measurable ${out}.`, 155);
    case "blog":
      return smartTrim(
        `${topicHint?.trim() || `Practical guidance on ${svc}`}. Useful for ${audience}. Written with clear next steps.`,
        155,
      );
    case "about":
      return smartTrim(
        `${brief.businessName} is a ${brief.brandTone} team focused on ${svc} and ${out}.${locationLine}`,
        155,
      );
    default:
      return smartTrim(`${brief.businessName} delivers ${svc} for ${audience}.`, 155);
  }
}

function withVariant(base: string, variant: 0 | 1 | 2): string {
  if (variant === 0) return base;
  if (variant === 1) return base.replace(" | ", " — ").replace(" & ", " + ");
  return base.replace(" | ", " • ");
}

/** Deterministic: exactly 3 metadata options, each with reasoning + fit note. */
export function buildMetadataOptions(input: {
  brief: SiteBriefModel;
  pageType: PageType;
  linkedService?: string | null;
  topicHint?: string;
}): [MetadataOption, MetadataOption, MetadataOption] {
  const baseTitle = titleForType(input.brief, input.pageType, input.linkedService, input.topicHint);
  const baseMeta = metaForType(input.brief, input.pageType, input.linkedService, input.topicHint);
  const commonReason =
    "Generated from onboarding brief fields (services, audience, market focus, conversion goal) plus selected page type; URL is not the primary signal.";

  const options: [MetadataOption, MetadataOption, MetadataOption] = [0, 1, 2].map((v) => ({
    title: smartTrim(withVariant(baseTitle, v as 0 | 1 | 2), 60),
    metaDescription: smartTrim(baseMeta, 155),
    reasoning: commonReason,
    fitNote:
      v === 0
        ? "Highest-fit baseline for consistency."
        : v === 1
          ? "Alternative punctuation/tone while preserving intent."
          : "Compact variant for tighter SERP display.",
  })) as unknown as [MetadataOption, MetadataOption, MetadataOption];

  return options;
}
