import {
  CONTENT_REFRESH_RULE,
  type ContentRefreshCandidate,
  type PerformanceSnapshotInput,
} from "@/lib/sites/content-refresh-rank";

export type ContentPerformanceInsightRow = {
  pageId: string;
  url: string;
  title: string | null;
  reason: string;
};

const TOP_N = 6;
const DECLINING_N = 8;
const REFRESH_N = 8;
const MIN_IMP_TOP = 50;
const MIN_CLK_TOP = 2;

const DECLINING_CODES = new Set<string>([
  CONTENT_REFRESH_RULE.TRAFFIC_DECLINE_VS_PRIOR,
  CONTENT_REFRESH_RULE.CTR_DROP_VS_PRIOR,
]);

const SHORT_REASON_MAX = 130;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function effectiveCtr(s: PerformanceSnapshotInput): number | null {
  if (s.ctr != null && s.ctr >= 0 && s.ctr <= 1) return s.ctr;
  if (s.impressions != null && s.impressions > 0 && s.clicks != null) {
    return Math.round((s.clicks / s.impressions) * 1e6) / 1e6;
  }
  return null;
}

function shortNeedRefreshReason(c: ContentRefreshCandidate): string {
  const skipOnly = new Set<string>([
    CONTENT_REFRESH_RULE.STRATEGIC_CONTENT_QUEUE,
    CONTENT_REFRESH_RULE.STRATEGIC_PROMPT_CLUSTER,
    CONTENT_REFRESH_RULE.ROUTINE_MONITOR,
  ]);
  const perf = c.scoreBreakdown.find((b) => !skipOnly.has(b.code));
  if (perf) return truncate(perf.detail, SHORT_REASON_MAX);
  const first = c.scoreBreakdown[0];
  return first ? truncate(first.detail, SHORT_REASON_MAX) : "Review refresh priority.";
}

function decliningReason(c: ContentRefreshCandidate): string {
  const traffic = c.scoreBreakdown.find((b) => b.code === CONTENT_REFRESH_RULE.TRAFFIC_DECLINE_VS_PRIOR);
  const ctr = c.scoreBreakdown.find((b) => b.code === CONTENT_REFRESH_RULE.CTR_DROP_VS_PRIOR);
  if (traffic && ctr) {
    return truncate(`${traffic.detail} ${ctr.detail}`, SHORT_REASON_MAX);
  }
  return truncate(traffic?.detail ?? ctr?.detail ?? "Declining vs prior period.", SHORT_REASON_MAX);
}

/**
 * At-a-glance lists for site performance UI: top pages, declining momentum, refresh backlog.
 * All deterministic from snapshots + existing refresh ranking.
 */
export function buildContentPerformanceInsights(input: {
  pages: { id: string; url: string; title: string | null }[];
  snapshots: PerformanceSnapshotInput[];
  refreshCandidates: ContentRefreshCandidate[];
}): {
  topPerforming: ContentPerformanceInsightRow[];
  declining: ContentPerformanceInsightRow[];
  needingRefresh: ContentPerformanceInsightRow[];
} {
  const pageById = new Map(input.pages.map((p) => [p.id, p]));

  const byPage = new Map<string, PerformanceSnapshotInput[]>();
  for (const s of input.snapshots) {
    const list = byPage.get(s.pageId) ?? [];
    list.push(s);
    byPage.set(s.pageId, list);
  }
  for (const [, list] of byPage) {
    list.sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime());
  }

  const topPerforming: ContentPerformanceInsightRow[] = [];
  const topRows: { pageId: string; clicks: number; impressions: number; ctr: number; latest: PerformanceSnapshotInput }[] =
    [];
  for (const [pageId, list] of byPage) {
    const latest = list[0];
    if (!latest) continue;
    const imp = latest.impressions ?? 0;
    const clk = latest.clicks ?? 0;
    if (imp < MIN_IMP_TOP || clk < MIN_CLK_TOP) continue;
    const ctr = effectiveCtr(latest) ?? 0;
    topRows.push({ pageId, clicks: clk, impressions: imp, ctr, latest });
  }
  topRows.sort((a, b) => {
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;
    if (b.impressions !== a.impressions) return b.impressions - a.impressions;
    return b.ctr - a.ctr;
  });
  for (const row of topRows.slice(0, TOP_N)) {
    const p = pageById.get(row.pageId);
    if (!p) continue;
    const ctrPct = row.ctr >= 0 && row.ctr <= 1 ? (row.ctr * 100).toFixed(1) : "—";
    topPerforming.push({
      pageId: row.pageId,
      url: p.url,
      title: p.title,
      reason: `Latest period: ${row.impressions.toLocaleString()} impressions, ${row.clicks} clicks, ${ctrPct}% CTR.`,
    });
  }

  const decliningCandidates = input.refreshCandidates
    .filter((c) => c.scoreBreakdown.some((b) => DECLINING_CODES.has(b.code)))
    .sort((a, b) => b.refreshScore - a.refreshScore);

  const declining: ContentPerformanceInsightRow[] = [];
  const seenDecl = new Set<string>();
  for (const c of decliningCandidates) {
    if (seenDecl.has(c.pageId)) continue;
    seenDecl.add(c.pageId);
    declining.push({
      pageId: c.pageId,
      url: c.url,
      title: c.title,
      reason: decliningReason(c),
    });
    if (declining.length >= DECLINING_N) break;
  }

  const needingRefresh: ContentPerformanceInsightRow[] = [];
  for (const c of input.refreshCandidates) {
    if (c.tier !== "high") continue;
    needingRefresh.push({
      pageId: c.pageId,
      url: c.url,
      title: c.title,
      reason: shortNeedRefreshReason(c),
    });
    if (needingRefresh.length >= REFRESH_N) break;
  }

  return { topPerforming, declining, needingRefresh };
}
