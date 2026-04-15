import { buildKeywordSuggestions } from "@/lib/keywords";
import { PAGE_TYPES, type PageType, buildMetadataOptions } from "@/lib/metadata";
import { buildSiteBriefFromSite, parseMarketFocus as parseMarketFocusFromBrief, type SiteBriefModel } from "@/lib/site-brief";

export { PAGE_TYPES, type PageType };

export type MarketFocus = ReturnType<typeof parseMarketFocus>;

export function parsePageType(raw: string | null | undefined): PageType | null {
  const v = (raw ?? "").trim();
  return PAGE_TYPES.includes(v as PageType) ? (v as PageType) : null;
}

export function parseMarketFocus(raw: string | null | undefined) {
  return parseMarketFocusFromBrief(raw);
}

export function mergePrimaryServiceNames(primaryFocus: string | null | undefined, catalogNames: string[]): string[] {
  const merged = [primaryFocus ?? "", ...catalogNames]
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return merged.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export type SeoOnboardingBrief = SiteBriefModel & { serviceAreaOrLocation?: string };

export type MetadataSuggestionContext = {
  pageType: PageType;
  linkedServiceName?: string | null;
  blogTopicHint?: string;
  locationOverride?: string;
};

export function buildMetadataSuggestions(brief: SeoOnboardingBrief, ctx: MetadataSuggestionContext) {
  const normalized = {
    ...brief,
    serviceArea: brief.serviceArea?.length
      ? brief.serviceArea
      : (brief.serviceAreaOrLocation ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
  };
  const options = buildMetadataOptions({
    brief: normalized,
    pageType: ctx.pageType,
    linkedService: ctx.linkedServiceName,
    topicHint: ctx.blogTopicHint,
  });
  const keywords = buildKeywordSuggestions({
    brief: normalized,
    pageKind: ctx.pageType === "blog" ? "blog-support" : "service",
  });
  return {
    suggestedTitle: options[0].title,
    titleReasoning: options[0].reasoning,
    suggestedMetaDescription: options[0].metaDescription,
    metaReasoning: options[0].reasoning,
    keywords: keywords.map((k) => ({
      phrase: k.keyword,
      reasoning: k.reasoning,
      relevanceScore: k.relevanceScore,
      opportunityScore: k.opportunityScore,
      intent: k.intent,
      rankScore: k.weightedScore,
    })) as [
      { phrase: string; reasoning: string; relevanceScore: number; opportunityScore: number; intent: string; rankScore: number },
      { phrase: string; reasoning: string; relevanceScore: number; opportunityScore: number; intent: string; rankScore: number },
      { phrase: string; reasoning: string; relevanceScore: number; opportunityScore: number; intent: string; rankScore: number },
    ],
    confidenceNote: "Deterministic fit based on stored Site brief fields and selected page type.",
    confirmPrompt: "Review and confirm before applying.",
  };
}

export { buildSiteBriefFromSite };
