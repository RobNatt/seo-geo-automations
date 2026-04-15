"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildContentOpportunities } from "@/lib/content-opportunities";
import { nextDueDateForCadence } from "@/lib/growth-cadence";

function siteRedirect(siteId: string, msg: string): never {
  redirect(`/sites/${siteId}?msg=${encodeURIComponent(msg)}`);
}

export async function generateContentOpportunitiesForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  if (!siteId) redirect("/sites");

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) siteRedirect(siteId, "Site not found.");

  const [snaps, openGrowthTasks] = await Promise.all([
    prisma.contentPerformanceSnapshot.findMany({
      where: { siteId },
      select: { pageId: true, impressions: true, ctr: true },
    }),
    prisma.growthTask.findMany({
      where: { siteId, status: "pending" },
      select: { taskKey: true },
    }),
  ]);

  const lowCtrPageIds = new Set(
    snaps
      .filter((s) => (s.impressions ?? 0) >= 100 && (s.ctr ?? 0) > 0 && (s.ctr ?? 0) < 0.02)
      .map((s) => s.pageId),
  );

  const generated = buildContentOpportunities({
    site,
    lowCtrPageCount: lowCtrPageIds.size,
    openGrowthTaskKeys: openGrowthTasks.map((t) => t.taskKey),
  });

  let created = 0;
  for (const o of generated) {
    const existing = await prisma.contentOpportunity.findFirst({
      where: { siteId, type: o.type, topic: o.topic, status: { in: ["identified", "planned", "active"] } },
    });
    if (existing) continue;
    await prisma.contentOpportunity.create({
      data: {
        siteId,
        type: o.type,
        topic: o.topic,
        priority: o.priority,
        status: "identified",
        reason: o.reason,
        nextAction: o.nextAction,
        keywordSuggestions: o.keywordSuggestions,
        dueDate: o.dueDate,
      },
    });
    created += 1;
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  siteRedirect(siteId, `Generated ${created} new content opportunit${created === 1 ? "y" : "ies"}.`);
}

export async function planContentOpportunityForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const opportunityId = String(formData.get("opportunityId") ?? "").trim();
  if (!siteId || !opportunityId) redirect("/sites");

  const opp = await prisma.contentOpportunity.findFirst({
    where: { id: opportunityId, siteId },
  });
  if (!opp) siteRedirect(siteId, "Opportunity not found.");

  const dueDate = opp.dueDate ?? nextDueDateForCadence("weekly", new Date());
  const existingTask = await prisma.growthTask.findFirst({
    where: { siteId, taskKey: `opportunity:${opp.id}` },
  });
  if (!existingTask) {
    await prisma.growthTask.create({
      data: {
        siteId,
        cadence: "weekly",
        taskKey: `opportunity:${opp.id}`,
        status: "pending",
        dueDate,
        description: `Plan content: ${opp.topic}`,
        nextAction: opp.nextAction,
        priority: opp.priority,
      },
    });
  }

  await prisma.contentOpportunity.update({
    where: { id: opp.id },
    data: { status: "planned" },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  siteRedirect(siteId, "Opportunity moved to planned and added to growth tasks.");
}

export async function dismissContentOpportunityForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const opportunityId = String(formData.get("opportunityId") ?? "").trim();
  if (!siteId || !opportunityId) redirect("/sites");
  await prisma.contentOpportunity.updateMany({
    where: { id: opportunityId, siteId },
    data: { status: "dismissed" },
  });
  revalidatePath(`/sites/${siteId}`);
  siteRedirect(siteId, "Opportunity dismissed.");
}

export async function completeContentOpportunityForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const opportunityId = String(formData.get("opportunityId") ?? "").trim();
  if (!siteId || !opportunityId) redirect("/sites");
  await prisma.contentOpportunity.updateMany({
    where: { id: opportunityId, siteId },
    data: { status: "done" },
  });
  revalidatePath(`/sites/${siteId}`);
  siteRedirect(siteId, "Opportunity marked done.");
}
