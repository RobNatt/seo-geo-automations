/**
 * Rule-based, deterministic SEO metadata + keyword suggestions.
 * Onboarding brief fields are the source of truth; URL is not used as a primary signal.
 */

export const PAGE_TYPES = ["homepage", "service", "location", "blog", "about", "other"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export function parsePageType(raw: string | null | undefined): PageType | null {
  const v = (raw ?? "").trim() as PageType;
  return PAGE_TYPES.includes(v) ? v : null;
}

export const MARKET_FOCUS = ["local", "regional", "national"] as const;
export type MarketFocus = (typeof MARKET_FOCUS)[number];

export type SeoOnboardingBrief = {
  businessName: string;
  /** Ordered service lines (primary focus + catalog names). */
  primaryServices: string[];
  targetAudience: string;
  marketFocus: MarketFocus;
  /** Service area, city, or region phrase from onboarding. */
  serviceAreaOrLocation: string;
  primaryConversionGoal: string;
  priorityKeyword?: string;
};

export type MetadataSuggestionContext = {
  pageType: PageType;
  /** Linked service name for this URL (catalog), when relevant. */
  linkedServiceName?: string | null;
  /** User hint for blog/support editorial angle. */
  blogTopicHint?: string;
  /** Explicit location line for location pages if different from geo hint. */
  locationOverride?: string;
};

export type KeywordSuggestion = {
  phrase: string;
  reasoning: string;
  relevanceScore: number;
  opportunityScore: number;
  intent: "informational" | "commercial" | "transactional" | "navigational";
  rankScore: number;
};

export type MetadataSuggestionsResult = {
  suggestedTitle: string;
  titleReasoning: string;
  suggestedMetaDescription: string;
  metaReasoning: string;
  keywords: [KeywordSuggestion, KeywordSuggestion, KeywordSuggestion];
  confidenceNote: string;
  confirmPrompt: string;
};

const TITLE_MAX = 58;
const META_MAX = 155;

export const CONFIRM_PROMPT =
  "Review each field. Nothing is saved to the page until you click Apply on the metadata page and confirm.";

function clampTitle(s: string): string {
  return truncateSmart(s, TITLE_MAX);
}

function clampMeta(s: string): string {
  return truncateSmart(s, META_MAX);
}

function truncateSmart(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 20 ? cut.slice(0, lastSpace) : cut;
  return `${base}…`;
}

function normalizeMarketFocus(raw: string | null | undefined): MarketFocus {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "local" || v === "regional" || v === "national") return v;
  return "national";
}

/** Public helper when reading from DB. */
export function parseMarketFocus(raw: string | null | undefined): MarketFocus {
  return normalizeMarketFocus(raw);
}

function coreService(brief: SeoOnboardingBrief, ctx: MetadataSuggestionContext): string {
  if (ctx.pageType === "service" && ctx.linkedServiceName?.trim()) return ctx.linkedServiceName.trim();
  const first = brief.primaryServices.map((s) => s.trim()).find(Boolean);
  return first ?? "services";
}

function outcomeFromGoal(goal: string): string {
  const g = goal.toLowerCase();
  if (/call|phone|ring/i.test(g)) return "Speak with our team today";
  if (/book|schedule|appointment|visit/i.test(g)) return "Book your appointment online";
  if (/quote|estimate|form|lead|contact/i.test(g)) return "Request a fast quote";
  if (/buy|shop|order|purchase/i.test(g)) return "Shop with confidence";
  return "Get started with us";
}

function includeLocationLanguage(focus: MarketFocus): boolean {
  return focus === "local" || focus === "regional";
}

function locationPhrase(brief: SeoOnboardingBrief, ctx: MetadataSuggestionContext): string {
  const o = (ctx.locationOverride ?? "").trim();
  if (o) return o;
  return (brief.serviceAreaOrLocation ?? "").trim();
}

function differentiator(brief: SeoOnboardingBrief): string {
  const aud = brief.targetAudience.trim();
  if (aud) return `Trusted by ${truncateSmart(aud, 40)}`;
  return `Trusted ${brief.businessName.trim()} team`;
}

function buildTitle(brief: SeoOnboardingBrief, ctx: MetadataSuggestionContext): { text: string; reasoning: string } {
  const brand = brief.businessName.trim();
  const service = coreService(brief, ctx);
  const outcome = outcomeFromGoal(brief.primaryConversionGoal);
  const loc = locationPhrase(brief, ctx);
  const locBit = includeLocationLanguage(brief.marketFocus) && loc ? ` in ${truncateSmart(loc, 28)}` : "";

  switch (ctx.pageType) {
    case "homepage": {
      const text = clampTitle(`${brand} | ${service} — ${outcome}`);
      return {
        text,
        reasoning:
          "Homepage pattern: brand plus core service from the onboarding brief (not the URL), plus a conversion-aligned outcome phrase derived from the stated primary goal.",
      };
    }
    case "service": {
      const diff = differentiator(brief);
      const text = clampTitle(
        locBit ? `${service}${locBit} | ${brand}` : `${service} by ${brand} — ${truncateSmart(diff, 32)}`,
      );
      return {
        text,
        reasoning:
          "Service page: emphasize the service line (catalog link when present, otherwise onboarding primary services). Location language is added only for local/regional market focus.",
      };
    }
    case "location": {
      const text = clampTitle(
        loc ? `${service} in ${truncateSmart(loc, 36)} | ${brand}` : `${service} locations | ${brand}`,
      );
      return {
        text,
        reasoning:
          "Location page: pair service with the service area or city phrase from the brief (or the location override field).",
      };
    }
    case "blog": {
      const topic = (ctx.blogTopicHint ?? "").trim() || "Answers to common questions";
      const text = clampTitle(`${topic} | ${brand}`);
      return {
        text,
        reasoning:
          "Blog/support: lead with the editorial topic or question hint; brand last for recognition without keyword stuffing.",
      };
    }
    case "about": {
      const text = clampTitle(`About ${brand} — ${truncateSmart(differentiator(brief), 40)}`);
      return {
        text,
        reasoning: "About page: brand plus trust signal tied to target audience from the onboarding brief.",
      };
    }
    default: {
      const text = clampTitle(`${brand} — ${service}`);
      return {
        text,
        reasoning:
          "General page: conservative brand + service fallback because page type is other/unspecified.",
      };
    }
  }
}

function buildMeta(brief: SeoOnboardingBrief, ctx: MetadataSuggestionContext, title: string): { text: string; reasoning: string } {
  const brand = brief.businessName.trim();
  const service = coreService(brief, ctx);
  const audience = brief.targetAudience.trim();
  const loc = locationPhrase(brief, ctx);
  const goalLine = outcomeFromGoal(brief.primaryConversionGoal);
  const locSentence =
    includeLocationLanguage(brief.marketFocus) && loc
      ? ` Serving ${truncateSmart(loc, 48)}.`
      : brief.marketFocus === "national" ? " Serving customers nationwide." : "";

  switch (ctx.pageType) {
    case "homepage": {
      const text = clampMeta(
        `${brand} offers ${service.toLowerCase()}${audience ? ` for ${truncateSmart(audience, 50)}` : ""}.${locSentence} ${goalLine}.`,
      );
      return {
        text,
        reasoning:
          "Homepage meta: business name, core service, audience from brief, optional geo sentence when local/regional, CTA aligned to conversion goal.",
      };
    }
    case "service": {
      const text = clampMeta(
        `Explore ${service} with ${brand}.${locSentence}${audience ? ` Built for ${truncateSmart(audience, 44)}.` : ""} ${goalLine}.`,
      );
      return {
        text,
        reasoning:
          "Service meta: service + brand + audience; geo only when market focus is local/regional.",
      };
    }
    case "location": {
      const text = clampMeta(
        loc
          ? `${brand} — ${service} in ${truncateSmart(loc, 44)}.${audience ? ` For ${truncateSmart(audience, 40)}.` : ""} ${goalLine}.`
          : `${brand} ${service} locations.${audience ? ` Serving ${truncateSmart(audience, 44)}.` : ""} ${goalLine}.`,
      );
      return {
        text,
        reasoning: "Location meta: service + explicit place + audience + goal-based CTA.",
      };
    }
    case "blog": {
      const topic = (ctx.blogTopicHint ?? "").trim() || "this topic";
      const text = clampMeta(
        `${truncateSmart(topic, 70)} — practical guidance from ${brand}.${audience ? ` For ${truncateSmart(audience, 36)}.` : ""} ${goalLine}.`,
      );
      return {
        text,
        reasoning:
          "Blog meta: question/topic first (informational intent), brand for E-E-A-T, light CTA.",
      };
    }
    case "about": {
      const text = clampMeta(
        `Learn why ${brand} is a trusted choice${audience ? ` for ${truncateSmart(audience, 48)}` : ""}.${locSentence} ${goalLine}.`,
      );
      return {
        text,
        reasoning: "About meta: trust + audience fit; geo sentence mirrors market focus rules.",
      };
    }
    default: {
      const text = clampMeta(`${title}. ${brand} — ${service}.${locSentence} ${goalLine}.`);
      return {
        text,
        reasoning: "Fallback meta echoes title with brief-derived service and CTA.",
      };
    }
  }
}

function scoreKeyword(
  phrase: string,
  brief: SeoOnboardingBrief,
  ctx: MetadataSuggestionContext,
): Pick<KeywordSuggestion, "relevanceScore" | "opportunityScore" | "intent"> {
  let relevance = 55;
  let opportunity = 50;
  let intent: KeywordSuggestion["intent"] = "commercial";

  const p = phrase.toLowerCase();
  const service = coreService(brief, ctx).toLowerCase();
  const brand = brief.businessName.toLowerCase();
  const loc = locationPhrase(brief, ctx).toLowerCase();

  if (p.includes(service)) relevance += 20;
  if (brief.priorityKeyword && p.includes(brief.priorityKeyword.toLowerCase())) relevance += 15;
  if (brand && p.includes(brand)) {
    relevance += 5;
    intent = "navigational";
  }

  const words = p.split(/\s+/).length;
  if (words >= 4) opportunity += 18;
  else if (words === 3) opportunity += 10;

  if ((brief.marketFocus === "local" || brief.marketFocus === "regional") && loc && p.includes(loc.split(",")[0]!.trim())) {
    opportunity += 15;
    relevance += 10;
  }

  if (/^how\b|what\b|why\b|when\b|best\b/i.test(phrase)) {
    opportunity += 12;
    intent = "informational";
  }

  if (/near me|in my area/i.test(p)) {
    opportunity += 10;
    intent = "transactional";
  }

  if (/price|cost|book|schedule|quote/i.test(p)) intent = "transactional";

  relevance = Math.min(100, relevance);
  opportunity = Math.min(100, opportunity);

  return { relevanceScore: relevance, opportunityScore: opportunity, intent };
}

function rankScore(k: Pick<KeywordSuggestion, "relevanceScore" | "opportunityScore" | "intent">): number {
  const intentBoost = k.intent === "informational" && k.opportunityScore > 60 ? 5 : 0;
  return k.relevanceScore * 2 + k.opportunityScore + intentBoost;
}

function buildKeywordCandidates(brief: SeoOnboardingBrief, ctx: MetadataSuggestionContext): KeywordSuggestion[] {
  const service = coreService(brief, ctx);
  const loc = locationPhrase(brief, ctx);
  const aud = brief.targetAudience.trim();
  const pk = brief.priorityKeyword?.trim();
  const brand = brief.businessName.trim();

  const candidates: string[] = [];

  if (pk) candidates.push(pk);

  if (brief.marketFocus === "local" || brief.marketFocus === "regional") {
    if (loc) {
      candidates.push(`${service} in ${loc.split(",")[0]!.trim()}`);
      candidates.push(`best ${service.toLowerCase()} near ${loc.split(",")[0]!.trim()}`);
    } else {
      candidates.push(`local ${service.toLowerCase()} services`);
    }
  } else {
    candidates.push(`${service} for ${aud || "businesses"}`);
  }

  candidates.push(`affordable ${service.toLowerCase()} ${brand}`.trim());

  if (ctx.pageType === "blog" || ctx.pageType === "other") {
    const topic = (ctx.blogTopicHint ?? "").trim() || service;
    candidates.push(`how to choose ${service.toLowerCase()} for ${aud || "your needs"}`);
    candidates.push(`what to know before hiring ${service.toLowerCase()}`);
    candidates.push(`${topic} explained`);
  }

  if (ctx.pageType === "location" && loc) {
    candidates.push(`${service} ${loc}`);
  }

  const seen = new Set<string>();
  const unique = candidates
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => {
      const k = c.toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  const scored = unique.map((phrase) => {
    const { relevanceScore, opportunityScore, intent } = scoreKeyword(phrase, brief, ctx);
    const out: KeywordSuggestion = {
      phrase,
      reasoning: explainKeyword(phrase, brief, ctx),
      relevanceScore,
      opportunityScore,
      intent,
      rankScore: 0,
    };
    out.rankScore = rankScore(out);
    return out;
  });

  scored.sort((a, b) => b.rankScore - a.rankScore);
  return scored;
}

function explainKeyword(phrase: string, brief: SeoOnboardingBrief, ctx: MetadataSuggestionContext): string {
  const parts: string[] = [];
  if (brief.priorityKeyword && phrase.toLowerCase().includes(brief.priorityKeyword.toLowerCase())) {
    parts.push("Incorporates the optional priority keyword from your brief.");
  }
  if (brief.marketFocus === "local" || brief.marketFocus === "regional") {
    parts.push("Local-first market: favors service + place long-tail.");
  } else {
    parts.push("National positioning: favors service + audience framing over city stuffing.");
  }
  if (/^how\b|what\b|why\b/i.test(phrase)) {
    parts.push("Question shape suits informational/blog intent.");
  }
  if (ctx.pageType === "service" && ctx.linkedServiceName) {
    parts.push("Aligned with the catalog service attached to this page.");
  }
  return parts.join(" ") || "Derived from onboarding services and market focus rules.";
}

function pickTopThree(
  scored: KeywordSuggestion[],
  brief: SeoOnboardingBrief,
  ctx: MetadataSuggestionContext,
): [KeywordSuggestion, KeywordSuggestion, KeywordSuggestion] {
  const service = coreService(brief, ctx);
  const brand = brief.businessName.trim();
  const pads = [
    `${service} ${brand}`.trim(),
    `${service} services`.trim(),
    `professional ${service.toLowerCase()} help`,
  ];
  let i = 0;
  const pad = (phrase: string): KeywordSuggestion => {
    const { relevanceScore, opportunityScore, intent } = scoreKeyword(phrase, brief, ctx);
    const row: KeywordSuggestion = {
      phrase,
      reasoning: "Fallback long-tail to reach three suggestions when fewer unique candidates were generated.",
      relevanceScore,
      opportunityScore,
      intent,
      rankScore: 0,
    };
    row.rankScore = rankScore(row);
    return row;
  };

  const out = scored.slice(0, 3);
  while (out.length < 3 && i < pads.length) {
    const phrase = pads[i++]!;
    if (out.some((x) => x.phrase.toLowerCase() === phrase.toLowerCase())) continue;
    out.push(pad(phrase));
  }
  let n = 0;
  while (out.length < 3 && n < 6) {
    n += 1;
    const phrase = `${service} experts (${n})`;
    if (out.some((x) => x.phrase.toLowerCase() === phrase.toLowerCase())) continue;
    out.push(pad(phrase));
  }
  return [out[0]!, out[1]!, out[2]!];
}

function confidenceNote(brief: SeoOnboardingBrief, ctx: MetadataSuggestionContext): string {
  const gaps: string[] = [];
  if (!brief.targetAudience.trim()) gaps.push("target audience");
  if (!brief.primaryConversionGoal.trim()) gaps.push("conversion goal");
  if (!brief.serviceAreaOrLocation.trim() && (brief.marketFocus === "local" || brief.marketFocus === "regional")) {
    gaps.push("service area / location");
  }
  if (!brief.primaryServices.length) gaps.push("primary services");
  if (ctx.pageType === "blog" && !(ctx.blogTopicHint ?? "").trim()) gaps.push("blog topic hint");

  if (gaps.length === 0) return "High fit: core brief fields are present, so suggestions are tightly grounded.";
  if (gaps.length <= 2) return `Medium fit: add ${gaps.join(", ")} to tighten copy and keyword relevance.`;
  return `Low fit: several brief fields are missing (${gaps.join(", ")}); review before applying.`;
}

export function buildMetadataSuggestions(
  brief: SeoOnboardingBrief,
  ctx: MetadataSuggestionContext,
): MetadataSuggestionsResult {
  const { text: suggestedTitle, reasoning: titleReasoning } = buildTitle(brief, ctx);
  const { text: suggestedMetaDescription, reasoning: metaReasoning } = buildMeta(brief, ctx, suggestedTitle);
  const scored = buildKeywordCandidates(brief, ctx);
  const keywords = pickTopThree(scored, brief, ctx);

  return {
    suggestedTitle,
    titleReasoning,
    suggestedMetaDescription,
    metaReasoning,
    keywords,
    confidenceNote: confidenceNote(brief, ctx),
    confirmPrompt: CONFIRM_PROMPT,
  };
}

/** Aggregate service lines: primary focus first, then distinct catalog names for the site. */
export function mergePrimaryServiceNames(primaryFocus: string | null | undefined, catalogNames: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  if (primaryFocus) push(primaryFocus);
  for (const n of catalogNames) push(n);
  return out;
}
