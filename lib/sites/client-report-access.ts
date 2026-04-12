/**
 * Client-facing URLs use an unguessable token → siteId map (not the raw site id).
 *
 * Set env `CLIENT_REPORT_TOKENS_JSON` to a JSON object, e.g.:
 *   {"long-random-string-1":"clxxxxxxxxsiteid1","another-token":"clxxxxxxxxx2"}
 *
 * Routes: `/report/<token>` (full narrative report), `/portal/<token>` (hub: status + link to report).
 *
 * Optional: `CLIENT_REPORT_BRAND_NAME` — shown in the report layout header (server-only).
 * Portal product shell: `NEXT_PUBLIC_PORTAL_*` in `lib/product-portal/offering.ts`.
 */

export function resolveClientReportSiteId(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  const raw = process.env.CLIENT_REPORT_TOKENS_JSON?.trim();
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, unknown>;
    const siteId = map[t];
    return typeof siteId === "string" && siteId.length > 0 ? siteId : null;
  } catch {
    return null;
  }
}

export function clientReportBrandName(): string {
  return process.env.CLIENT_REPORT_BRAND_NAME?.trim() || "Program status";
}
