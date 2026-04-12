"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  PAGE_REFRESH_CHECKLIST_ITEMS,
  sanitizePageRefreshChecklist,
} from "@/lib/sites/page-refresh-checklist";

/**
 * Save manual checklist progress from a form: checkbox name `c_${key}` when checked.
 */
export async function savePageRefreshChecklistForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const pageId = String(formData.get("pageId") ?? "").trim();
  if (!siteId || !pageId) return;

  const page = await prisma.page.findFirst({
    where: { id: pageId, siteId },
    select: { id: true },
  });
  if (!page) return;

  const raw: Record<string, boolean> = {};
  for (const item of PAGE_REFRESH_CHECKLIST_ITEMS) {
    raw[item.key] = formData.get(`c_${item.key}`) === "on";
  }
  const checklist = sanitizePageRefreshChecklist(raw);

  const payload = JSON.stringify(checklist);
  await prisma.pageRefreshWorkflow.upsert({
    where: { pageId },
    create: { siteId, pageId, checklist: payload },
    update: { checklist: payload },
  });

  revalidatePath(`/sites/${siteId}/refresh/${pageId}`);
  revalidatePath(`/sites/${siteId}`);
  redirect(`/sites/${siteId}/refresh/${pageId}?msg=${encodeURIComponent("Checklist saved.")}`);
}
