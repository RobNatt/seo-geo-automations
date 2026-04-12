"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  clampContentQueuePriority,
  CONTENT_QUEUE_STATUS,
  isContentQueueUnresolvedStatus,
  normalizeContentQueueCategory,
  type ContentQueueStatus,
} from "@/lib/sites/content-queue";

const TERMINAL_STATUSES = new Set<string>([
  CONTENT_QUEUE_STATUS.DONE,
  CONTENT_QUEUE_STATUS.CANCELLED,
]);

function parseOptionalPageId(raw: string): string | null {
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Add or reopen a content queue row. Blocks a second unresolved row for the same opportunityKey on the site.
 */
export async function enqueueContentQueueItemForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const opportunityKey = String(formData.get("opportunityKey") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const detailRaw = String(formData.get("detail") ?? "").trim();
  const pageIdRaw = parseOptionalPageId(String(formData.get("pageId") ?? ""));
  const priorityRaw = String(formData.get("priority") ?? "").trim();

  if (!siteId || !opportunityKey || !title) return;

  const category = normalizeContentQueueCategory(categoryRaw);
  if (!category) {
    redirect(`/sites/${siteId}?msg=${encodeURIComponent("Invalid content queue category.")}`);
  }

  const priority = clampContentQueuePriority(
    priorityRaw ? Number.parseInt(priorityRaw, 10) : 50,
  );
  const detail = detailRaw.length > 0 ? detailRaw : null;

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return;

  let pageId: string | null = null;
  if (pageIdRaw) {
    const page = await prisma.page.findFirst({
      where: { id: pageIdRaw, siteId },
      select: { id: true },
    });
    if (!page) {
      redirect(`/sites/${siteId}?msg=${encodeURIComponent("Target page is not on this site.")}`);
    }
    pageId = page.id;
  }

  const existing = await prisma.contentQueueItem.findUnique({
    where: { siteId_opportunityKey: { siteId, opportunityKey } },
  });

  if (existing && isContentQueueUnresolvedStatus(existing.status)) {
    redirect(
      `/sites/${siteId}?msg=${encodeURIComponent(
        "This opportunity is already on the content queue (queued or in progress).",
      )}`,
    );
  }

  const payload = {
    category,
    title,
    detail,
    pageId,
    priority,
    status: CONTENT_QUEUE_STATUS.QUEUED,
  };

  if (existing && TERMINAL_STATUSES.has(existing.status)) {
    await prisma.contentQueueItem.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    await prisma.contentQueueItem.create({
      data: {
        siteId,
        opportunityKey,
        ...payload,
      },
    });
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  redirect(`/sites/${siteId}?msg=${encodeURIComponent("Added to content queue.")}`);
}

/**
 * Update queue item status (manual workflow — same spirit as completeSiteFixTaskForm).
 */
export async function setContentQueueStatusForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();

  if (!siteId || !itemId) return;

  const allowed = new Set<string>(Object.values(CONTENT_QUEUE_STATUS));
  if (!allowed.has(statusRaw)) return;
  const status = statusRaw as ContentQueueStatus;

  const row = await prisma.contentQueueItem.findFirst({
    where: { id: itemId, siteId },
  });
  if (!row) return;

  await prisma.contentQueueItem.update({
    where: { id: itemId },
    data: { status },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  redirect(`/sites/${siteId}?msg=${encodeURIComponent("Content queue updated.")}`);
}
