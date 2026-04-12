import { prisma } from "@/lib/db";
import { buildFixRecommendations, type AuditResultInput } from "@/lib/audits/fix-plan";

/**
 * Upserts the manual fix queue from a completed audit.
 * - Uses fix-plan keys as dedupeKey; at most one open row per (siteId, dedupeKey).
 * - Skips geo_hint (advisory, not a failed check).
 * - Refreshes title/detail/priority on re-audit while the task stays open.
 */
export async function syncSiteFixTasksFromAudit(opts: {
  siteId: string;
  pageId: string;
  auditRunId: string;
  results: AuditResultInput[];
}) {
  const fixes = buildFixRecommendations(opts.results, { geoHint: null }).filter(
    (f) => f.checkKey !== "geo_hint",
  );

  for (const fix of fixes) {
    const existing = await prisma.siteFixTask.findFirst({
      where: {
        siteId: opts.siteId,
        dedupeKey: fix.key,
        status: "open",
      },
    });

    const payload = {
      bucket: fix.bucket,
      priorityScore: fix.priorityScore,
      title: fix.title,
      detail: fix.detail,
      sourceAuditRunId: opts.auditRunId,
    };

    if (existing) {
      await prisma.siteFixTask.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await prisma.siteFixTask.create({
        data: {
          siteId: opts.siteId,
          pageId: opts.pageId,
          dedupeKey: fix.key,
          status: "open",
          ...payload,
        },
      });
    }
  }
}
