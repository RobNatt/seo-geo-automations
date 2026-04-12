"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  ctrFromRow,
  parseContentPerformanceCsv,
} from "@/lib/sites/content-performance-csv";
import { buildPageUrlLookup } from "@/lib/sites/content-performance-url";

const SOURCE_MANUAL = "manual";

export async function importContentPerformanceCsvForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const csvText = String(formData.get("csvText") ?? "");
  if (!siteId) return;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, rootUrl: true },
  });
  if (!site) {
    redirect("/sites?msg=" + encodeURIComponent("Site not found."));
  }

  const pages = await prisma.page.findMany({
    where: { siteId },
    select: { id: true, url: true },
  });
  const lookup = buildPageUrlLookup(pages);

  const parsed = parseContentPerformanceCsv(site.rootUrl, csvText, lookup);

  if (parsed.fatalErrors.length > 0) {
    redirect(`/sites/${siteId}?msg=${encodeURIComponent(parsed.fatalErrors.join(" "))}`);
  }

  if (parsed.rows.length === 0) {
    const hint =
      parsed.rowErrors.length > 0 ?
        parsed.rowErrors.join(" ")
      : "No valid rows. Check URL and date columns.";
    redirect(`/sites/${siteId}?msg=${encodeURIComponent(hint)}`);
  }

  for (const row of parsed.rows) {
    const ctr = ctrFromRow(row.impressions, row.clicks);
    await prisma.contentPerformanceSnapshot.upsert({
      where: {
        pageId_periodStart_periodEnd_source: {
          pageId: row.pageId,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          source: SOURCE_MANUAL,
        },
      },
      create: {
        siteId,
        pageId: row.pageId,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        source: SOURCE_MANUAL,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr,
        engagedSessions: row.engagedSessions,
        conversions: row.conversions,
        opportunityKey: row.opportunityKey,
        clusterKey: row.clusterKey,
        rawPayload: { importLine: row.lineNumber },
      },
      update: {
        impressions: row.impressions,
        clicks: row.clicks,
        ctr,
        engagedSessions: row.engagedSessions,
        conversions: row.conversions,
        opportunityKey: row.opportunityKey,
        clusterKey: row.clusterKey,
      },
    });
  }

  const tail =
    parsed.rowErrors.length > 0 ?
      ` Skipped/fixed rows: ${parsed.rowErrors.slice(0, 3).join("; ")}${parsed.rowErrors.length > 3 ? "…" : ""}`
    : "";
  const msg = `Imported ${parsed.rows.length} performance row(s).${tail}`;

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  redirect(`/sites/${siteId}?msg=${encodeURIComponent(msg)}`);
}
