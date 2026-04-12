import type { PromptClusterPlannerRow } from "@/lib/sites/prompt-clusters";

/**
 * Deterministic content-gap ranking: business impact + search value − implementation effort.
 * All signals are counts, token overlap, and caps — no ML/AI.
 *
 * Weight summary (see scoreOne):
 * - Business: focus-token hits in cluster text, plus bonus when target pages exist.
 * - Search: prompt count and total prompt character volume (proxy for query breadth).
 * - Effort: base + pages×14 + prompts×7 (capped 100).
 */

export type SiteContentGapContext = {
  primaryFocus: string | null;
  businessName: string;
};

export type ContentGapAxisScore = {
  /** 0–100 (effort: higher = more work to implement). */
  score: number;
  /** Fixed-order, human-readable derivation lines. */
  reasons: string[];
};

export type RankedContentGap = {
  clusterKey: string;
  clusterTitle: string;
  row: PromptClusterPlannerRow;
  businessImpact: ContentGapAxisScore;
  searchValue: ContentGapAxisScore;
  implementationEffort: ContentGapAxisScore;
  /** Sort key: impact + search − effort (typical range about −100…200). */
  compositePriority: number;
};

function wordSet(s: string): Set<string> {
  const m = s.toLowerCase().match(/[a-z0-9]+/g);
  return new Set(m ?? []);
}

/** Terms used for business alignment; primary focus wins, else business name. */
export function focusTermsForRanking(ctx: SiteContentGapContext): string[] {
  const raw = (ctx.primaryFocus?.trim() || ctx.businessName || "").trim();
  return [...wordSet(raw)].filter((t) => t.length >= 3).sort((a, b) => a.localeCompare(b));
}

function scoreOne(row: PromptClusterPlannerRow, ctx: SiteContentGapContext): RankedContentGap {
  const terms = focusTermsForRanking(ctx);
  const clusterWords = wordSet(`${row.clusterKey} ${row.clusterTitle} ${row.prompts.join(" ")}`);

  const hitTerms = terms.filter((t) => clusterWords.has(t));
  const hits = hitTerms.length;

  const businessReasons: string[] = [];
  let businessScore: number;
  if (terms.length === 0) {
    businessScore = 45;
    businessReasons.push(
      "No focus terms from site (set Primary focus for tighter alignment). Neutral base score 45.",
    );
  } else if (hits === 0) {
    businessScore = 35;
    businessReasons.push(
      `No token overlap with ${terms.length} focus term(s): ${terms.join(", ")}. Base score 35.`,
    );
  } else {
    const raw = 30 + hits * 22;
    businessScore = Math.min(100, raw);
    businessReasons.push(
      `Focus overlap: ${hits} of ${terms.length} term(s) in cluster text (${hitTerms.sort((a, b) => a.localeCompare(b)).join(", ")}). Formula min(100, 30 + ${hits}×22) = ${businessScore}.`,
    );
  }

  if (row.targetPages.length > 0) {
    const before = businessScore;
    businessScore = Math.min(100, businessScore + 20);
    businessReasons.push(
      `${row.targetPages.length} target page(s) linked — add 20 (cap 100): ${before} → ${businessScore}.`,
    );
  } else {
    businessReasons.push("No target pages — assign catalog URLs to raise confidence.");
  }
  businessScore = Math.min(100, Math.max(0, businessScore));

  const nPrompts = row.prompts.length;
  const promptChars = row.prompts.join(" ").length;
  const charBand = Math.min(40, Math.floor(promptChars / 50));
  const searchScore = Math.min(100, nPrompts * 18 + charBand);
  const searchReasons: string[] = [
    `Search breadth: ${nPrompts} prompt(s) × 18 = ${Math.min(100, nPrompts * 18)}, plus up to 40 from prompt length (${promptChars} chars → +${charBand}).`,
  ];

  const baseEffort = 12;
  const pageEffort = row.targetPages.length * 14;
  const promptEffort = nPrompts * 7;
  const effortScore = Math.min(100, baseEffort + pageEffort + promptEffort);
  const effortReasons: string[] = [
    `Effort estimate: base ${baseEffort} + ${row.targetPages.length} page(s)×14 + ${nPrompts} prompt(s)×7 = ${baseEffort + pageEffort + promptEffort} (cap 100 → ${effortScore}).`,
  ];

  const compositePriority = businessScore + searchScore - effortScore;

  return {
    clusterKey: row.clusterKey,
    clusterTitle: row.clusterTitle,
    row,
    businessImpact: { score: businessScore, reasons: businessReasons },
    searchValue: { score: searchScore, reasons: searchReasons },
    implementationEffort: { score: effortScore, reasons: effortReasons },
    compositePriority,
  };
}

/** Sort: highest composite first, then cluster key. */
export function rankContentGapOpportunities(
  rows: PromptClusterPlannerRow[],
  ctx: SiteContentGapContext,
): RankedContentGap[] {
  const out = rows.map((row) => scoreOne(row, ctx));
  out.sort((a, b) => {
    if (b.compositePriority !== a.compositePriority) return b.compositePriority - a.compositePriority;
    return a.clusterKey.localeCompare(b.clusterKey);
  });
  return out;
}

/** One-line “why” for compact UI; derived from deterministic score reasons (no AI). */
export function shortOpportunityRecommendation(r: RankedContentGap): string {
  const line =
    r.businessImpact.reasons[0]?.trim() || r.searchValue.reasons[0]?.trim() || "";
  if (line.length > 0) return line.length > 130 ? `${line.slice(0, 127)}…` : line;
  return `Priority ${r.compositePriority} · impact ${r.businessImpact.score} · search ${r.searchValue.score} · effort ${r.implementationEffort.score}.`;
}

export function formatRankedContentGapPlainLine(r: RankedContentGap, rankIndex: number): string {
  return `${rankIndex}. [${r.clusterKey}] ${r.clusterTitle} — priority ${r.compositePriority} (impact ${r.businessImpact.score}, search ${r.searchValue.score}, effort ${r.implementationEffort.score})`;
}

/** Block for launch report / email; empty when no clusters. */
export function buildContentGapsPlainTextSection(ranked: RankedContentGap[]): string {
  if (ranked.length === 0) return "";
  const lines: string[] = ["CONTENT GAPS (RANKED)", "---------------------"];
  let n = 1;
  for (const r of ranked) {
    lines.push(formatRankedContentGapPlainLine(r, n));
    lines.push(
      `   Business impact (${r.businessImpact.score}): ${r.businessImpact.reasons[0] ?? "—"}`,
    );
    lines.push(`   Search value (${r.searchValue.score}): ${r.searchValue.reasons[0] ?? "—"}`);
    lines.push(
      `   Implementation effort (${r.implementationEffort.score}): ${r.implementationEffort.reasons[0] ?? "—"}`,
    );
    lines.push("");
    n += 1;
  }
  return lines.join("\n").trimEnd();
}
