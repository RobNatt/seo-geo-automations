import type { MarketFocus, SiteBriefModel } from "@/lib/site-brief";

export type KeywordIntent = "commercial" | "informational" | "navigational";

export type KeywordSuggestion = {
  keyword: string;
  reasoning: string;
  relevanceScore: number;
  opportunityScore: number;
  intentScore: number;
  weightedScore: number;
  intent: KeywordIntent;
};

export function weightedKeywordScore(input: {
  relevanceScore: number;
  opportunityScore: number;
  intentScore: number;
}): number {
  return Math.round(input.relevanceScore * 0.5 + input.opportunityScore * 0.3 + input.intentScore * 0.2);
}

function baseIntentScore(keyword: string): { intent: KeywordIntent; score: number } {
  const k = keyword.toLowerCase();
  if (/how|what|why|when|guide|tips/.test(k)) return { intent: "informational", score: 72 };
  if (/near me|best|agency|services|company|quote|book|hire|pricing/.test(k)) return { intent: "commercial", score: 84 };
  if (/^n-?tech|brand/i.test(k)) return { intent: "navigational", score: 70 };
  return { intent: "commercial", score: 76 };
}

function relevance(keyword: string, brief: SiteBriefModel): number {
  const lower = keyword.toLowerCase();
  let score = 40;
  for (const service of brief.primaryServices) {
    if (lower.includes(service.toLowerCase())) score += 20;
  }
  if (brief.optionalPriorityKeyword && lower.includes(brief.optionalPriorityKeyword.toLowerCase())) score += 10;
  if (brief.targetAudience && lower.includes(brief.targetAudience.toLowerCase())) score += 6;
  return Math.min(100, score);
}

function opportunity(keyword: string): number {
  const words = keyword.trim().split(/\s+/).length;
  let score = 45;
  if (words >= 5) score += 30;
  else if (words === 4) score += 22;
  else if (words === 3) score += 14;
  if (/near me|omaha|metro|small business|for /.test(keyword.toLowerCase())) score += 10;
  if (/seo$|geo$|marketing$|design$/.test(keyword.toLowerCase())) score -= 12;
  return Math.max(0, Math.min(100, score));
}

function city(brief: SiteBriefModel): string {
  return brief.serviceArea[0] ?? "your city";
}

function metro(brief: SiteBriefModel): string {
  return brief.serviceArea[1] ?? "your metro";
}

function makeKeywordPool(brief: SiteBriefModel, pageKind: "blog-support" | "service"): string[] {
  const service = brief.primaryServices[0] ?? "seo services";
  const cityName = city(brief);
  const metroName = metro(brief);
  const pool: string[] = [];

  // 1) Service + long-tail
  pool.push(`${service} ${cityName} ${brief.primaryConversionGoal || "lead growth"}`.trim());
  // 2) Local service
  pool.push(`${service} ${cityName} ${brief.targetAudience || "small business"}`.trim());
  // 3) Question intent
  pool.push(`how long does ${service} take`);
  // 4) Branded service
  pool.push(`${brief.businessName} ${service} ${cityName}`.trim());
  // 5) Outcome-based
  pool.push(`grow leads with ${service}`);

  if (brief.marketFocus === "regional") pool.push(`${service} ${metroName} businesses`);
  if (brief.marketFocus === "national") pool.push(`${service} for ${brief.targetAudience || "growth teams"}`);
  if (brief.marketFocus === "dual") {
    pool.push(`${service} ${cityName} local execution`);
    pool.push(`${service} nationwide growth teams`);
  }

  if (pageKind === "blog-support") {
    pool.push(`what is the best ${service} strategy`);
    pool.push(`why ${service} matters for ${brief.targetAudience || "businesses"}`);
  }

  if (brief.optionalPriorityKeyword) pool.unshift(brief.optionalPriorityKeyword);

  const seen = new Set<string>();
  return pool.filter((k) => {
    const key = k.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function localVsNationalFilter(pool: string[], focus: MarketFocus, brief: SiteBriefModel): string[] {
  const cityName = city(brief).toLowerCase();
  const metroName = metro(brief).toLowerCase();
  if (focus === "local") return pool.filter((k) => k.toLowerCase().includes(cityName) || k.toLowerCase().includes(metroName));
  if (focus === "national") return pool.filter((k) => !k.toLowerCase().includes(cityName));
  return pool;
}

export function buildKeywordSuggestions(input: {
  brief: SiteBriefModel;
  pageKind?: "blog-support" | "service";
}): [KeywordSuggestion, KeywordSuggestion, KeywordSuggestion] {
  const pageKind = input.pageKind ?? "service";
  let pool = makeKeywordPool(input.brief, pageKind);
  pool = localVsNationalFilter(pool, input.brief.marketFocus, input.brief);
  if (pool.length < 3) pool = makeKeywordPool(input.brief, pageKind);

  const scored = pool.map((keyword) => {
    const relevanceScore = relevance(keyword, input.brief);
    const opportunityScore = opportunity(keyword);
    const i = baseIntentScore(keyword);
    const intentScore = i.score;
    const weightedScore = weightedKeywordScore({ relevanceScore, opportunityScore, intentScore });
    return {
      keyword,
      intent: i.intent,
      relevanceScore,
      opportunityScore,
      intentScore,
      weightedScore,
      reasoning:
        `Ranked by deterministic weighting (relevance 50%, low-competition opportunity 30%, intent 20%). ` +
        `This phrase matches your services and ${input.brief.marketFocus} focus.`,
    } satisfies KeywordSuggestion;
  });

  scored.sort((a, b) => b.weightedScore - a.weightedScore);
  return [scored[0]!, scored[1]!, scored[2]!];
}
