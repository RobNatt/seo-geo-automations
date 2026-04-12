export const REPORT_TEMPLATE_IDS = ["monthly_seo", "geo_focus", "launch_readiness"] as const;

export type ReportTemplateId = (typeof REPORT_TEMPLATE_IDS)[number];

export const REPORT_TEMPLATE_LABEL: Record<ReportTemplateId, string> = {
  monthly_seo: "Monthly SEO",
  geo_focus: "Monthly GEO",
  launch_readiness: "Launch readiness",
};
