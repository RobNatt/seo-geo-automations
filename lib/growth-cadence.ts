export const GROWTH_CADENCES = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;

export type GrowthCadence = (typeof GROWTH_CADENCES)[number];
export type GrowthPriority = "high" | "medium" | "low";

export type GrowthTaskBlueprint = {
  cadence: GrowthCadence;
  taskKey: string;
  description: string;
  nextAction: string;
  priority: GrowthPriority;
};

export const CORE_GROWTH_TASKS: GrowthTaskBlueprint[] = [
  {
    cadence: "weekly",
    taskKey: "gsc_performance_snapshot",
    description: "GSC performance snapshot",
    nextAction: "Review top queries/pages and log notable drops or climbs for this week.",
    priority: "high",
  },
  {
    cadence: "weekly",
    taskKey: "core_web_vitals_sanity",
    description: "Core Web Vitals sanity check",
    nextAction: "Run quick CWV/Lighthouse checks on homepage + one money page.",
    priority: "high",
  },
  {
    cadence: "weekly",
    taskKey: "publish_one_blog",
    description: "Publish 1 blog post",
    nextAction: "Ship one useful post and link it to a service pillar and conversion path.",
    priority: "medium",
  },
  {
    cadence: "biweekly",
    taskKey: "publish_or_update_topic_page",
    description: "Publish/update one topic page",
    nextAction: "Add or improve one topic/location page tied to query demand.",
    priority: "medium",
  },
  {
    cadence: "biweekly",
    taskKey: "internal_link_pass",
    description: "Internal link pass on recent content",
    nextAction: "Ensure new posts/pages link to service pillars and conversion URLs.",
    priority: "medium",
  },
  {
    cadence: "monthly",
    taskKey: "refresh_low_ctr_pages",
    description: "Refresh 2-4 pages with impressions but low CTR",
    nextAction: "Update title/meta/intro/internal links on weak CTR pages.",
    priority: "high",
  },
  {
    cadence: "monthly",
    taskKey: "content_roi_review",
    description: "Content ROI review",
    nextAction: "Identify formats/topics driving engaged sessions and assists; plan next batch.",
    priority: "medium",
  },
  {
    cadence: "monthly",
    taskKey: "gbp_photos_refresh",
    description: "GBP photo refresh reminder",
    nextAction: "Add new GBP photos/posts and ensure offer messaging is current.",
    priority: "low",
  },
  {
    cadence: "quarterly",
    taskKey: "topic_cluster_roadmap",
    description: "Topic cluster roadmap update",
    nextAction: "Plan next quarter clusters from query gaps and recurring sales questions.",
    priority: "medium",
  },
  {
    cadence: "quarterly",
    taskKey: "competitor_gap_summary",
    description: "Competitor gap summary",
    nextAction: "Compare 2-3 competitors and capture ranking/topic gaps for next quarter.",
    priority: "medium",
  },
];

export type GrowthScanContext = {
  lowCtrPageCount: number;
  hasRecentContent: boolean;
  gscSnapshotMock: { queriesChecked: number; pagesChecked: number };
  competitorNames: string[];
};

export function nextDueDateForCadence(cadence: GrowthCadence, now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);

  if (cadence === "daily") {
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  if (cadence === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  if (cadence === "biweekly") {
    d.setUTCDate(d.getUTCDate() + 14);
    return d;
  }
  if (cadence === "monthly") {
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }
  if (cadence === "quarterly") {
    d.setUTCMonth(d.getUTCMonth() + 3);
    return d;
  }
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

function withContextNextAction(base: GrowthTaskBlueprint, ctx: GrowthScanContext): string {
  switch (base.taskKey) {
    case "refresh_low_ctr_pages":
      return `${base.nextAction} Currently flagged pages: ${ctx.lowCtrPageCount}.`;
    case "internal_link_pass":
      return ctx.hasRecentContent
        ? `${base.nextAction} Prioritize newly published pages from the last 30 days.`
        : `${base.nextAction} No recent content detected; run pass on last quarter’s posts.`;
    case "gsc_performance_snapshot":
      return `${base.nextAction} Mock scan baseline: ${ctx.gscSnapshotMock.queriesChecked} queries across ${ctx.gscSnapshotMock.pagesChecked} pages.`;
    case "competitor_gap_summary":
      return `${base.nextAction} Mock competitor set: ${ctx.competitorNames.join(", ")}.`;
    default:
      return base.nextAction;
  }
}

/**
 * Deterministic cadence plan. Manual execution only; no auto-completion.
 */
export function buildGrowthCadenceTasks(now: Date, ctx: GrowthScanContext): Array<GrowthTaskBlueprint & { dueDate: Date }> {
  return CORE_GROWTH_TASKS.map((t) => ({
    ...t,
    nextAction: withContextNextAction(t, ctx),
    dueDate: nextDueDateForCadence(t.cadence, now),
  }));
}
