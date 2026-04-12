import { prisma } from "@/lib/db";
import { fetchPageForAudit, runChecksForHtml } from "@/lib/audits/checks";
import { syncSiteFixTasksFromAudit } from "@/lib/fix-tasks/sync-from-audit";

export async function runPageAudit(pageId: string) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { site: { select: { geoHint: true } } },
  });
  if (!page) throw new Error("Page not found");

  const run = await prisma.auditRun.create({
    data: {
      pageId: page.id,
      status: "running",
    },
  });

  try {
    const fetchResult = await fetchPageForAudit(page.url);
    const outcomes = await runChecksForHtml(page.url, fetchResult, {
      geoHint: page.site?.geoHint ?? null,
    });

    await prisma.$transaction([
      ...outcomes.map((o) =>
        prisma.auditCheckResult.create({
          data: {
            auditRunId: run.id,
            checkKey: o.checkKey,
            status: o.status,
            message: o.message,
            evidence: o.evidence ? JSON.stringify(o.evidence) : null,
          },
        }),
      ),
      prisma.auditRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          finishedAt: new Date(),
          summary: JSON.stringify({
            pass: outcomes.filter((o) => o.status === "pass").length,
            fail: outcomes.filter((o) => o.status === "fail").length,
            warn: outcomes.filter((o) => o.status === "warn").length,
          }),
        },
      }),
    ]);

    if (page.siteId) {
      await prisma.site.update({
        where: { id: page.siteId },
        data: { onboardingStage: "audited" },
      });
      await syncSiteFixTasksFromAudit({
        siteId: page.siteId,
        pageId: page.id,
        auditRunId: run.id,
        results: outcomes.map((o) => ({
          checkKey: o.checkKey,
          status: o.status,
          message: o.message,
        })),
      });
    }

    return run.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.auditRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        summary: JSON.stringify({ error: msg }),
      },
    });
    if (page.siteId) {
      await prisma.site.update({
        where: { id: page.siteId },
        data: { onboardingStage: "blocked" },
      });
    }
    throw e;
  }
}
