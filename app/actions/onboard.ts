"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { runPageAudit } from "@/lib/audits/run-page-audit";

function onboardingErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const oneLine = raw.replace(/[\r\n]+/g, " ").trim();
  return oneLine.length > 450 ? `${oneLine.slice(0, 447)}…` : oneLine;
}

async function rerunSiteAuditFormInner(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  if (!siteId) return;

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();
  const backToList = redirectTo === "/sites";

  const page = await prisma.page.findFirst({
    where: { siteId },
    orderBy: { createdAt: "asc" },
  });

  if (!page) {
    const base = backToList ? "/sites" : `/sites/${siteId}`;
    redirect(`${base}?msg=` + encodeURIComponent("No homepage linked to this site."));
  }

  try {
    const runId = await runPageAudit(page.id);
    revalidatePath(`/sites/${siteId}`);
    revalidatePath("/sites");
    revalidatePath("/audits");
    if (backToList) {
      redirect(`/sites?runId=${encodeURIComponent(runId)}&siteId=${encodeURIComponent(siteId)}`);
    }
    redirect(`/sites/${siteId}?runId=${runId}`);
  } catch (error) {
    unstable_rethrow(error);
    if (backToList) {
      redirect(`/sites?msg=` + encodeURIComponent("Audit failed."));
    }
    redirect(`/sites/${siteId}?msg=` + encodeURIComponent("Audit failed."));
  }
}

export async function rerunSiteAuditForm(formData: FormData) {
  try {
    await rerunSiteAuditFormInner(formData);
  } catch (error) {
    unstable_rethrow(error);
    redirect("/sites?msg=" + encodeURIComponent(`Audit request failed. ${onboardingErrorMessage(error)}`));
  }
}
