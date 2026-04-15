export type PerformanceGuidanceItem = {
  kind: "performance" | "seo" | "accessibility";
  message: string;
  href: string;
};

/**
 * Advisory guidance only. These recommendations do not block launch readiness.
 */
export function buildPerformanceGuidance(input: {
  siteId: string;
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
}): PerformanceGuidanceItem[] {
  const out: PerformanceGuidanceItem[] = [];
  if ((input.performanceScore ?? 100) < 80) {
    out.push({
      kind: "performance",
      message: "Performance score is below 80. Review caching, image compression, and script weight.",
      href: `#launch-checklist`,
    });
  }
  if ((input.seoScore ?? 100) < 80) {
    out.push({
      kind: "seo",
      message: "SEO score is below 80. Re-check metadata and on-page baseline items.",
      href: `/sites/${input.siteId}/metadata`,
    });
  }
  if ((input.accessibilityScore ?? 100) < 90) {
    out.push({
      kind: "accessibility",
      message: "Accessibility score is below 90. Run an accessibility pass for labels, contrast, and heading structure.",
      href: `#launch-checklist`,
    });
  }
  return out;
}
