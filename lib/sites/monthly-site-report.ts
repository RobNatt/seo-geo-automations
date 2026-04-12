/**
 * @deprecated Prefer `loadSiteReportSnapshot` + `renderSiteReportTemplate("monthly_seo", …)` from `report-templates`.
 */
import {
  loadSiteReportSnapshot,
  previousMonthRangeUtc,
  renderSiteReportTemplate,
} from "@/lib/sites/report-templates";

export { previousMonthRangeUtc };

export async function buildMonthlySiteReportPlainText(
  siteId: string,
  options?: { generatedAt?: Date },
): Promise<string | null> {
  const snap = await loadSiteReportSnapshot(siteId, { generatedAt: options?.generatedAt });
  if (!snap) return null;
  return renderSiteReportTemplate("monthly_seo", snap);
}
