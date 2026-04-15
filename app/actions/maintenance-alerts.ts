"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { runMaintenanceChecks } from "@/lib/maintenance-rules";

function siteRedirect(siteId: string, msg: string): never {
  redirect(`/sites/${siteId}?msg=${encodeURIComponent(msg)}`);
}

export async function runMaintenanceScanForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  if (!siteId) redirect("/sites");

  const findings = await runMaintenanceChecks(siteId);
  let created = 0;
  let updated = 0;

  for (const f of findings) {
    const existing = await prisma.maintenanceAlert.findFirst({
      where: { siteId, triggerKey: f.triggerKey, status: "active" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await prisma.maintenanceAlert.update({
        where: { id: existing.id },
        data: {
          reason: f.reason,
          nextAction: f.nextAction,
          priority: f.priority,
        },
      });
      updated += 1;
      continue;
    }
    await prisma.maintenanceAlert.create({
      data: {
        siteId,
        triggerKey: f.triggerKey,
        status: "active",
        reason: f.reason,
        nextAction: f.nextAction,
        priority: f.priority,
      },
    });
    created += 1;
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  siteRedirect(siteId, `Maintenance scan complete. ${created} new alert(s), ${updated} updated.`);
}

export async function markMaintenanceAlertResolvedForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const alertId = String(formData.get("alertId") ?? "").trim();
  if (!siteId || !alertId) redirect("/sites");

  await prisma.maintenanceAlert.updateMany({
    where: { id: alertId, siteId, status: "active" },
    data: { status: "resolved", resolvedAt: new Date() },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  siteRedirect(siteId, "Maintenance alert marked resolved.");
}
