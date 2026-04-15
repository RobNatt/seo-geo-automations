"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildGeoAreaNoteVisible } from "@/lib/geo/location-statement";
import { PAGE_TYPES, buildMetadataOptions, type PageType } from "@/lib/metadata";
import { buildKeywordSuggestions } from "@/lib/keywords";
import {
  buildSiteBriefFromSite,
  parseBrandTone,
  parseListInput,
  parseMarketFocus,
} from "@/lib/site-brief";

function msgRedirect(siteId: string, text: string): never {
  redirect(`/sites/${siteId}/metadata?msg=${encodeURIComponent(text)}`);
}

function parsePageType(raw: string | null | undefined): PageType | null {
  const v = (raw ?? "").trim() as PageType;
  return PAGE_TYPES.includes(v) ? v : null;
}

export async function updateSiteSeoBriefForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  if (!siteId) redirect("/sites");

  const primaryServices = parseListInput(String(formData.get("primaryServices") ?? ""));
  const targetAudience = String(formData.get("targetAudience") ?? "").trim() || null;
  const marketFocus = parseMarketFocus(String(formData.get("marketFocus") ?? ""));
  const serviceArea = parseListInput(String(formData.get("serviceArea") ?? ""));
  const primaryConversionGoal = String(formData.get("primaryConversionGoal") ?? "").trim() || null;
  const brandTone = parseBrandTone(String(formData.get("brandTone") ?? ""));
  const optionalPriorityKeyword = String(formData.get("optionalPriorityKeyword") ?? "").trim() || null;
  const priorityKeyword = optionalPriorityKeyword || String(formData.get("priorityKeyword") ?? "").trim() || null;
  const geoHint = String(formData.get("geoHint") ?? "").trim() || null;

  await prisma.site.update({
    where: { id: siteId },
    data: {
      primaryServices,
      targetAudience,
      marketFocus,
      serviceArea,
      primaryConversionGoal,
      brandTone,
      optionalPriorityKeyword,
      priorityKeyword,
      geoHint,
      geoAreaNoteVisible: buildGeoAreaNoteVisible({
        marketFocus,
        serviceArea: serviceArea.length ? serviceArea : geoHint ? [geoHint] : [],
        primaryServices,
        targetAudience: targetAudience ?? "",
      }),
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
  const topicHint = String(formData.get("topicHint") ?? "").trim() || undefined;
  const selectedOption = Number(String(formData.get("selectedOption") ?? "0"));
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

  const brief = buildSiteBriefFromSite(site);

  const strategy: PageType = pageType;
  const metadataOptions = buildMetadataOptions({
    brief,
    pageType: strategy,
    linkedService: page.service?.name ?? null,
    topicHint,
  });
  const index = Number.isFinite(selectedOption) ? Math.max(0, Math.min(2, selectedOption)) : 0;
  const selected = metadataOptions[index]!;

  await prisma.page.update({
    where: { id: pageId },
    data: {
      title: selected.title,
      metaDescription: selected.metaDescription,
      pageType: strategy,
    },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/metadata`);
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/pages");
  msgRedirect(siteId, "Selected metadata option applied. Keywords remain suggestions only.");
}

export async function previewSiteSuggestionsForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const pageId = String(formData.get("pageId") ?? "").trim();
  const pageType = String(formData.get("pageType") ?? "").trim();
  const topicHint = String(formData.get("topicHint") ?? "").trim();
  if (!siteId) redirect("/sites");
  const query = new URLSearchParams();
  if (pageId) query.set("pageId", pageId);
  if (pageType) query.set("pageType", pageType);
  if (topicHint) query.set("topicHint", topicHint);
  redirect(`/sites/${siteId}/metadata?${query.toString()}`);
}

export async function loadPreviewSuggestions(args: {
  siteId: string;
  pageId: string;
  pageType: PageType;
  topicHint?: string;
}) {
  const [site, page] = await Promise.all([
    prisma.site.findUnique({ where: { id: args.siteId } }),
    prisma.page.findFirst({ where: { id: args.pageId, siteId: args.siteId }, include: { service: true } }),
  ]);
  if (!site || !page) return null;
  const brief = buildSiteBriefFromSite(site);
  const metadataOptions = buildMetadataOptions({
    brief,
    pageType: args.pageType,
    linkedService: page.service?.name ?? null,
    topicHint: args.topicHint,
  });
  const keywordOptions = buildKeywordSuggestions({
    brief,
    pageKind: args.pageType === "blog" ? "blog-support" : "service",
  });
  return { site, page, brief, metadataOptions, keywordOptions };
}
