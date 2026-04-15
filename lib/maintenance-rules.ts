import { prisma } from "@/lib/db";

export type MaintenancePriority = "high" | "medium" | "low";

export type MaintenanceFinding = {
  triggerKey: string;
  triggerName: string;
  why: string;
  reason: string;
  nextAction: string;
  priority: MaintenancePriority;
};

type NapRecord = { name: string; address: string; phone: string };

function normalizeText(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(v: string): string {
  return v.replace(/[^\d+]/g, "");
}

function parseNap(input: unknown): NapRecord | null {
  if (!input || typeof input !== "object") return null;
  const rec = input as Record<string, unknown>;
  const name = String(rec.name ?? "").trim();
  const address = String(rec.address ?? "").trim();
  const phone = String(rec.phone ?? "").trim();
  if (!name && !address && !phone) return null;
  return { name, address, phone };
}

function isNapEqual(a: NapRecord, b: NapRecord): boolean {
  return (
    normalizeText(a.name) === normalizeText(b.name) &&
    normalizeText(a.address) === normalizeText(b.address) &&
    normalizePhone(a.phone) === normalizePhone(b.phone)
  );
}

function sameSet(a: string[], b: string[]): boolean {
  const sa = new Set(a.map(normalizeText));
  const sb = new Set(b.map(normalizeText));
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

export const MAINTENANCE_TRIGGER_COPY: Record<
  string,
  { name: string; why: string; defaultNextAction: string; priority: MaintenancePriority }
> = {
  nap_inconsistency: {
    name: "NAP inconsistency",
    why: "Canonical Name/Address/Phone must stay consistent across GBP, site, and directories.",
    defaultNextAction: "Update GBP first, then site footer/contact, then core directories to match canonical NAP.",
    priority: "high",
  },
  redirect_orphan_signals: {
    name: "Redirect chains / orphan signals",
    why: "Redirect chains and unresolved retired URLs waste crawl budget and dilute equity.",
    defaultNextAction: "Flatten redirects and replace retired links with final URLs in nav/content/sitemap.",
    priority: "medium",
  },
  sitemap_live_mismatch: {
    name: "Sitemap vs live routes mismatch",
    why: "Sitemap must mirror indexable live routes to avoid discovery/index drift.",
    defaultNextAction: "Update sitemap snapshot to match active pages; remove stale URLs and add missing live pages.",
    priority: "medium",
  },
  schema_validation_signals: {
    name: "Schema validation errors",
    why: "Schema errors reduce rich-result eligibility and AI extraction quality.",
    defaultNextAction: "Review latest schema-related check failures and fix JSON-LD output on affected templates.",
    priority: "high",
  },
  gsc_indexing_signals: {
    name: "GSC indexing errors",
    why: "Crawl errors/excluded pages indicate visibility regression risk.",
    defaultNextAction: "Investigate excluded/crawl error pages and resolve indexing directives or URL health issues.",
    priority: "high",
  },
  llms_positioning_drift: {
    name: "llms.txt positioning drift",
    why: "llms.txt should reflect current services and positioning to support AI citation quality.",
    defaultNextAction: "Refresh llms.txt summary to match current offers, service URLs, and positioning language.",
    priority: "medium",
  },
  meta_title_h1_drift: {
    name: "Meta/title/H1 drift",
    why: "Template drift can erode CTR and intent clarity on priority pages.",
    defaultNextAction: "Run metadata workspace review for priority pages and normalize title/meta/H1 intent alignment.",
    priority: "medium",
  },
};

export async function runMaintenanceChecks(siteId: string): Promise<MaintenanceFinding[]> {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return [];

  const pages = await prisma.page.findMany({
    where: { siteId, status: "active" },
    orderBy: { createdAt: "asc" },
  });
  const homepage = pages[0] ?? null;
  const latestRun = homepage
    ? await prisma.auditRun.findFirst({
        where: { pageId: homepage.id },
        orderBy: { startedAt: "desc" },
        include: { results: { orderBy: { checkKey: "asc" } } },
      })
    : null;

  const findings: MaintenanceFinding[] = [];

  // 1) NAP consistency (manual snapshots)
  const canonicalNap = parseNap(site.canonicalNap);
  const gbpNap = parseNap(site.gbpNap);
  const directoryNap = parseNap(site.directoryNap);
  if (!canonicalNap || !gbpNap || !directoryNap) {
    findings.push({
      triggerKey: "nap_inconsistency",
      triggerName: MAINTENANCE_TRIGGER_COPY.nap_inconsistency.name,
      why: MAINTENANCE_TRIGGER_COPY.nap_inconsistency.why,
      reason: "Canonical/GBP/directory NAP snapshots are incomplete.",
      nextAction: MAINTENANCE_TRIGGER_COPY.nap_inconsistency.defaultNextAction,
      priority: "medium",
    });
  } else {
    const mismatch = !isNapEqual(canonicalNap, gbpNap) || !isNapEqual(canonicalNap, directoryNap);
    if (mismatch) {
      findings.push({
        triggerKey: "nap_inconsistency",
        triggerName: MAINTENANCE_TRIGGER_COPY.nap_inconsistency.name,
        why: MAINTENANCE_TRIGGER_COPY.nap_inconsistency.why,
        reason: "NAP values differ between canonical record, GBP snapshot, and/or directory snapshot.",
        nextAction: MAINTENANCE_TRIGGER_COPY.nap_inconsistency.defaultNextAction,
        priority: "high",
      });
    }
  }

  // 2) Redirect/orphan signals from latest deterministic audit checks
  const redirectSignals =
    latestRun?.results.filter((r) => /redirect|orphan|404|broken_link/i.test(r.checkKey) && r.status !== "pass") ?? [];
  if (redirectSignals.length > 0) {
    findings.push({
      triggerKey: "redirect_orphan_signals",
      triggerName: MAINTENANCE_TRIGGER_COPY.redirect_orphan_signals.name,
      why: MAINTENANCE_TRIGGER_COPY.redirect_orphan_signals.why,
      reason: `Latest audit flagged ${redirectSignals.length} redirect/orphan-related checks.`,
      nextAction: MAINTENANCE_TRIGGER_COPY.redirect_orphan_signals.defaultNextAction,
      priority: "medium",
    });
  }

  // 3) Sitemap mismatch (manual sitemap snapshot vs active pages)
  const sitemapKnown = Array.isArray(site.sitemapKnownUrls)
    ? (site.sitemapKnownUrls as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];
  const activePageUrls = pages.map((p) => p.url);
  if (sitemapKnown.length > 0 && !sameSet(sitemapKnown, activePageUrls)) {
    findings.push({
      triggerKey: "sitemap_live_mismatch",
      triggerName: MAINTENANCE_TRIGGER_COPY.sitemap_live_mismatch.name,
      why: MAINTENANCE_TRIGGER_COPY.sitemap_live_mismatch.why,
      reason: "Stored sitemap URL snapshot differs from current active page URLs.",
      nextAction: MAINTENANCE_TRIGGER_COPY.sitemap_live_mismatch.defaultNextAction,
      priority: "medium",
    });
  }

  // 4) Schema validation errors from latest audit
  const schemaSignals =
    latestRun?.results.filter((r) => /schema|json-ld|faqpage|article|breadcrumb|service_schema/i.test(r.checkKey) && r.status !== "pass") ?? [];
  if (schemaSignals.length > 0) {
    findings.push({
      triggerKey: "schema_validation_signals",
      triggerName: MAINTENANCE_TRIGGER_COPY.schema_validation_signals.name,
      why: MAINTENANCE_TRIGGER_COPY.schema_validation_signals.why,
      reason: `Latest audit flagged ${schemaSignals.length} schema-related issue(s).`,
      nextAction: MAINTENANCE_TRIGGER_COPY.schema_validation_signals.defaultNextAction,
      priority: "high",
    });
  }

  // 5) GSC indexing errors (mock counts for now)
  const excluded = site.gscExcludedPages ?? 0;
  const crawlErrors = site.gscCrawlErrors ?? 0;
  if (excluded > 0 || crawlErrors > 0) {
    findings.push({
      triggerKey: "gsc_indexing_signals",
      triggerName: MAINTENANCE_TRIGGER_COPY.gsc_indexing_signals.name,
      why: MAINTENANCE_TRIGGER_COPY.gsc_indexing_signals.why,
      reason: `Mock GSC counters show excluded pages: ${excluded}, crawl errors: ${crawlErrors}.`,
      nextAction: MAINTENANCE_TRIGGER_COPY.gsc_indexing_signals.defaultNextAction,
      priority: "high",
    });
  }

  // 6) llms.txt positioning drift
  const llmsSummary = (site.llmsPositioningSummary ?? "").trim().toLowerCase();
  if (site.primaryFocus?.trim()) {
    const focus = site.primaryFocus.trim().toLowerCase();
    if (!llmsSummary || !llmsSummary.includes(focus)) {
      findings.push({
        triggerKey: "llms_positioning_drift",
        triggerName: MAINTENANCE_TRIGGER_COPY.llms_positioning_drift.name,
        why: MAINTENANCE_TRIGGER_COPY.llms_positioning_drift.why,
        reason: "llms positioning summary appears missing or does not include current primary focus language.",
        nextAction: MAINTENANCE_TRIGGER_COPY.llms_positioning_drift.defaultNextAction,
        priority: "medium",
      });
    }
  }

  // 7) Meta/title/H1 drift on priority pages
  const missingTitles = pages.filter((p) => !p.title || !p.title.trim()).length;
  const metaSignals =
    latestRun?.results.filter((r) => /title|meta|h1/i.test(r.checkKey) && r.status !== "pass") ?? [];
  if (missingTitles > 0 || metaSignals.length > 0) {
    findings.push({
      triggerKey: "meta_title_h1_drift",
      triggerName: MAINTENANCE_TRIGGER_COPY.meta_title_h1_drift.name,
      why: MAINTENANCE_TRIGGER_COPY.meta_title_h1_drift.why,
      reason:
        missingTitles > 0
          ? `${missingTitles} active page(s) have no stored title.`
          : `Latest audit flagged ${metaSignals.length} title/meta/H1 issue(s).`,
      nextAction: MAINTENANCE_TRIGGER_COPY.meta_title_h1_drift.defaultNextAction,
      priority: "medium",
    });
  }

  return findings;
}
