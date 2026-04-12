"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  clampContentRefreshQueuePriority,
  CONTENT_REFRESH_QUEUE_STATUS,
  isContentRefreshQueueUnresolvedStatus,
  type ContentRefreshQueueStatus,
} from "@/lib/sites/content-refresh-queue";

const TERMINAL_STATUSES = new Set<string>([
  CONTENT_REFRESH_QUEUE_STATUS.DONE,
  CONTENT_REFRESH_QUEUE_STATUS.CANCELLED,
]);

/**
 * Enqueue a page for refresh, or reopen a terminal row for the same page.
 * Blocks a second unresolved row for the same page (enforced by DB @@unique([pageId]) + this check).
 */
export async function enqueueContentRefreshQueueItemForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const pageId = String(formData.get("pageId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "").trim();

  if (!siteId || !pageId || !reason) return;

  const priority = clampContentRefreshQueuePriority(
    priorityRaw ? Number.parseInt(priorityRaw, 10) : 50,
  );

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return;

  const page = await prisma.page.findFirst({
    where: { id: pageId, siteId },
    select: { id: true },
  });
  if (!page) {
    redirect(`/sites/${siteId}?msg=${encodeURIComponent("Page not found on this site.")}`);
  }

  const existing = await prisma.contentRefreshQueueItem.findUnique({
    where: { pageId },
  });

  if (existing && isContentRefreshQueueUnresolvedStatus(existing.status)) {
    redirect(
      `/sites/${siteId}?msg=${encodeURIComponent(
        "This page is already on the refresh queue (queued or in progress).",
      )}`,
    );
  }

  const payload = {
    siteId,
    reason,
    priority,
    status: CONTENT_REFRESH_QUEUE_STATUS.QUEUED,
  };

  if (existing && TERMINAL_STATUSES.has(existing.status)) {
    await prisma.contentRefreshQueueItem.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    await prisma.contentRefreshQueueItem.create({
      data: {
        ...payload,
        pageId,
      },
    });
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  redirect(`/sites/${siteId}?msg=${encodeURIComponent("Added to content refresh queue.")}`);
}

/** Manual status update (any transition). */
export async function setContentRefreshQueueStatusForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();

  if (!siteId || !itemId) return;

  const allowed = new Set<string>(Object.values(CONTENT_REFRESH_QUEUE_STATUS));
  if (!allowed.has(statusRaw)) return;
  const status = statusRaw as ContentRefreshQueueStatus;

  const row = await prisma.contentRefreshQueueItem.findFirst({
    where: { id: itemId, siteId },
  });
  if (!row) return;

  await prisma.contentRefreshQueueItem.update({
    where: { id: itemId },
    data: { status },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  redirect(`/sites/${siteId}?msg=${encodeURIComponent("Refresh queue updated.")}`);
}

/**
 * One-step queued → in_progress for a working view / pipeline handoff.
 */
export async function startContentRefreshQueueWorkForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();

  if (!siteId || !itemId) return;

  const row = await prisma.contentRefreshQueueItem.findFirst({
    where: { id: itemId, siteId },
  });
  if (!row) return;

  if (row.status !== CONTENT_REFRESH_QUEUE_STATUS.QUEUED) {
    redirect(
      `/sites/${siteId}?msg=${encodeURIComponent("Only queued items can be started (use status update otherwise).")}`,
    );
  }

  await prisma.contentRefreshQueueItem.update({
    where: { id: itemId },
    data: { status: CONTENT_REFRESH_QUEUE_STATUS.IN_PROGRESS },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  redirect(`/sites/${siteId}?msg=${encodeURIComponent("Refresh work started (in progress).")}`);
}
