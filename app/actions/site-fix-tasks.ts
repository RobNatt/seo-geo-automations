"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fixRecommendationForRunCheck } from "@/lib/audits/fix-plan";
import {
  opportunityTaskBucket,
  opportunityTaskDedupeKey,
  opportunityTaskPriorityScore,
  type OpportunityTaskKind,
} from "@/lib/fix-tasks/opportunity-task";
import { prisma } from "@/lib/db";
import { appendSearchParams, focusTokenFromFormData } from "@/lib/navigation/post-action-focus";
import { rankContentGapOpportunities, shortOpportunityRecommendation } from "@/lib/sites/content-gap-rank";
import { listPromptClusterPlannerRows } from "@/lib/sites/prompt-clusters";

export async function createFixTaskFromCheckForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const checkResultId = String(formData.get("checkResultId") ?? "").trim();
  if (!siteId || !checkResultId) return;

  const row = await prisma.auditCheckResult.findUnique({
    where: { id: checkResultId },
    include: {
      auditRun: {
        include: { page: { select: { id: true, siteId: true } } },
      },
    },
  });
  if (!row?.auditRun.page?.siteId || row.auditRun.page.siteId !== siteId) return;
  if (row.status === "pass") return;

  const allRows = await prisma.auditCheckResult.findMany({
    where: { auditRunId: row.auditRunId },
    orderBy: { checkKey: "asc" },
  });
  const fullResults = allRows.map((r) => ({
    checkKey: r.checkKey,
    status: r.status,
    message: r.message,
  }));
  const target = {
    checkKey: row.checkKey,
    status: row.status,
    message: row.message,
  };
  const fix = fixRecommendationForRunCheck(fullResults, target);
  if (!fix) return;

  const existing = await prisma.siteFixTask.findFirst({
    where: { siteId, dedupeKey: fix.key, status: "open" },
  });
  if (existing) {
    redirect(
      appendSearchParams(`/sites/${siteId}?msg=${encodeURIComponent("That issue is already on your open fix task list.")}`, {
        focus: "open-fix-tasks",
      }),
    );
  }

  await prisma.siteFixTask.create({
    data: {
      siteId,
      pageId: row.auditRun.pageId,
      dedupeKey: fix.key,
      status: "open",
      bucket: fix.bucket,
      priorityScore: fix.priorityScore,
      title: fix.title,
      detail: fix.detail,
      sourceAuditRunId: row.auditRunId,
    },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  const focus = focusTokenFromFormData(formData) ?? "open-fix-tasks";
  redirect(
    appendSearchParams(`/sites/${siteId}?msg=${encodeURIComponent("Added to open fix tasks.")}`, {
      focus,
    }),
  );
}

export async function completeSiteFixTaskForm(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "").trim();
  if (!taskId || !siteId) return;

  const task = await prisma.siteFixTask.findFirst({
    where: { id: taskId, siteId, status: "open" },
  });
  if (!task) return;

  await prisma.siteFixTask.update({
    where: { id: taskId },
    data: { status: "done" },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  const focus = focusTokenFromFormData(formData);
  redirect(appendSearchParams(`/sites/${siteId}`, focus ? { focus } : {}));
}

export async function createOpportunityTaskForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const clusterKey = String(formData.get("clusterKey") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "").trim();
  if (!siteId || !clusterKey) return;
  if (kindRaw !== "fix" && kindRaw !== "content") return;
  const kind = kindRaw as OpportunityTaskKind;

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return;

  const dedupeKey = opportunityTaskDedupeKey(clusterKey, kind);
  const duplicate = await prisma.siteFixTask.findFirst({
    where: { siteId, dedupeKey, status: "open" },
  });
  if (duplicate) {
    redirect(
      appendSearchParams(
        `/sites/${siteId}?msg=${encodeURIComponent(
          `An open ${kind} task for opportunity “${clusterKey}” already exists.`,
        )}`,
        { focus: "open-fix-tasks" },
      ),
    );
  }

  const cluster = await prisma.promptCluster.findFirst({
    where: { siteId, key: clusterKey },
    include: { pages: { orderBy: { url: "asc" }, select: { id: true, url: true } } },
  });
  if (!cluster) {
    redirect(`/sites/${siteId}?msg=${encodeURIComponent("That opportunity was not found.")}`);
  }

  const pageId =
    cluster.pages[0]?.id ??
    (
      await prisma.page.findFirst({
        where: { siteId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id;
  if (!pageId) {
    redirect(
      `/sites/${siteId}?msg=${encodeURIComponent("Add at least one page to this site before creating tasks.")}`,
    );
  }

  const rows = await listPromptClusterPlannerRows(siteId);
  const ranked = rankContentGapOpportunities(rows, {
    primaryFocus: site.primaryFocus,
    businessName: site.businessName,
  });
  const r = ranked.find((x) => x.clusterKey === clusterKey);
  const priorityScore = r ? opportunityTaskPriorityScore(r.compositePriority) : 55;
  const bucket = opportunityTaskBucket(kind);
  const title =
    kind === "fix"
      ? `Opportunity (fix): ${cluster.title}`
      : `Opportunity (content): ${cluster.title}`;
  const targetLine =
    cluster.pages.length > 0
      ? `Target page(s): ${cluster.pages.map((p) => p.url).join(", ")}`
      : "Target page(s): none linked — task anchored to first site page.";
  const why = r ? shortOpportunityRecommendation(r) : "";
  const detail = [`Opportunity key: ${clusterKey}`, why, targetLine].filter(Boolean).join("\n");

  await prisma.siteFixTask.create({
    data: {
      siteId,
      pageId,
      dedupeKey,
      status: "open",
      bucket,
      priorityScore,
      title,
      detail,
      sourceAuditRunId: null,
    },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  redirect(
    appendSearchParams(`/sites/${siteId}?msg=${encodeURIComponent(`Added ${kind} task from opportunity.`)}`, {
      focus: "open-fix-tasks",
    }),
  );
}
