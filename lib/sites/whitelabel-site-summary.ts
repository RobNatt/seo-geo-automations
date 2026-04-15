/**
 * White-label site summary for site owners (?wl=1 or NEXT_PUBLIC_WHITELABEL_SITE_SUMMARY).
 * Use ?full=1 on /sites/[siteId] to force the full internal dashboard (and restore nav).
 */

export function isWhiteLabelSiteSummaryMode(searchParams: {
  wl?: string;
  full?: string;
  clientView?: string;
}): boolean {
  if (searchParams.full === "1") return false;
  if (searchParams.clientView === "1" || searchParams.clientView === "true") return true;
  if (searchParams.wl === "1" || searchParams.wl === "true") return true;
  const v = process.env.NEXT_PUBLIC_WHITELABEL_SITE_SUMMARY?.trim().toLowerCase();
  return v === "1" || v === "true";
}
