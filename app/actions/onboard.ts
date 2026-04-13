"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { runPageAudit } from "@/lib/audits/run-page-audit";
import { normalizeRootUrl } from "@/lib/onboarding/normalize-root-url";
import { onboardFailureErrCode } from "@/lib/onboard-error-codes";
import { LAUNCH_CHECKLIST_DEF } from "@/lib/sites/launch-checklist";

function slugify(input: string) {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "service";
}

function onboardingErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const oneLine = raw.replace(/[\r\n]+/g, " ").trim();
  return oneLine.length > 450 ? `${oneLine.slice(0, 447)}…` : oneLine;
}

function onboardingFatalFlashText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const oneLine = raw.replace(/[\r\n]+/g, " ").trim();
  return `Onboarding failed. In Vercel: Project → Settings → Environment Variables → add DATABASE_URL (hosted DB, not file: SQLite). ${oneLine}`;
}

async function submitOnboardingInner(formData: FormData) {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const rawUrl = String(formData.get("rootUrl") ?? "").trim();
  const geoHint = String(formData.get("geoHint") ?? "").trim() || null;
  const primaryFocus = String(formData.get("primaryFocus") ?? "").trim() || null;

  if (!businessName) {
    redirect("/onboard?msg=" + encodeURIComponent("Business name is required."));
  }
  if (!rawUrl) {
    redirect("/onboard?msg=" + encodeURIComponent("Site URL is required."));
  }

  let rootUrl: string;
  try {
    rootUrl = normalizeRootUrl(rawUrl);
  } catch {
    redirect("/onboard?msg=" + encodeURIComponent("Invalid site URL."));
  }

  let serviceId: string | null = null;
  if (primaryFocus) {
    const slug = slugify(primaryFocus);
    const existing = await prisma.service.findUnique({ where: { slug } });
    if (existing) {
      serviceId = existing.id;
    } else {
      const s = await prisma.service.create({
        data: { name: primaryFocus, slug },
      });
      serviceId = s.id;
    }
  }

  let siteId: string;
  let pageId: string;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const site = await tx.site.create({
        data: {
          rootUrl,
          businessName,
          geoHint,
          primaryFocus,
        },
      });
      const page = await tx.page.create({
        data: {
          url: rootUrl,
          title: businessName,
          siteId: site.id,
          serviceId,
        },
      });
      await tx.siteLaunchCheckItem.createMany({
        data: LAUNCH_CHECKLIST_DEF.map((d) => ({
          siteId: site.id,
          key: d.key,
          done: false,
        })),
      });
      return { site, page };
    });
    siteId = out.site.id;
    pageId = out.page.id;
  } catch {
    redirect(
      "/onboard?msg=" +
        encodeURIComponent("Could not save. The URL may already be registered as a site or page."),
    );
  }

  try {
    const runId = await runPageAudit(pageId);
    revalidatePath(`/sites/${siteId}`);
    revalidatePath("/sites");
    revalidatePath("/audits");
    revalidatePath("/pages");
    revalidatePath("/services");
    redirect(`/sites/${siteId}?runId=${runId}`);
  } catch (error) {
    unstable_rethrow(error);
    revalidatePath(`/sites/${siteId}`);
    revalidatePath("/sites");
    revalidatePath("/audits");
    revalidatePath("/pages");
    revalidatePath("/services");
    redirect(
      `/sites/${siteId}?msg=` +
        encodeURIComponent("Site saved, but the audit failed. Try Re-run audit."),
    );
  }
}

export async function submitOnboarding(formData: FormData) {
  try {
    await submitOnboardingInner(formData);
  } catch (error) {
    unstable_rethrow(error);
    redirect("/onboard?err=" + encodeURIComponent(onboardFailureErrCode(error)));
  }
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
