export type LighthouseCategoryScores = {
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  auditUrl: string;
};

function toScore(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

/**
 * Runs a Lighthouse-backed audit via Google PageSpeed API.
 * This is advisory only; callers should handle failures gracefully.
 */
export async function runLighthouseAuditForUrl(url: string): Promise<LighthouseCategoryScores> {
  const encoded = encodeURIComponent(url);
  const endpoint =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
    `?url=${encoded}` +
    "&strategy=mobile" +
    "&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO";

  const res = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
    headers: { "accept": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`PageSpeed request failed (${res.status})`);
  }

  const json = (await res.json()) as {
    lighthouseResult?: {
      categories?: Record<string, { score?: number }>;
      finalDisplayedUrl?: string;
      finalUrl?: string;
    };
  };

  const categories = json.lighthouseResult?.categories ?? {};
  const finalUrl =
    json.lighthouseResult?.finalDisplayedUrl?.trim() ||
    json.lighthouseResult?.finalUrl?.trim() ||
    url;

  return {
    performanceScore: toScore(categories.performance?.score),
    accessibilityScore: toScore(categories.accessibility?.score),
    bestPracticesScore: toScore(categories["best-practices"]?.score),
    seoScore: toScore(categories.seo?.score),
    auditUrl: `https://pagespeed.web.dev/report?url=${encodeURIComponent(finalUrl)}`,
  };
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "text-zinc-500";
  if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function isOlderThanDays(date: Date | null | undefined, days: number): boolean {
  if (!date) return true;
  const ageMs = Date.now() - date.getTime();
  return ageMs > days * 24 * 60 * 60 * 1000;
}
