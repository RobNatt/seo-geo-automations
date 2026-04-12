/**
 * White-label product shell for selling the client-facing experience as a service.
 * Configure per deployment or white-label customer via NEXT_PUBLIC_* (safe for browser).
 *
 * Client access tokens use the same map as the narrative report:
 *   CLIENT_REPORT_TOKENS_JSON = {"<secret-token>":"<siteId>", ...}
 * Routes: /portal/<token> (hub) · /report/<token> (full written report)
 */

export const PORTAL_TOKEN_ENV_KEY = "CLIENT_REPORT_TOKENS_JSON" as const;

export function portalProductName(): string {
  return process.env.NEXT_PUBLIC_PORTAL_PRODUCT_NAME?.trim() || "Program portal";
}

export function portalOfferingTagline(): string {
  return (
    process.env.NEXT_PUBLIC_PORTAL_OFFERING_TAGLINE?.trim() ||
    "Status, reports, and next steps for your web visibility program — in one place."
  );
}

export function portalSupportLine(): string {
  return (
    process.env.NEXT_PUBLIC_PORTAL_SUPPORT_CONTACT?.trim() ||
    "Questions or changes? Contact your account team."
  );
}
