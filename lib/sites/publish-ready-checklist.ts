/**
 * Manual publish-ready checklist — deterministic hints from brief + page draft only.
 */

import type { ContentBriefView } from "@/lib/sites/content-brief";
import { parseClusterOpportunityKey } from "@/lib/sites/content-opportunity-brief";
import { classifyPromptClusterKind } from "@/lib/sites/content-opportunity-kind";

export const PUBLISH_READY_CHECKLIST_IDS = [
  "page_title",
  "meta_description",
  "faq_coverage",
  "internal_links",
  "schema_markup",
  "cta",
] as const;

export type PublishReadyChecklistId = (typeof PUBLISH_READY_CHECKLIST_IDS)[number];

export type PublishReadyChecklistItem = {
  id: PublishReadyChecklistId;
  label: string;
  /** Ties the row to brief/draft signals (deterministic). */
  hint: string;
};

const CTA_HINT_RE =
  /\b(contact\s+us|call\s+us|get\s+in\s+touch|book\s+(now|a)|schedule|get\s+started|request\s+a?\s*quote|learn\s+more)\b/i;

function extractH1(draft: string): string | null {
  const m = draft.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim() ?? null;
}

function countQuestionMarks(draft: string): number {
  return (draft.match(/\?/g) ?? []).length;
}

function countInternalMarkdownLinks(draft: string): number {
  let n = 0;
  const re = /\[([^\]]*)]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(draft)) !== null) {
    const href = m[2]?.trim() ?? "";
    if (href.startsWith("/") || href.startsWith("./")) n += 1;
  }
  return n;
}

function isFaqWeighted(category: string, opportunityKey: string): boolean {
  const c = category.trim().toLowerCase();
  if (c === "faq") return true;
  const k = parseClusterOpportunityKey(opportunityKey);
  if (!k) return false;
  return classifyPromptClusterKind(k) === "faq";
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildPublishReadyChecklistItems(input: {
  contentBrief: ContentBriefView;
  seoBody: string;
  category: string;
  opportunityKey: string;
}): PublishReadyChecklistItem[] {
  const { contentBrief: brief, seoBody, category, opportunityKey } = input;
  const draft = seoBody;
  const h1 = extractH1(draft);
  const topic = brief.topic.trim();
  const h1Note =
    h1 ?
      `Draft H1: «${truncate(h1, 100)}»`
    : "(No `#` heading in page draft yet — match brief topic in CMS.)";
  const topicMatch =
    h1 && topic.length > 2 ?
      topic.toLowerCase().split(/\s+/).filter((w) => w.length > 2).some((w) => h1.toLowerCase().includes(w))
    : false;

  const faqW = isFaqWeighted(category, opportunityKey);
  const qn = countQuestionMarks(draft);
  const pointsN = brief.primaryPoints.length;
  const faqHint = faqW ?
    `FAQ-weighted opportunity — brief primary points: ${pointsN}; question marks in draft: ${qn}.`
  : `Not FAQ-weighted — still confirm FAQs if the page answers questions. Brief points: ${pointsN}; «?» in draft: ${qn}.`;

  const internalN = countInternalMarkdownLinks(draft);
  const target = brief.targetPageUrl ?? "(set target URL on brief/queue)";
  const internalHint = `Target URL: ${target}. Markdown internal links found in draft (\`[text](/path)\`): ${internalN}.`;

  const ctaFound = CTA_HINT_RE.test(draft);
  const ctaHint = ctaFound ?
    "Draft contains CTA-like wording — confirm placement near the end in CMS."
  : "No obvious CTA phrase in page draft — add contact / book / quote / get started in CMS.";

  const schemaHint = `Use JSON-LD appropriate to the page (e.g. Article, FAQPage if FAQs, LocalBusiness if location). Topic: «${truncate(topic, 80)}».`;

  return [
    {
      id: "page_title",
      label: "Page title / H1",
      hint: `Brief topic: «${truncate(topic, 120)}». ${h1Note}${topicMatch ? " · Key terms overlap brief topic." : ""}`,
    },
    {
      id: "meta_description",
      label: "Meta description",
      hint: `Reflect primary intent in ~150–160 characters. Intent: «${truncate(brief.intent, 200)}»`,
    },
    {
      id: "faq_coverage",
      label: "FAQ coverage",
      hint: faqHint,
    },
    {
      id: "internal_links",
      label: "Internal links",
      hint: internalHint,
    },
    {
      id: "schema_markup",
      label: "Schema (JSON-LD)",
      hint: schemaHint,
    },
    {
      id: "cta",
      label: "CTA",
      hint: ctaHint,
    },
  ];
}

export function publishReadyChecklistCompletion(
  checkedIds: string[],
  items: PublishReadyChecklistItem[],
): { done: number; total: number } {
  const done = checkedIds.filter((id) => items.some((i) => i.id === id)).length;
  return { done, total: items.length };
}
