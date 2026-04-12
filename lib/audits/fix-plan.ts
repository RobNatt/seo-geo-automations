/**
 * Deterministic fix recommendations from audit rows (no AI).
 *
 * ## Priority score (sorting within a time bucket)
 * Integer score; higher = address first.
 *
 *   priorityScore = 100 × I − 10 × E + 5 × S
 *
 * Where:
 *   I = impact weight: high=3, medium=2, low=1
 *   E = effort weight: low=1, medium=2, high=3 (harder work lowers the score)
 *   S = severity weight: high=3, medium=2, low=1
 *
 * Example: impact high, effort low, severity high → 100×3 − 10×1 + 5×3 = 305.
 *
 * ## Time buckets (immediate / soon / later)
 * Applied after each fix is built, in order:
 *   1. `url_resolvable` with status fail → **immediate** (blocking).
 *   2. `meta_description_present` with status warn → **later** (snippet tuning, non-blocking).
 *   3. impact **high** and effort **low** → **immediate** (quick wins).
 *   4. impact **low**, OR (effort **high** and impact not **high**) → **later**.
 *   5. Otherwise → **soon**.
 *
 * Within each bucket, fixes are sorted by `priorityScore` descending, then `key` ascending for ties.
 */

export type FixBucket = "immediate" | "soon" | "later";

export type AuditResultInput = {
  checkKey: string;
  status: string;
  message: string | null;
};

export type FixRecommendation = {
  key: string;
  checkKey: string;
  sourceStatus: string;
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  severity: "high" | "medium" | "low";
  bucket: FixBucket;
  priorityScore: number;
  /** How the numeric score was formed. */
  rankingNote: string;
  /** Why this bucket was chosen (rule trace). */
  bucketReason: string;
};

function impactWeight(i: FixRecommendation["impact"]) {
  return i === "high" ? 3 : i === "medium" ? 2 : 1;
}

function effortWeight(e: FixRecommendation["effort"]) {
  return e === "low" ? 1 : e === "medium" ? 2 : 3;
}

function severityWeight(s: FixRecommendation["severity"]) {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

/** Documented formula: higher = more urgent. */
export function computePriorityScore(
  f: Pick<FixRecommendation, "impact" | "effort" | "severity">,
): number {
  const I = impactWeight(f.impact);
  const E = effortWeight(f.effort);
  const S = severityWeight(f.severity);
  return 100 * I - 10 * E + 5 * S;
}

export function formatRankingNote(
  f: Pick<FixRecommendation, "impact" | "effort" | "severity" | "priorityScore" | "bucket" | "bucketReason">,
): string {
  const I = impactWeight(f.impact);
  const E = effortWeight(f.effort);
  const S = severityWeight(f.severity);
  return `Score ${f.priorityScore} = 100×${I} (impact) − 10×${E} (effort) + 5×${S} (severity). Bucket “${f.bucket}”: ${f.bucketReason}`;
}

export function assignBucket(
  f: Pick<FixRecommendation, "checkKey" | "sourceStatus" | "impact" | "effort">,
): FixBucket {
  const i = impactWeight(f.impact);
  const e = effortWeight(f.effort);

  if (f.checkKey === "url_resolvable" && (f.sourceStatus === "fail" || f.sourceStatus === "error")) {
    return "immediate";
  }
  if (f.checkKey === "meta_description_present" && f.sourceStatus === "warn") {
    return "later";
  }
  if (f.checkKey === "geo_hint") {
    return "soon";
  }
  if (i === 3 && e === 1) {
    return "immediate";
  }
  if (i === 1 || (e === 3 && i < 3)) {
    return "later";
  }
  return "soon";
}

function bucketReasonFor(
  f: Pick<FixRecommendation, "checkKey" | "sourceStatus" | "impact" | "effort">,
  bucket: FixBucket,
): string {
  if (f.checkKey === "url_resolvable" && (f.sourceStatus === "fail" || f.sourceStatus === "error")) {
    return "blocking rule — homepage cannot be fetched.";
  }
  if (f.checkKey === "meta_description_present" && f.sourceStatus === "warn") {
    return "tuning rule — non-blocking snippet length advisory.";
  }
  if (f.checkKey === "geo_hint") {
    return "contextual GEO advisory after core HTML checks.";
  }
  if (bucket === "immediate") {
    return "high impact and low effort (quick win).";
  }
  if (bucket === "later") {
    return "low impact, or high effort without high impact.";
  }
  return "default middle tier — meaningful but not the first quick win.";
}

function finalize(
  partial: Omit<FixRecommendation, "bucket" | "priorityScore" | "rankingNote" | "bucketReason">,
): FixRecommendation {
  const bucket = assignBucket(partial);
  const bucketReason = bucketReasonFor(partial, bucket);
  const withReason = { ...partial, bucket, bucketReason };
  const priorityScore = computePriorityScore(partial);
  const rankingNote = formatRankingNote({ ...withReason, priorityScore });
  return { ...withReason, priorityScore, rankingNote };
}

export type BuildFixOptions = {
  /** Optional GEO context from onboarding (not an audit row). */
  geoHint?: string | null;
};

/**
 * Turns non-passing audit results into actionable fixes. Deterministic; same inputs → same output.
 */
export function buildFixRecommendations(
  results: AuditResultInput[],
  options: BuildFixOptions = {},
): FixRecommendation[] {
  const fetchFailed = results.some(
    (r) => r.checkKey === "url_resolvable" && (r.status === "fail" || r.status === "error"),
  );

  const drafts: Omit<FixRecommendation, "bucket" | "priorityScore" | "rankingNote" | "bucketReason">[] = [];

  for (const r of results) {
    if (r.status === "pass") continue;

    if (r.checkKey === "url_resolvable" && (r.status === "fail" || r.status === "error")) {
      drafts.push({
        key: `url_resolvable:${r.status}`,
        checkKey: r.checkKey,
        sourceStatus: r.status,
        title: "Fix site availability",
        detail:
          r.message ??
          "The page could not be fetched. Verify DNS, TLS, hosting, and that the URL responds with HTML.",
        severity: "high",
        effort: "medium",
        impact: "high",
      });
    }

    if (r.checkKey === "title_present") {
      if (r.status === "fail") {
        drafts.push({
          key: "title_present:fail",
          checkKey: r.checkKey,
          sourceStatus: r.status,
          title: "Add a unique page title",
          detail:
            "Set a descriptive <title> (typically ~50–60 characters: primary topic + brand).",
          severity: "high",
          effort: "low",
          impact: "high",
        });
      } else if (r.status === "skipped" && !fetchFailed) {
        drafts.push({
          key: "title_present:skipped",
          checkKey: r.checkKey,
          sourceStatus: r.status,
          title: "Unblock HTML crawl for title checks",
          detail: "Resolve fetch or HTML issues first, then re-run the audit to evaluate the title tag.",
          severity: "high",
          effort: "medium",
          impact: "high",
        });
      }
    }

    if (r.checkKey === "meta_description_present") {
      if (r.status === "fail") {
        drafts.push({
          key: "meta_description_present:fail",
          checkKey: r.checkKey,
          sourceStatus: r.status,
          title: "Add a meta description",
          detail:
            "Add meta name=\"description\" with a concise summary (often ~150–160 characters) aligned with search intent.",
          severity: "medium",
          effort: "low",
          impact: "high",
        });
      } else if (r.status === "warn") {
        drafts.push({
          key: "meta_description_present:warn",
          checkKey: r.checkKey,
          sourceStatus: r.status,
          title: "Tune meta description length",
          detail: r.message ?? "Adjust length so snippets are useful in SERPs without unnecessary truncation.",
          severity: "low",
          effort: "low",
          impact: "medium",
        });
      } else if (r.status === "skipped" && !fetchFailed) {
        drafts.push({
          key: "meta_description_present:skipped",
          checkKey: r.checkKey,
          sourceStatus: r.status,
          title: "Unblock HTML crawl for meta description",
          detail: "Resolve fetch or HTML issues first, then re-run the audit for meta description.",
          severity: "medium",
          effort: "medium",
          impact: "medium",
        });
      }
    }
  }

  const hint = options.geoHint?.trim();
  if (hint) {
    drafts.push({
      key: "geo_hint:advisory",
      checkKey: "geo_hint",
      sourceStatus: "advisory",
      title: "Clarify local / service-area presence on the page",
      detail: `You indicated geography: “${hint}”. Add visible NAP or service-area copy where appropriate; plan valid LocalBusiness / area schema when ready.`,
      severity: "medium",
      effort: "medium",
      impact: "medium",
    });
  }

  const seen = new Set<string>();
  const unique = drafts.filter((d) => {
    if (seen.has(d.key)) return false;
    seen.add(d.key);
    return true;
  });

  return unique.map(finalize).sort((a, b) => {
    const order: FixBucket[] = ["immediate", "soon", "later"];
    const bo = order.indexOf(a.bucket) - order.indexOf(b.bucket);
    if (bo !== 0) return bo;
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return a.key.localeCompare(b.key);
  });
}

export function groupFixesByBucket(fixes: FixRecommendation[]): Record<FixBucket, FixRecommendation[]> {
  const empty: Record<FixBucket, FixRecommendation[]> = {
    immediate: [],
    soon: [],
    later: [],
  };
  for (const f of fixes) {
    empty[f.bucket].push(f);
  }
  for (const b of Object.keys(empty) as FixBucket[]) {
    empty[b].sort((a, c) => {
      if (c.priorityScore !== a.priorityScore) return c.priorityScore - a.priorityScore;
      return a.key.localeCompare(c.key);
    });
  }
  return empty;
}

/**
 * Maps one check row to the same FixRecommendation (and dedupeKey) used by sync-from-audit,
 * using full run results so rules like fetchFailed stay correct. Unknown checks get a generic recommendation.
 */
export function fixRecommendationForRunCheck(
  fullResults: AuditResultInput[],
  target: AuditResultInput,
): FixRecommendation | null {
  if (target.status === "pass") return null;
  const fixes = buildFixRecommendations(fullResults, { geoHint: null });
  const exact = fixes.find(
    (f) => f.checkKey === target.checkKey && f.sourceStatus === target.status,
  );
  if (exact) return exact;
  return finalize({
    key: `${target.checkKey}:${target.status}`,
    checkKey: target.checkKey,
    sourceStatus: target.status,
    title: `Address “${target.checkKey}”`,
    detail:
      target.message?.trim() ||
      `Work through the ${target.status} outcome for this homepage check.`,
    severity: "medium",
    effort: "medium",
    impact: "medium",
  });
}
