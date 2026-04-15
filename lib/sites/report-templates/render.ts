import { formatRunSummary } from "@/lib/audits/format-summary";
import { buildContentGapsPlainTextSection } from "@/lib/sites/content-gap-rank";
import { buildLaunchReportPlainText } from "@/lib/sites/launch-report-text";
import { segmentLabel, type GrowthOpportunitySegment } from "@/lib/sites/content-pipeline";
import { buildContentRefreshPlainTextSection } from "@/lib/sites/content-refresh-rank";

import type { ReportTemplateId } from "./constants";
import type { SiteReportSnapshot } from "./types";

const OPEN_TASKS_SEO = 6;
const REASON_MAX = 160;
const DONE_FIXES_CAP_NOTE = 25;

function truncate(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function renderMonthlySeo(s: SiteReportSnapshot): string {
  const { labelLong, labelShort } = s.month;
  const lines: string[] = [];
  lines.push("MONTHLY SEO REPORT");
  lines.push("==================");
  lines.push(`Site: ${s.site.businessName}`);
  lines.push(`URL: ${s.site.rootUrl}`);
  lines.push(`Reporting month (UTC): ${labelLong} (${labelShort})`);
  lines.push(
    "Focus: Search visibility and on-site SEO — imported performance, completed fixes, and backlog.",
  );
  lines.push(
    "Scope: Performance = snapshot rows whose period end falls in this month. Fixes completed = tasks marked done this month (by last update time).",
  );
  lines.push(`Generated: ${s.generatedAt.toISOString()}`);
  lines.push("");
  lines.push("CURRENT STATUS (as of this export)");
  lines.push("----------------------------------");
  lines.push(`Launch readiness: ${s.readiness.stateLabel}`);
  lines.push(`Guidance: ${s.readiness.nextStep}`);
  if (s.latestAudit) {
    lines.push(
      `Latest homepage audit: ${s.latestAudit.status}${
        s.latestAudit.summaryRaw ? ` · ${formatRunSummary(s.latestAudit.summaryRaw)}` : ""
      }`,
    );
    if (s.latestAudit.startedAt) lines.push(`Audit started: ${s.latestAudit.startedAt.toISOString()}`);
  } else {
    lines.push("Latest homepage audit: none yet.");
  }
  lines.push(
    `Launch checklist: ${s.launchChecklistItems.filter((i) => i.done).length}/${s.launchChecklistItems.length} complete`,
  );
  lines.push(`Open fix tasks: ${s.openFixTasks.length}`);
  lines.push("");

  lines.push(`PERFORMANCE (${labelLong})`);
  lines.push(`${"-".repeat(Math.max(12, labelLong.length + 14))}`);
  if (s.performance.rowCount === 0) {
    lines.push("No imported performance rows with period end in this month.");
  } else {
    lines.push(`Snapshot rows in period: ${s.performance.rowCount}`);
    lines.push(
      `Totals: ${s.performance.totalImp.toLocaleString()} impressions, ${s.performance.totalClk.toLocaleString()} clicks`,
    );
    lines.push("Top pages by impressions:");
    s.performance.topPages.forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.url}`);
      lines.push(`     ${p.imp.toLocaleString()} impressions · ${p.clk.toLocaleString()} clicks`);
    });
  }
  lines.push("");

  lines.push(`FIXES COMPLETED (${labelLong})`);
  lines.push("-------------------------");
  if (s.doneFixesThisMonth.length === 0) {
    lines.push("None recorded in this month.");
  } else {
    for (const t of s.doneFixesThisMonth) {
      lines.push(`• ${t.title}`);
    }
    if (s.doneFixesThisMonth.length >= DONE_FIXES_CAP_NOTE) {
      lines.push(`(Showing up to ${DONE_FIXES_CAP_NOTE} most recently updated.)`);
    }
  }
  lines.push("");

  lines.push("NEXT PRIORITIES (SEO backlog)");
  lines.push("----------------------------");
  lines.push("Open fix tasks:");
  if (s.openFixTasks.length === 0) {
    lines.push("  None.");
  } else {
    s.openFixTasks.slice(0, OPEN_TASKS_SEO).forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t.title}`);
      if (t.detail?.trim()) {
        lines.push(`     ${truncate(t.detail, REASON_MAX)}`);
      }
    });
    if (s.openFixTasks.length > OPEN_TASKS_SEO) {
      lines.push(`  (${s.openFixTasks.length - OPEN_TASKS_SEO} more not listed.)`);
    }
  }
  lines.push("");
  lines.push("Pages to refresh (high-priority, rule-based):");
  if (s.refreshHigh.length === 0) {
    lines.push("  None in the high-priority band, or no performance import yet.");
  } else {
    for (const c of s.refreshHigh) {
      lines.push(`• ${c.url}`);
      if (c.reasonLine) lines.push(`  ${c.reasonLine}`);
    }
  }
  lines.push("");
  lines.push("Content opportunities (ranked):");
  if (s.growthOpportunities.length === 0) {
    lines.push("  None listed.");
  } else {
    s.growthOpportunities.forEach((o, i) => {
      lines.push(`  ${i + 1}. [${segmentLabel(o.segment)}] ${o.headline}`);
      lines.push(`     ${truncate(o.summaryReason, REASON_MAX)}`);
    });
  }
  lines.push("");
  lines.push("---");
  lines.push("Plain text — suitable for email, Docs, or Print → PDF.");
  return lines.join("\n");
}

const GEO_SEGMENT_RANK: Record<GrowthOpportunitySegment, number> = {
  onpage: 0,
  faq: 1,
  service: 2,
  supporting: 3,
};

function renderGeoFocus(s: SiteReportSnapshot): string {
  const { labelLong, labelShort } = s.month;
  const lines: string[] = [];
  lines.push("MONTHLY GEO / AI VISIBILITY REPORT");
  lines.push("==================================");
  lines.push(`Site: ${s.site.businessName}`);
  lines.push(`URL: ${s.site.rootUrl}`);
  lines.push(`Reporting month (UTC): ${labelLong} (${labelShort})`);
  lines.push(
    "Focus: How clearly the business shows up for humans and AI-style discovery — location, topics, and helpful content.",
  );
  lines.push(`Generated: ${s.generatedAt.toISOString()}`);
  lines.push("");

  lines.push("BUSINESS & COVERAGE CONTEXT");
  lines.push("---------------------------");
  lines.push(s.site.geoHint?.trim() ? `Service area note: ${s.site.geoHint}` : "Service area note: (not set in profile)");
  lines.push(
    s.site.primaryFocus?.trim() ?
      `Primary focus: ${s.site.primaryFocus}`
    : "Primary focus: (not set in profile)",
  );
  lines.push("");

  const geoChecklist = s.launchChecklistItems.filter(
    (i) => i.category === "GEO" || /location|service area|visible|GEO/i.test(i.label),
  );
  lines.push("LAUNCH CHECKLIST (GEO-related)");
  lines.push("------------------------------");
  if (geoChecklist.length === 0) {
    lines.push("No dedicated GEO rows in the fixed checklist — see full checklist in the launch template.");
  } else {
    for (const i of geoChecklist) {
      lines.push(`${i.done ? "[x]" : "[ ]"} ${i.label}`);
    }
  }
  lines.push("");

  lines.push("SITE REVIEW (homepage)");
  lines.push("----------------------");
  if (s.latestAudit) {
    lines.push(`Status: ${s.latestAudit.status}`);
    lines.push(
      s.latestAudit.summaryRaw ? `Summary: ${formatRunSummary(s.latestAudit.summaryRaw)}` : "Summary: —",
    );
    lines.push(`Issues to fix: ${s.latestAudit.failCount} · Items to review: ${s.latestAudit.warnCount}`);
  } else {
    lines.push("No audit run yet.");
  }
  lines.push("");

  lines.push(`DEMAND SIGNALS (${labelShort})`);
  lines.push(`${"-".repeat(20 + labelShort.length)}`);
  if (s.performance.rowCount === 0) {
    lines.push("No imported demand data for this month.");
  } else {
    lines.push(`Imported rows: ${s.performance.rowCount}`);
    lines.push(
      `Totals: ${s.performance.totalImp.toLocaleString()} impressions, ${s.performance.totalClk.toLocaleString()} clicks`,
    );
    lines.push("Strongest URLs this month:");
    s.performance.topPages.forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.url} — ${p.imp.toLocaleString()} imp, ${p.clk.toLocaleString()} clk`);
    });
  }
  lines.push("");

  const sortedGeo = [...s.growthOpportunities].sort((a, b) => {
    const ra = GEO_SEGMENT_RANK[a.segment] ?? 9;
    const rb = GEO_SEGMENT_RANK[b.segment] ?? 9;
    if (ra !== rb) return ra - rb;
    return b.composite - a.composite;
  });

  lines.push("TOPICS & CONTENT TO STRENGTHEN (GEO-ordered)");
  lines.push("-------------------------------------------");
  if (sortedGeo.length === 0) {
    lines.push("None listed.");
  } else {
    sortedGeo.slice(0, 12).forEach((o, i) => {
      lines.push(`  ${i + 1}. [${segmentLabel(o.segment)}] ${o.headline}`);
      lines.push(`     ${truncate(o.summaryReason, REASON_MAX)}`);
    });
  }
  lines.push("");

  lines.push("CONTENT FRESHNESS (high-priority refreshes)");
  lines.push("--------------------------------------------");
  if (s.refreshHigh.length === 0) {
    lines.push("None flagged.");
  } else {
    for (const c of s.refreshHigh) {
      lines.push(`• ${c.url}`);
      if (c.reasonLine) lines.push(`  ${c.reasonLine}`);
    }
  }
  lines.push("");

  lines.push(`COMPLETED THIS MONTH (${labelShort})`);
  lines.push("------------------------------------");
  if (s.doneFixesThisMonth.length === 0) {
    lines.push("None recorded.");
  } else {
    for (const t of s.doneFixesThisMonth.slice(0, 15)) {
      lines.push(`• ${t.title}`);
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("Plain text — suitable for email, Docs, or Print → PDF.");
  return lines.join("\n");
}

function renderLaunchReadiness(s: SiteReportSnapshot): string {
  const gaps = buildContentGapsPlainTextSection(s.rankedContentGaps);
  const refresh = buildContentRefreshPlainTextSection(s.refreshCandidates);
  return buildLaunchReportPlainText({
    generatedAtIso: s.generatedAt.toISOString(),
    businessName: s.site.businessName,
    rootUrl: s.site.rootUrl,
    homepageUrl: s.homepageUrl,
    readinessLabel: s.readiness.stateLabel,
    readinessNextStep: s.readiness.nextStep,
    launchBlockers: s.launchBlockers,
    latestAudit:
      s.latestAudit && s.latestAudit.startedAt ?
        {
          status: s.latestAudit.status,
          startedAtIso: s.latestAudit.startedAt.toISOString(),
          summaryLine: s.latestAudit.summaryRaw ? formatRunSummary(s.latestAudit.summaryRaw) : "—",
        }
      : null,
    checklistItems: s.launchChecklistItems.map((i) => ({ label: i.label, done: i.done })),
    openFixes: s.openFixTasks.map((t) => ({
      bucket: t.bucket,
      priorityScore: t.priorityScore,
      title: t.title,
      detail: t.detail,
    })),
    contentGapsPlainTextSection: gaps || undefined,
    contentRefreshPlainTextSection: refresh.trim() ? refresh : undefined,
  });
}

function renderMonthlyOps(s: SiteReportSnapshot): string {
  const { labelLong, labelShort } = s.month;
  const lines: string[] = [];
  lines.push("# Monthly Executive SEO/GEO Report");
  lines.push("");
  lines.push(`- Client: ${s.site.businessName}`);
  lines.push(`- Website: ${s.site.rootUrl}`);
  lines.push(`- Reporting month (UTC): ${labelLong} (${labelShort})`);
  lines.push(`- Generated: ${s.generatedAt.toISOString()}`);
  lines.push("");
  lines.push("## Business Outcome Summary");
  lines.push(`- Readiness: **${s.readiness.stateLabel}**`);
  lines.push(`- Next best focus: ${s.readiness.nextStep}`);
  lines.push(`- Lighthouse scores: performance ${s.lighthouse.performanceScore ?? "—"}, accessibility ${s.lighthouse.accessibilityScore ?? "—"}, best-practices ${s.lighthouse.bestPracticesScore ?? "—"}, SEO ${s.lighthouse.seoScore ?? "—"}`);
  lines.push(`- Operational health: ${s.maintenance.activeCount} active maintenance alerts, ${s.growth.pendingCount} pending growth tasks, ${s.contentOpportunities.openCount} open content opportunities`);
  lines.push("");
  lines.push("## Phase Progress (0-6)");
  lines.push("- Phase 0 Core foundation: complete");
  lines.push("- Phase 1 Set & Forget baseline: complete");
  lines.push("- Phase 2 Lighthouse + Core Web Vitals: complete");
  lines.push("- Phase 3 Maintenance automation: complete");
  lines.push("- Phase 4 Growth cadence automation: complete");
  lines.push(
    `- Phase 5 Content & GEO opportunity engine: ${s.contentOpportunities.openCount > 0 || s.contentOpportunities.doneThisMonthCount > 0 ? "active" : "needs generation"}`,
  );
  lines.push(
    `- Phase 6 Partnerships & reporting polish: ${s.partnerships.doneCount > 0 || s.partnerships.inProgressCount > 0 ? "active" : "starting"}`,
  );
  lines.push("");
  lines.push(`## Completed This Month (${labelShort})`);
  lines.push(`- Fix tasks completed: ${s.doneFixesThisMonth.length}`);
  lines.push(`- Growth tasks completed: ${s.growth.doneThisMonthCount}`);
  lines.push(`- Content opportunities completed: ${s.contentOpportunities.doneThisMonthCount}`);
  lines.push(`- Partnership activities logged: ${s.partnerships.activityThisMonthCount}`);
  lines.push("");
  lines.push("## Next Priorities");
  lines.push(`1. Clear the top ${Math.min(3, s.openFixTasks.length)} open SEO fix tasks and protect readiness.`);
  lines.push("2. Publish one high-intent content opportunity and one FAQ/schema update.");
  lines.push("3. Progress two partnership items (directories + one referral/byline channel).");
  lines.push("4. Re-run Lighthouse and target green bands across primary scores.");
  lines.push("");
  return lines.join("\n");
}

export function renderSiteReportTemplate(id: ReportTemplateId, snapshot: SiteReportSnapshot): string {
  switch (id) {
    case "monthly_seo":
      return renderMonthlySeo(snapshot);
    case "geo_focus":
      return renderGeoFocus(snapshot);
    case "launch_readiness":
      return renderLaunchReadiness(snapshot);
    case "monthly_ops":
      return renderMonthlyOps(snapshot);
  }
}
