/**
 * Content brief — deterministic structure for topic, page, intent, audience, bullets, repurposing.
 * No generated long-form prose; seeds come from rules + stored cluster prompts only.
 */

import type { ContentOpportunityBrief } from "@/lib/sites/content-opportunity-brief";

/** Fixed repurposing channel ids (stored in DB JSON; keep stable for UI and exports). */
export const REPURPOSING_TARGET_IDS = ["seo_page", "geo_notes", "linkedin_post"] as const;

export type RepurposingTargetId = (typeof REPURPOSING_TARGET_IDS)[number];

const REPURPOSING_SET = new Set<string>(REPURPOSING_TARGET_IDS);

export type ContentBriefSeed = {
  pageId: string | null;
  topic: string;
  intent: string;
  audience: string;
  primaryPoints: string[];
  repurposingTargets: RepurposingTargetId[];
};

/** Normalized brief for drafting UI and scaffolds (source of truth from DB). */
export type ContentBriefView = {
  id: string;
  pageId: string | null;
  targetPageUrl: string | null;
  targetPageTitle: string | null;
  topic: string;
  intent: string;
  audience: string;
  primaryPoints: string[];
  repurposingTargets: RepurposingTargetId[];
};

const FALLBACK_POINTS = [
  "State the main takeaway in the first screen.",
  "Align claims with what the live site can support.",
] as const;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function audienceLineForQueueCategory(category: string): string {
  const c = category.trim().toLowerCase();
  switch (c) {
    case "service":
      return "Prospects evaluating this offering on the site.";
    case "faq":
      return "Visitors looking for a direct answer before they contact you.";
    case "geo":
      return "Visitors and assistants needing clear service area and location context.";
    case "snippet":
      return "Search users scanning titles and snippets for relevance.";
    case "onpage":
      return "On-page visitors and crawlers needing unambiguous page signals.";
    case "supporting":
      return "Readers in earlier research stages who need context.";
    default:
      return "Site visitors whose query intent matches this topic.";
  }
}

export function defaultRepurposingTargetsForCategory(category: string): RepurposingTargetId[] {
  const c = category.trim().toLowerCase();
  if (c === "geo" || c === "onpage") {
    return ["geo_notes", "seo_page", "linkedin_post"];
  }
  return ["seo_page", "geo_notes", "linkedin_post"];
}

function dedupePreserveOrder(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (t.length === 0 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function buildPrimaryPointsFromPrompts(promptLines: string[]): string[] {
  const fromPrompts = dedupePreserveOrder(promptLines.map((p) => truncate(p, 160))).slice(0, 6);
  const out = [...fromPrompts];
  for (const f of FALLBACK_POINTS) {
    if (out.length >= 3) break;
    if (!out.includes(f)) out.push(f);
  }
  return out.slice(0, 8);
}

export function parsePrimaryPointsJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const lines = raw.filter((x): x is string => typeof x === "string").map((s) => s.trim());
  return dedupePreserveOrder(lines);
}

export function parseRepurposingTargetsJson(raw: unknown): RepurposingTargetId[] {
  if (!Array.isArray(raw)) {
    return defaultRepurposingTargetsForCategory("other");
  }
  const picked = raw.filter((x): x is string => typeof x === "string" && REPURPOSING_SET.has(x)) as RepurposingTargetId[];
  const unique = dedupePreserveOrder(picked) as RepurposingTargetId[];
  if (unique.length === 0) {
    return defaultRepurposingTargetsForCategory("other");
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

export function buildContentBriefSeedFromOpportunity(
  writerBrief: ContentOpportunityBrief,
  category: string,
  pageId: string | null,
  promptLines: string[],
): ContentBriefSeed {
  return {
    pageId: pageId ?? null,
    topic: writerBrief.suggestedTitle.trim() || writerBrief.opportunityKey,
    intent: writerBrief.primaryIntent.trim() || "Execute using your editorial standards.",
    audience: audienceLineForQueueCategory(category),
    primaryPoints: buildPrimaryPointsFromPrompts(promptLines),
    repurposingTargets: defaultRepurposingTargetsForCategory(category),
  };
}

export function repurposingTargetLabel(id: RepurposingTargetId): string {
  switch (id) {
    case "seo_page":
      return "SEO (page)";
    case "geo_notes":
      return "GEO (notes)";
    case "linkedin_post":
      return "LinkedIn post";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

/** Map stored brief to the shape the legacy opportunity-brief pipeline expects (scaffold, sanitize context). */
export function contentBriefViewToOpportunityBrief(
  view: ContentBriefView,
  opportunityKey: string,
): ContentOpportunityBrief {
  return {
    opportunityKey,
    targetPage:
      view.targetPageUrl ?
        { url: view.targetPageUrl, title: view.targetPageTitle }
      : null,
    suggestedTitle: view.topic,
    primaryIntent: view.intent,
  };
}
