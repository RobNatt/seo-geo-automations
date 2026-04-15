"use server";

import { Prisma } from "@prisma/client";
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

function isMissingPartnershipTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    error.meta?.modelName === "Partnership"
  );
}

export async function updatePartnershipForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const partnershipId = String(formData.get("partnershipId") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const nextAction = String(formData.get("nextAction") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!siteId || !partnershipId) redirect("/sites");
  if (!isStatus(statusRaw)) siteRedirect(siteId, "Invalid partnership status.");

  try {
    await prisma.partnership.updateMany({
      where: { id: partnershipId, siteId },
      data: {
        status: statusRaw,
        nextAction,
        notes,
        lastActivity: new Date(),
      },
    });
  } catch (error) {
    if (isMissingPartnershipTableError(error)) {
      siteRedirect(siteId, "Partnership table is not in production DB yet. Run prisma db push, then retry.");
    }
    throw error;
  }

  revalidatePath(`/sites/${siteId}`);
  siteRedirect(siteId, "Partnership item updated.");
}

export async function logPartnershipActivityForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const partnershipId = String(formData.get("partnershipId") ?? "").trim();
  if (!siteId || !partnershipId) redirect("/sites");

  let existing: { status: string } | null = null;
  try {
    existing = await prisma.partnership.findFirst({
      where: { id: partnershipId, siteId },
      select: { status: true },
    });
  } catch (error) {
    if (isMissingPartnershipTableError(error)) {
      siteRedirect(siteId, "Partnership table is not in production DB yet. Run prisma db push, then retry.");
    }
    throw error;
  }
  if (!existing) siteRedirect(siteId, "Partnership item not found.");

  try {
    await prisma.partnership.updateMany({
      where: { id: partnershipId, siteId },
      data: {
        lastActivity: new Date(),
        status: existing.status === "not_started" ? "in_progress" : existing.status,
      },
    });
  } catch (error) {
    if (isMissingPartnershipTableError(error)) {
      siteRedirect(siteId, "Partnership table is not in production DB yet. Run prisma db push, then retry.");
    }
    throw error;
  }

  revalidatePath(`/sites/${siteId}`);
  siteRedirect(siteId, "Partnership activity logged.");
}
