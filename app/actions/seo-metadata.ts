"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizeRootUrl } from "@/lib/onboarding/normalize-root-url";
import {
  buildMetadataSuggestions,
  mergePrimaryServiceNames,
  parseMarketFocus,
  parsePageType,
  type PageType,
} from "@/lib/seo/metadata-suggestions";

function msgRedirect(siteId: string, text: string): never {
  redirect(`/sites/${siteId}/metadata?msg=${encodeURIComponent(text)}`);
}

export async function updateSiteSeoBriefForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  if (!siteId) redirect("/sites");

  const targetAudience = String(formData.get("targetAudience") ?? "").trim() || null;
  const marketFocusRaw = String(formData.get("marketFocus") ?? "").trim().toLowerCase();
  const marketFocus = ["local", "regional", "national"].includes(marketFocusRaw) ? marketFocusRaw : null;
  const primaryConversionGoal = String(formData.get("primaryConversionGoal") ?? "").trim() || null;
  const priorityKeyword = String(formData.get("priorityKeyword") ?? "").trim() || null;
  const geoHint = String(formData.get("geoHint") ?? "").trim() || null;

  await prisma.site.update({
    where: { id: siteId },
    data: {
      targetAudience,
      marketFocus,
      primaryConversionGoal,
      priorityKeyword,
      geoHint,
    },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/metadata`);
  msgRedirect(siteId, "Business brief saved.");
}

export async function applyPageMetadataForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const pageId = String(formData.get("pageId") ?? "").trim();
  const pageTypeRaw = String(formData.get("pageType") ?? "").trim();
  const blogTopicHint = String(formData.get("blogTopicHint") ?? "").trim() || undefined;
  const locationOverride = String(formData.get("locationOverride") ?? "").trim() || undefined;
  const confirmed = String(formData.get("confirmed") ?? "").trim() === "1";

  if (!siteId) redirect("/sites");
  if (!pageId) msgRedirect(siteId, "Missing site or page.");
  const pageType = parsePageType(pageTypeRaw);
  if (!pageType) msgRedirect(siteId, "Choose a valid page type before applying.");

  if (!confirmed) {
    msgRedirect(siteId, "Check the confirmation box before applying metadata.");
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, siteId },
    include: { service: true },
  });
  if (!page) {
    msgRedirect(siteId, "Page not found for this site.");
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });
  if (!site) {
    msgRedirect(siteId, "Site not found.");
  }

  const pagesForServices = await prisma.page.findMany({
    where: { siteId },
    select: { service: { select: { name: true } } },
  });
  const catalogNames = pagesForServices
    .map((p) => p.service?.name)
    .filter((n): n is string => Boolean(n));

  const brief = {
    businessName: site.businessName,
    primaryServices: mergePrimaryServiceNames(site.primaryFocus, catalogNames),
    targetAudience: site.targetAudience ?? "",
    marketFocus: parseMarketFocus(site.marketFocus),
    serviceAreaOrLocation: site.geoHint ?? "",
    primaryConversionGoal: site.primaryConversionGoal ?? "",
    priorityKeyword: site.priorityKeyword ?? undefined,
  };

  const strategy: PageType = pageType;

  const suggestions = buildMetadataSuggestions(brief, {
    pageType: strategy,
    linkedServiceName: page.service?.name ?? null,
    blogTopicHint,
    locationOverride,
  });

  await prisma.page.update({
    where: { id: pageId },
    data: {
      title: suggestions.suggestedTitle,
      metaDescription: suggestions.suggestedMetaDescription,
      pageType: strategy,
    },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/metadata`);
  revalidatePath("/pages");
  msgRedirect(siteId, "Title, meta description, and page type were saved for this page.");
}

/** True when normalized page URL matches site homepage URL (hint only — not used inside the rules engine). */
export function pageLooksLikeHomepage(siteRootUrl: string, pageUrl: string): boolean {
  try {
    return normalizeRootUrl(siteRootUrl) === normalizeRootUrl(pageUrl);
  } catch {
    return false;
  }
}
