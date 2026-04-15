"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildGrowthCadenceTasks } from "@/lib/growth-cadence";

function siteRedirect(siteId: string, msg: string): never {
  redirect(`/sites/${siteId}?msg=${encodeURIComponent(msg)}`);
}

function mockCompetitors(primaryFocus: string | null): string[] {
  const base = primaryFocus?.trim().toLowerCase() || "digital growth";
  if (base.includes("seo")) return ["Acme SEO Co", "Visibility Forge", "SearchSprint"];
  if (base.includes("web")) return ["PixelCraft Studio", "BuildLaunch", "Webline Labs"];
  return ["Prime Growth Studio", "Northbound Digital", "RankBridge"];
}

export async function runGrowthCadenceScanForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  if (!siteId) redirect("/sites");

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) siteRedirect(siteId, "Site not found.");

  const [pages, snaps] = await Promise.all([
    prisma.page.findMany({ where: { siteId, status: "active" }, select: { id: true, createdAt: true } }),
    prisma.contentPerformanceSnapshot.findMany({
      where: { siteId },
      select: { pageId: true, impressions: true, ctr: true },
    }),
  ]);

  const lowCtrPageIds = new Set(
    snaps
      .filter((s) => (s.impressions ?? 0) >= 100 && (s.ctr ?? 0) > 0 && (s.ctr ?? 0) < 0.02)
      .map((s) => s.pageId),
  );
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const hasRecentContent = pages.some((p) => p.createdAt >= thirtyDaysAgo);

  const tasks = buildGrowthCadenceTasks(new Date(), {
    lowCtrPageCount: lowCtrPageIds.size,
    hasRecentContent,
    gscSnapshotMock: {
      queriesChecked: Math.max(10, pages.length * 3),
      pagesChecked: Math.max(1, pages.length),
    },
    competitorNames: mockCompetitors(site.primaryFocus),
  });

  let createdOrUpdated = 0;
  for (const t of tasks) {
    await prisma.growthTask.upsert({
      where: {
        siteId_cadence_taskKey_dueDate: {
          siteId,
          cadence: t.cadence,
          taskKey: t.taskKey,
          dueDate: t.dueDate,
        },
      },
      create: {
        siteId,
        cadence: t.cadence,
        taskKey: t.taskKey,
        status: "pending",
        dueDate: t.dueDate,
        description: t.description,
        nextAction: t.nextAction,
        priority: t.priority,
      },
      update: {
        description: t.description,
        nextAction: t.nextAction,
        priority: t.priority,
      },
    });
    createdOrUpdated += 1;
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  siteRedirect(siteId, `Growth cadence scan complete. ${createdOrUpdated} task slot(s) up to date.`);
}

export async function markGrowthTaskDoneForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!siteId || !taskId) redirect("/sites");

  await prisma.growthTask.updateMany({
    where: { id: taskId, siteId },
    data: { status: "done", completedAt: new Date() },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  siteRedirect(siteId, "Growth task marked done.");
}
