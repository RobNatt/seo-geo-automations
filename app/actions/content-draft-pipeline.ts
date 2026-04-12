"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { CONTENT_QUEUE_STATUS } from "@/lib/sites/content-queue";
import {
  defaultPipelineArtifacts,
  normalizePipelineStage,
  parsePipelineArtifacts,
  tryAdvancePipeline,
  type PipelineArtifactsV1,
  type PipelineStage,
  buildReviewChecklist,
} from "@/lib/sites/content-draft-pipeline";
import { contentQueueItemAllowsPipeline } from "@/lib/sites/load-content-draft-pipeline";

function artifactsToPrismaJson(artifacts: PipelineArtifactsV1): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(artifacts)) as Prisma.InputJsonValue;
}

function pipelineUrl(siteId: string, itemId: string, msg?: string) {
  const base = `/sites/${siteId}/content/${itemId}`;
  return msg ? `${base}?msg=${encodeURIComponent(msg)}` : base;
}

function readArtifactsFromForm(
  formData: FormData,
  previous: PipelineArtifactsV1,
  opts: { includeSanitizeOverride: boolean },
): PipelineArtifactsV1 {
  const seoBody = String(formData.get("seoBody") ?? previous.seoBody);
  const geoNotes = String(formData.get("geoNotes") ?? previous.geoNotes);
  const linkedinPost = String(formData.get("linkedinPost") ?? previous.linkedinPost);
  const sanitizeOverride = opts.includeSanitizeOverride
    ? formData.get("sanitizeOverride") === "on" || formData.get("sanitizeOverride") === "true"
    : previous.sanitizeOverride;

  const checks = formData.getAll("reviewCheck");
  const reviewCheckedIds = checks.map((c) => String(c).trim()).filter(Boolean);

  return {
    v: 1,
    seoBody,
    geoNotes,
    linkedinPost,
    briefAcknowledged: previous.briefAcknowledged,
    reviewCheckedIds: reviewCheckedIds.length > 0 ? reviewCheckedIds : previous.reviewCheckedIds,
    sanitizeOverride,
    publishReadyCheckedIds: previous.publishReadyCheckedIds,
  };
}

export async function startContentDraftPipelineForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!siteId || !itemId) return;

  const row = await prisma.contentQueueItem.findFirst({ where: { id: itemId, siteId } });
  if (!row || !contentQueueItemAllowsPipeline(row.status)) {
    redirect(`/sites/${siteId}?msg=${encodeURIComponent("Queue item not available for drafting.")}`);
  }

  if (row.pipelineStage != null && row.pipelineStage !== "") {
    redirect(pipelineUrl(siteId, itemId, "Pipeline already started."));
  }

  await prisma.contentQueueItem.update({
    where: { id: itemId },
    data: {
      pipelineStage: "brief",
      pipelineArtifacts: artifactsToPrismaJson(defaultPipelineArtifacts()),
      status: CONTENT_QUEUE_STATUS.IN_PROGRESS,
    },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(pipelineUrl(siteId, itemId));
  redirect(pipelineUrl(siteId, itemId, "Draft pipeline started."));
}

export async function savePipelineArtifactsForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!siteId || !itemId) return;

  const row = await prisma.contentQueueItem.findFirst({ where: { id: itemId, siteId } });
  if (!row || !contentQueueItemAllowsPipeline(row.status)) return;

  const prev = parsePipelineArtifacts(row.pipelineArtifacts);
  const includeSanitizeOverride = formData.get("syncSanitizeOverride") === "yes";
  const merged = readArtifactsFromForm(formData, prev, { includeSanitizeOverride });

  await prisma.contentQueueItem.update({
    where: { id: itemId },
    data: { pipelineArtifacts: artifactsToPrismaJson(merged) },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(pipelineUrl(siteId, itemId));
  redirect(pipelineUrl(siteId, itemId, "Draft saved."));
}

export async function advancePipelineStageForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!siteId || !itemId) return;

  const row = await prisma.contentQueueItem.findFirst({ where: { id: itemId, siteId } });
  if (!row || !contentQueueItemAllowsPipeline(row.status)) {
    redirect(`/sites/${siteId}?msg=${encodeURIComponent("Queue item not available.")}`);
  }

  const stage = normalizePipelineStage(row.pipelineStage);
  if (!stage) {
    redirect(pipelineUrl(siteId, itemId, "Start the pipeline first."));
  }

  let artifacts = parsePipelineArtifacts(row.pipelineArtifacts);
  const includeSanitizeOverride = stage === "sanitize";
  artifacts = readArtifactsFromForm(formData, artifacts, { includeSanitizeOverride });

  if (stage === "brief") {
    artifacts = { ...artifacts, briefAcknowledged: true };
  }

  const ctx = { opportunityKey: row.opportunityKey, category: row.category };
  const checklist = buildReviewChecklist(ctx);
  const result = tryAdvancePipeline(stage, artifacts, ctx, checklist);

  if (!result.ok) {
    await prisma.contentQueueItem.update({
      where: { id: itemId },
      data: { pipelineArtifacts: artifactsToPrismaJson(artifacts) },
    });
    revalidatePath(`/sites/${siteId}`);
    revalidatePath(pipelineUrl(siteId, itemId));
    redirect(pipelineUrl(siteId, itemId, result.error));
  }

  const nextStage: PipelineStage = result.nextStage;

  await prisma.contentQueueItem.update({
    where: { id: itemId },
    data: {
      pipelineStage: nextStage,
      pipelineArtifacts: artifactsToPrismaJson(artifacts),
    },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(pipelineUrl(siteId, itemId));
  redirect(pipelineUrl(siteId, itemId, `Stage: ${nextStage.replace("_", " ")}`));
}

export async function applyDraftScaffoldForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!siteId || !itemId) return;

  const row = await prisma.contentQueueItem.findFirst({ where: { id: itemId, siteId } });
  if (!row || !contentQueueItemAllowsPipeline(row.status)) return;

  const seoBody = String(formData.get("scaffoldSeo") ?? "");
  const geoNotes = String(formData.get("scaffoldGeo") ?? "");
  const linkedinPost = String(formData.get("scaffoldLinkedin") ?? "");

  const prev = parsePipelineArtifacts(row.pipelineArtifacts);
  const merged: PipelineArtifactsV1 = {
    ...prev,
    seoBody,
    geoNotes,
    linkedinPost,
  };

  await prisma.contentQueueItem.update({
    where: { id: itemId },
    data: { pipelineArtifacts: artifactsToPrismaJson(merged) },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(pipelineUrl(siteId, itemId));
  redirect(pipelineUrl(siteId, itemId, "Scaffold applied to draft fields."));
}

export async function savePublishReadyChecklistForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!siteId || !itemId) return;

  const row = await prisma.contentQueueItem.findFirst({ where: { id: itemId, siteId } });
  if (!row || !contentQueueItemAllowsPipeline(row.status)) return;

  const prev = parsePipelineArtifacts(row.pipelineArtifacts);
  const checks = formData.getAll("publishReadyCheck").map((c) => String(c).trim()).filter(Boolean);
  const merged: PipelineArtifactsV1 = {
    ...prev,
    publishReadyCheckedIds: checks,
  };

  await prisma.contentQueueItem.update({
    where: { id: itemId },
    data: { pipelineArtifacts: artifactsToPrismaJson(merged) },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(pipelineUrl(siteId, itemId));
  redirect(pipelineUrl(siteId, itemId, "Publish checklist saved."));
}
