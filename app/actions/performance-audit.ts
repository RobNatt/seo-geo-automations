"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { runLighthouseAuditForUrl } from "@/lib/sites/performance-audit";

export async function runHomepagePerformanceAuditForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  if (!siteId) redirect("/sites");

  const homepage = await prisma.page.findFirst({
    where: { siteId },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true },
  });

  if (!homepage) {
    redirect(`/sites/${siteId}?msg=${encodeURIComponent("No homepage linked. Add a homepage page first.")}`);
  }

  try {
    const scores = await runLighthouseAuditForUrl(homepage.url);
    await prisma.page.update({
      where: { id: homepage.id },
      data: {
        performanceScore: scores.performanceScore,
        accessibilityScore: scores.accessibilityScore,
        bestPracticesScore: scores.bestPracticesScore,
        seoScore: scores.seoScore,
        performanceLastAudited: new Date(),
        performanceAuditUrl: scores.auditUrl,
      },
    });
    revalidatePath(`/sites/${siteId}`);
    revalidatePath("/sites");
    redirect(`/sites/${siteId}?msg=${encodeURIComponent("Performance audit updated.")}`);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    revalidatePath(`/sites/${siteId}`);
    redirect(
      `/sites/${siteId}?msg=${encodeURIComponent(
        `Performance audit failed (advisory only, launch is unaffected). ${text}`,
      )}`,
    );
  }
}
