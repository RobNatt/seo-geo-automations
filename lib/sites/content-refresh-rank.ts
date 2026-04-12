/**
 * Deterministic content refresh priority (no AI). Reuse on site detail, performance dashboard, reports.
 */

/** Stable ids for UI, logs, and copy — each line of scoreBreakdown uses one code. */
export const CONTENT_REFRESH_RULE = {
  NO_PERFORMANCE_DATA: "no_performance_data",
  STALE_PERIOD: "stale_period",
  CTR_BELOW_SITE_MEDIAN: "ctr_below_site_median",
  CTR_DROP_VS_PRIOR: "ctr_drop_vs_prior",
  TRAFFIC_DECLINE_VS_PRIOR: "traffic_decline_vs_prior",
  CLICKS_NO_CONVERSIONS: "clicks_no_conversions",
  LOW_ENGAGED_SESSIONS: "low_engaged_sessions",
  STRATEGIC_CONTENT_QUEUE: "strategic_content_queue",
  STRATEGIC_PROMPT_CLUSTER: "strategic_prompt_cluster",
  ROUTINE_MONITOR: "routine_monitor",
} as const;

/** Total score at or above this → tier `high` (refresh soon). Below → `maintenance`. */
export const CONTENT_REFRESH_HIGH_PRIORITY_MIN_SCORE = 42;

export type ContentRefreshTier = "high" | "maintenance";

export type ContentRefreshScoreBreakdownLine = {
  code: (typeof CONTENT_REFRESH_RULE)[keyof typeof CONTENT_REFRESH_RULE];
  points: number;
  detail: string;
};

export type PerformanceSnapshotInput = {
  pageId: string;
  periodStart: Date;
  periodEnd: Date;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  engagedSessions: number | null;
  conversions: number | null;
};

export type ContentRefreshCandidate = {
  pageId: string;
  url: string;
  title: string | null;
  refreshScore: number;
  tier: ContentRefreshTier;
  /** Ordered rule hits; sum(points) === refreshScore. */
  scoreBreakdown: ContentRefreshScoreBreakdownLine[];
  /** Human-readable lines (same as breakdown detail); convenient for simple lists. */
  reasons: string[];
  latestPeriodEnd: Date;
  latestImpressions: number | null;
  latestClicks: number | null;
  latestCtr: number | null;
  opportunityKey: string | null;
  clusterKey: string | null;
};

function effectiveCtr(s: PerformanceSnapshotInput): number | null {
  if (s.ctr != null && s.ctr >= 0 && s.ctr <= 1) return s.ctr;
  if (s.impressions != null && s.impressions > 0 && s.clicks != null) {
    return Math.round((s.clicks / s.impressions) * 1e6) / 1e6;
  }
  return null;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

const STALE_DAYS = 40;
const MIN_IMP_FOR_CTR_RULE = 50;
const MIN_IMP_FOR_MEDIAN = 20;
const MIN_CLK_CONV_RULE = 25;
const MIN_IMP_TRAFFIC_DECLINE = 80;
const TRAFFIC_DROP_RATIO = 0.75; // latest <= 75% of prior → decline

const PTS = {
  noData: 26,
  stale: 28,
  ctrBelowMedian: 24,
  ctrDrop: 16,
  trafficDecline: 22,
  clicksNoConv: 12,
  lowEngagement: 8,
  strategicQueue: 14,
  strategicCluster: 10,
  routine: 5,
} as const;

function sumBreakdown(lines: ContentRefreshScoreBreakdownLine[]): number {
  return lines.reduce((a, l) => a + l.points, 0);
}

function assignTier(score: number): ContentRefreshTier {
  return score >= CONTENT_REFRESH_HIGH_PRIORITY_MIN_SCORE ? "high" : "maintenance";
}

/**
 * Split candidates by tier (order preserved — call after rankPagesForContentRefresh).
 */
export function partitionContentRefreshByTier(candidates: ContentRefreshCandidate[]): {
  high: ContentRefreshCandidate[];
  maintenance: ContentRefreshCandidate[];
} {
  const high: ContentRefreshCandidate[] = [];
  const maintenance: ContentRefreshCandidate[] = [];
  for (const c of candidates) {
    if (c.tier === "high") high.push(c);
    else maintenance.push(c);
  }
  return { high, maintenance };
}

/** Plain-text block for launch report / exports (deterministic wording). */
export function buildContentRefreshPlainTextSection(candidates: ContentRefreshCandidate[]): string {
  if (candidates.length === 0) {
    return "";
  }
  const { high, maintenance } = partitionContentRefreshByTier(candidates);
  const lines: string[] = [];
  lines.push("CONTENT REFRESH PRIORITY (deterministic rules, no AI)");
  lines.push("-----------------------------------------------------");
  lines.push(`High priority = total score ≥ ${CONTENT_REFRESH_HIGH_PRIORITY_MIN_SCORE}; each line shows [code] and points.`);
  lines.push("");

  const formatOne = (c: ContentRefreshCandidate, idx: number) => {
    lines.push(`${idx}. [${c.tier}] score ${c.refreshScore} · ${c.url}`);
    for (const line of c.scoreBreakdown) {
      lines.push(`   +${line.points} [${line.code}] ${line.detail}`);
    }
    lines.push("");
  };

  lines.push(`HIGH PRIORITY (${high.length})`);
  lines.push("------------");
  if (high.length === 0) {
    lines.push("None.");
    lines.push("");
  } else {
    let n = 1;
    for (const c of high) {
      formatOne(c, n);
      n += 1;
    }
  }

  lines.push(`MAINTENANCE (${maintenance.length})`);
  lines.push("-----------");
  if (maintenance.length === 0) {
    lines.push("None.");
  } else {
    let n = 1;
    for (const c of maintenance) {
      formatOne(c, n);
      n += 1;
    }
  }

  return lines.join("\n").trimEnd();
}

export function rankPagesForContentRefresh(input: {
  pages: { id: string; url: string; title: string | null }[];
  snapshots: PerformanceSnapshotInput[];
  opportunityByPageId: Record<string, string>;
  clusterByPageId: Record<string, string>;
  now?: Date;
}): ContentRefreshCandidate[] {
  const now = input.now ?? new Date();
  const staleCutoff = new Date(now);
  staleCutoff.setUTCDate(staleCutoff.getUTCDate() - STALE_DAYS);

  const byPage = new Map<string, PerformanceSnapshotInput[]>();
  for (const s of input.snapshots) {
    const list = byPage.get(s.pageId) ?? [];
    list.push(s);
    byPage.set(s.pageId, list);
  }

  for (const [, list] of byPage) {
    list.sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime());
  }

  const latestCtrsForMedian: number[] = [];
  for (const [, list] of byPage) {
    const latest = list[0];
    if (!latest) continue;
    const imp = latest.impressions ?? 0;
    const ctr = effectiveCtr(latest);
    if (imp >= MIN_IMP_FOR_MEDIAN && ctr != null) {
      latestCtrsForMedian.push(ctr);
    }
  }
  const siteMedianCtr = median(latestCtrsForMedian);

  const out: ContentRefreshCandidate[] = [];

  for (const p of input.pages) {
    const list = byPage.get(p.id) ?? [];
    const latest = list[0];
    const prev = list[1];

    const breakdown: ContentRefreshScoreBreakdownLine[] = [];
    let hadPerformanceSignal = false;

    const opportunityKey = input.opportunityByPageId[p.id] ?? null;
    const clusterKey = input.clusterByPageId[p.id] ?? null;

    if (!latest) {
      breakdown.push({
        code: CONTENT_REFRESH_RULE.NO_PERFORMANCE_DATA,
        points: PTS.noData,
        detail: "No performance rows yet — import metrics or publish and measure.",
      });
      if (opportunityKey) {
        breakdown.push({
          code: CONTENT_REFRESH_RULE.STRATEGIC_CONTENT_QUEUE,
          points: PTS.strategicQueue,
          detail: "Linked to content queue opportunity (strategic refresh target).",
        });
      }
      if (clusterKey) {
        breakdown.push({
          code: CONTENT_REFRESH_RULE.STRATEGIC_PROMPT_CLUSTER,
          points: PTS.strategicCluster,
          detail: "Linked to a prompt cluster (strategic topic coverage).",
        });
      }
      const score = sumBreakdown(breakdown);
      out.push({
        pageId: p.id,
        url: p.url,
        title: p.title,
        refreshScore: score,
        tier: assignTier(score),
        scoreBreakdown: breakdown,
        reasons: breakdown.map((b) => b.detail),
        latestPeriodEnd: now,
        latestImpressions: null,
        latestClicks: null,
        latestCtr: null,
        opportunityKey,
        clusterKey,
      });
      continue;
    }

    const latestCtr = effectiveCtr(latest);
    const prevCtr = prev ? effectiveCtr(prev) : null;
    const imp = latest.impressions ?? 0;
    const clk = latest.clicks ?? 0;
    const conv = latest.conversions;
    const prevImp = prev?.impressions ?? null;

    if (latest.periodEnd.getTime() < staleCutoff.getTime()) {
      hadPerformanceSignal = true;
      breakdown.push({
        code: CONTENT_REFRESH_RULE.STALE_PERIOD,
        points: PTS.stale,
        detail: `Stale data: last period ended before ${staleCutoff.toISOString().slice(0, 10)}.`,
      });
    }

    if (siteMedianCtr != null && imp >= MIN_IMP_FOR_CTR_RULE && latestCtr != null) {
      if (latestCtr < siteMedianCtr * 0.65) {
        hadPerformanceSignal = true;
        breakdown.push({
          code: CONTENT_REFRESH_RULE.CTR_BELOW_SITE_MEDIAN,
          points: PTS.ctrBelowMedian,
          detail: `CTR below site median band (${(latestCtr * 100).toFixed(2)}% vs median ~${(siteMedianCtr * 100).toFixed(2)}%).`,
        });
      }
    }

    if (prevCtr != null && latestCtr != null && prevCtr > 0) {
      const rel = (prevCtr - latestCtr) / prevCtr;
      if (rel > 0.3) {
        hadPerformanceSignal = true;
        breakdown.push({
          code: CONTENT_REFRESH_RULE.CTR_DROP_VS_PRIOR,
          points: PTS.ctrDrop,
          detail: "CTR dropped materially vs prior period in imported data.",
        });
      }
    }

    if (
      prevImp != null &&
      prevImp >= MIN_IMP_TRAFFIC_DECLINE &&
      latest.impressions != null &&
      latest.impressions <= prevImp * TRAFFIC_DROP_RATIO
    ) {
      hadPerformanceSignal = true;
      breakdown.push({
        code: CONTENT_REFRESH_RULE.TRAFFIC_DECLINE_VS_PRIOR,
        points: PTS.trafficDecline,
        detail: `Impressions declined vs prior period (latest ${latest.impressions} vs prior ${prevImp}).`,
      });
    }

    if (conv !== null && conv === 0 && clk >= MIN_CLK_CONV_RULE) {
      hadPerformanceSignal = true;
      breakdown.push({
        code: CONTENT_REFRESH_RULE.CLICKS_NO_CONVERSIONS,
        points: PTS.clicksNoConv,
        detail: "Clicks without recorded conversions — verify tracking or strengthen CTA and landing alignment.",
      });
    }

    const eng = latest.engagedSessions;
    if (eng !== null && imp >= 80 && eng <= Math.max(1, Math.floor(imp * 0.02))) {
      hadPerformanceSignal = true;
      breakdown.push({
        code: CONTENT_REFRESH_RULE.LOW_ENGAGED_SESSIONS,
        points: PTS.lowEngagement,
        detail: "Engaged sessions very low relative to impressions (rough engagement signal).",
      });
    }

    if (opportunityKey) {
      breakdown.push({
        code: CONTENT_REFRESH_RULE.STRATEGIC_CONTENT_QUEUE,
        points: PTS.strategicQueue,
        detail: "Linked to content queue opportunity (strategic refresh target).",
      });
    }
    if (clusterKey) {
      breakdown.push({
        code: CONTENT_REFRESH_RULE.STRATEGIC_PROMPT_CLUSTER,
        points: PTS.strategicCluster,
        detail: "Linked to a prompt cluster (strategic topic coverage).",
      });
    }

    if (!hadPerformanceSignal) {
      breakdown.push({
        code: CONTENT_REFRESH_RULE.ROUTINE_MONITOR,
        points: PTS.routine,
        detail: "No strong performance rule fired — routine monitoring.",
      });
    }

    const score = sumBreakdown(breakdown);
    out.push({
      pageId: p.id,
      url: p.url,
      title: p.title,
      refreshScore: score,
      tier: assignTier(score),
      scoreBreakdown: breakdown,
      reasons: breakdown.map((b) => b.detail),
      latestPeriodEnd: latest.periodEnd,
      latestImpressions: latest.impressions,
      latestClicks: latest.clicks,
      latestCtr,
      opportunityKey,
      clusterKey,
    });
  }

  out.sort((a, b) => {
    const ta = a.tier === "high" ? 0 : 1;
    const tb = b.tier === "high" ? 0 : 1;
    if (ta !== tb) return ta - tb;
    if (b.refreshScore !== a.refreshScore) return b.refreshScore - a.refreshScore;
    return a.url.localeCompare(b.url);
  });

  return out;
}
