"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PARTNERSHIP_STATUS } from "@/lib/partnerships";

function isStatus(value: string): value is (typeof PARTNERSHIP_STATUS)[number] {
  return (PARTNERSHIP_STATUS as readonly string[]).includes(value);
}

function siteRedirect(siteId: string, msg: string): never {
  redirect(`/sites/${siteId}?msg=${encodeURIComponent(msg)}`);
}

export async function updatePartnershipForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const partnershipId = String(formData.get("partnershipId") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const nextAction = String(formData.get("nextAction") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!siteId || !partnershipId) redirect("/sites");
  if (!isStatus(statusRaw)) siteRedirect(siteId, "Invalid partnership status.");

  await prisma.partnership.updateMany({
    where: { id: partnershipId, siteId },
    data: {
      status: statusRaw,
      nextAction,
      notes,
      lastActivity: new Date(),
    },
  });

  revalidatePath(`/sites/${siteId}`);
  siteRedirect(siteId, "Partnership item updated.");
}

export async function logPartnershipActivityForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const partnershipId = String(formData.get("partnershipId") ?? "").trim();
  if (!siteId || !partnershipId) redirect("/sites");

  const existing = await prisma.partnership.findFirst({
    where: { id: partnershipId, siteId },
    select: { status: true },
  });
  if (!existing) siteRedirect(siteId, "Partnership item not found.");

  await prisma.partnership.updateMany({
    where: { id: partnershipId, siteId },
    data: {
      lastActivity: new Date(),
      status: existing.status === "not_started" ? "in_progress" : existing.status,
    },
  });

  revalidatePath(`/sites/${siteId}`);
  siteRedirect(siteId, "Partnership activity logged.");
}
