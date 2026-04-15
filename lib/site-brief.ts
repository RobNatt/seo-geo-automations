export const MARKET_FOCUS = ["local", "regional", "national", "dual"] as const;
export type MarketFocus = (typeof MARKET_FOCUS)[number];

export const BRAND_TONES = ["professional", "friendly", "technical", "outcome-led"] as const;
export type BrandTone = (typeof BRAND_TONES)[number];

export type SiteBriefModel = {
  businessName: string;
  primaryServices: string[];
  targetAudience: string;
  marketFocus: MarketFocus;
  serviceArea: string[];
  primaryConversionGoal: string;
  brandTone: BrandTone;
  optionalPriorityKeyword?: string;
  geoAreaNoteVisible: string;
};

type SiteBriefDbShape = {
  businessName: string;
  primaryFocus: string | null;
  primaryServices: unknown;
  targetAudience: string | null;
  marketFocus: string | null;
  serviceArea: unknown;
  geoHint: string | null;
  primaryConversionGoal: string | null;
  brandTone: string | null;
  optionalPriorityKeyword: string | null;
  priorityKeyword: string | null;
  geoAreaNoteVisible: string | null;
};

export function parseMarketFocus(raw: string | null | undefined): MarketFocus {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "local" || v === "regional" || v === "national" || v === "dual") return v;
  return "local";
}

export function parseBrandTone(raw: string | null | undefined): BrandTone {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "professional" || v === "friendly" || v === "technical" || v === "outcome-led") return v;
  return "outcome-led";
}

function parseStringList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x): x is string => Boolean(x));
  }
  return [];
}

function dedupe(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const t = item.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Accept comma/newline separated values from forms for primaryServices/serviceArea. */
export function parseListInput(raw: string): string[] {
  return dedupe(
    raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function buildSiteBriefFromSite(site: SiteBriefDbShape): SiteBriefModel {
  const parsedServices = parseStringList(site.primaryServices);
  const fallbackServices = site.primaryFocus?.trim() ? [site.primaryFocus.trim()] : [];
  const primaryServices = dedupe([...parsedServices, ...fallbackServices]);

  const serviceArea = dedupe([...parseStringList(site.serviceArea), ...(site.geoHint?.trim() ? [site.geoHint.trim()] : [])]);

  const optionalPriorityKeyword = site.optionalPriorityKeyword?.trim() || site.priorityKeyword?.trim() || undefined;

  return {
    businessName: site.businessName.trim(),
    primaryServices,
    targetAudience: site.targetAudience?.trim() ?? "",
    marketFocus: parseMarketFocus(site.marketFocus),
    serviceArea,
    primaryConversionGoal: site.primaryConversionGoal?.trim() ?? "",
    brandTone: parseBrandTone(site.brandTone),
    optionalPriorityKeyword,
    geoAreaNoteVisible: site.geoAreaNoteVisible?.trim() ?? "",
  };
}
