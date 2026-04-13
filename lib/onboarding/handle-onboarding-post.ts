import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
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

function redirect(originUrl: string, pathWithQuery: string) {
  return NextResponse.redirect(new URL(pathWithQuery, originUrl), 303);
}

async function submitOnboardingFromFormData(formData: FormData, originUrl: string): Promise<NextResponse> {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const rawUrl = String(formData.get("rootUrl") ?? "").trim();
  const geoHint = String(formData.get("geoHint") ?? "").trim() || null;
  const primaryFocus = String(formData.get("primaryFocus") ?? "").trim() || null;

  if (!businessName) {
    return redirect(originUrl, "/onboard?msg=" + encodeURIComponent("Business name is required."));
  }
  if (!rawUrl) {
    return redirect(originUrl, "/onboard?msg=" + encodeURIComponent("Site URL is required."));
  }

  let rootUrl: string;
  try {
    rootUrl = normalizeRootUrl(rawUrl);
  } catch {
    return redirect(originUrl, "/onboard?msg=" + encodeURIComponent("Invalid site URL."));
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
    return redirect(
      originUrl,
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
    return redirect(originUrl, `/sites/${siteId}?runId=${runId}`);
  } catch (error) {
    unstable_rethrow(error);
    revalidatePath(`/sites/${siteId}`);
    revalidatePath("/sites");
    revalidatePath("/audits");
    revalidatePath("/pages");
    revalidatePath("/services");
    return redirect(
      originUrl,
      `/sites/${siteId}?msg=` +
        encodeURIComponent("Site saved, but the audit failed. Try Re-run audit."),
    );
  }
}

/**
 * POST /api/onboard — same behavior as the former submitOnboarding Server Action, but
 * avoids binding a Server Action on GET /onboard (Next would try to set the action cookie during RSC).
 */
export async function handleOnboardingPost(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    return await submitOnboardingFromFormData(formData, request.url);
  } catch (error) {
    unstable_rethrow(error);
    const code = onboardFailureErrCode(error);
    return redirect(request.url, "/onboard?err=" + encodeURIComponent(code));
  }
}
