/**
 * Deterministic repurposing shells from stored brief + writer drafts.
 * Structured blocks for paste into CMS/social — not polished final prose.
 */

import type { ContentBriefView } from "@/lib/sites/content-brief";

export type RepurposeBlocks = {
  seoBlogPost: string;
  geoFaqSection: string;
  /** Three fixed layouts using the same brief points + draft signals. */
  linkedinVariationShort: string;
  linkedinVariationStandard: string;
  linkedinVariationThread: string;
};

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function stripMdHeadingPrefix(line: string): string {
  return line.replace(/^#{1,6}\s+/, "").trim();
}

function extractH1(draft: string): string | null {
  const m = draft.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim() ?? null;
}

function extractH2Titles(draft: string): string[] {
  const lines = draft.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^##\s+/.test(t) && !/^###/.test(t)) {
      out.push(stripMdHeadingPrefix(t));
    }
  }
  return out;
}

function extractQuestionLines(draft: string, max: number): string[] {
  const out: string[] = [];
  for (const line of draft.split("\n")) {
    const t = line.trim();
    if (t.length < 6 || !t.includes("?")) continue;
    if (/^#{1,6}\s/.test(t)) continue;
    out.push(truncate(t, 220));
    if (out.length >= max) break;
  }
  return out;
}

function firstNonHeadingLine(draft: string, maxLen: number): string {
  for (const line of draft.split("\n")) {
    const t = line.trim();
    if (t.length < 12) continue;
    if (/^#{1,6}\s/.test(t)) continue;
    if (/^[-*]\s/.test(t)) return truncate(t, maxLen);
    return truncate(t, maxLen);
  }
  return "";
}

const ANSWER_FALLBACK =
  "— Author answer from page draft + GEO notes in CMS (keep claims verifiable for GEO).";

function naiveAnswerForPrompt(question: string, seoBody: string, geoNotes: string): string {
  const pool = `${seoBody}\n\n${geoNotes}`;
  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);
  if (tokens.length === 0) return ANSWER_FALLBACK;
  for (const line of pool.split("\n")) {
    const t = line.trim();
    if (t.length < 24 || t.includes("?")) continue;
    const low = t.toLowerCase();
    const hits = tokens.filter((k) => low.includes(k)).length;
    if (hits >= 1) return truncate(t, 300);
  }
  return ANSWER_FALLBACK;
}

function buildSeoBlogBlock(brief: ContentBriefView, seoBody: string): string {
  const h1 = extractH1(seoBody);
  const title = h1 || brief.topic;
  const h2s = extractH2Titles(seoBody);
  const sectionSlots =
    h2s.length > 0 ?
      h2s.map((h, i) => `  ${i + 1}. ${h}`)
    : ["  1. (Add ## sections in draft or assign in CMS)", "  2. …"];

  const points = brief.primaryPoints.length > 0 ? brief.primaryPoints : ["(Add primary points on the content brief)"];
  const excerpt = truncate(seoBody.replace(/^#{1,6}\s+.*$/gm, "").replace(/\n+/g, "\n").trim(), 900);

  const lines = [
    "=== SEO BLOG POST (structured shell — polish in CMS) ===",
    "",
    "TITLE / H1",
    `  ${title}`,
    "",
    "BRIEF · AUDIENCE",
    `  ${brief.audience}`,
    "",
    "BRIEF · PRIMARY INTENT",
    `  ${brief.intent}`,
    "",
    "TARGET URL (canonical)",
    `  ${brief.targetPageUrl ?? "(set when publishing)"}`,
    "",
    "SECTION SLOTS (from ## headings in page draft, else placeholders)",
    ...sectionSlots,
    "",
    "CORE POINTS (from brief — cover in body)",
    ...points.map((p) => `  • ${truncate(p, 200)}`),
    "",
    "SOURCE EXCERPT (trimmed page draft — paste reference, not final)",
    "  ---",
    ...excerpt.split("\n").map((l) => `  ${l}`),
    "  ---",
    "",
    "CHECKLIST",
    "  [ ] Meta title + description",
    "  [ ] H1 matches topic intent",
    "  [ ] Internal links / CTA block",
  ];
  return lines.join("\n");
}

function buildGeoFaqBlock(brief: ContentBriefView, seoBody: string, geoNotes: string): string {
  const questionsFromDraft = extractQuestionLines(seoBody, 5);
  const points = brief.primaryPoints;

  const lines: string[] = [
    "=== GEO FAQ SECTION (structured — factual, quotable) ===",
    "",
    "TOPIC / SCOPE",
    `  ${brief.topic}`,
    "",
    "INTENT (what assistants should get right)",
    `  ${truncate(brief.intent, 320)}`,
    "",
    "Q/A BLOCKS (fill or tighten in CMS)",
    "",
  ];

  const usedQs = new Set<string>();
  let n = 0;
  for (const p of points) {
    const q = p.includes("?") ? truncate(p, 200) : `What should readers know about: ${truncate(p, 160)}?`;
    if (usedQs.has(q)) continue;
    usedQs.add(q);
    n += 1;
    lines.push(`Q${n}: ${q}`);
    lines.push(`A${n}: ${naiveAnswerForPrompt(p, seoBody, geoNotes)}`);
    lines.push("");
    if (n >= 6) break;
  }

  for (const qLine of questionsFromDraft) {
    if (usedQs.has(qLine)) continue;
    usedQs.add(qLine);
    n += 1;
    lines.push(`Q${n}: ${qLine}`);
    lines.push(`A${n}: ${naiveAnswerForPrompt(qLine, seoBody, geoNotes)}`);
    lines.push("");
    if (n >= 8) break;
  }

  if (n === 0) {
    lines.push("Q1: (Add questions in page draft or brief primary points)");
    lines.push(`A1: ${ANSWER_FALLBACK}`);
    lines.push("");
  }

  lines.push("GEO NOTES (reference — merge into answers where relevant)");
  lines.push(geoNotes.trim() ? truncate(geoNotes.trim(), 1200) : "  (none — pull facts from page draft)");
  lines.push("");

  return lines.join("\n").trimEnd();
}

function buildLinkedInShort(brief: ContentBriefView, seoBody: string): string {
  const p = brief.primaryPoints;
  const b1 = p[0] ? truncate(p[0], 140) : truncate(brief.intent, 140);
  const b2 = p[1] ? truncate(p[1], 140) : truncate(brief.audience, 120);
  return [
    `Headline: ${brief.topic}`,
    "",
    `• ${b1}`,
    `• ${b2}`,
    "",
    `CTA line: ${truncate(brief.intent, 110)}`,
  ].join("\n");
}

function buildLinkedInStandard(brief: ContentBriefView, seoBody: string): string {
  const hook = firstNonHeadingLine(seoBody, 200) || brief.topic;
  const bullets = brief.primaryPoints.slice(0, 3).map((x) => `• ${truncate(x, 130)}`);
  const pad =
    bullets.length > 0 ?
      bullets
    : [`• ${truncate(brief.intent, 130)}`, `• ${truncate(brief.audience, 120)}`];
  return [
    hook,
    "",
    ...pad,
    "",
    `Next step: ${truncate(brief.intent, 100)}`,
  ].join("\n");
}

function buildLinkedInThread(brief: ContentBriefView, seoBody: string): string {
  const p = brief.primaryPoints;
  return [
    `1/ Topic: ${truncate(brief.topic, 200)}`,
    `2/ For: ${truncate(brief.audience, 180)}`,
    `3/ Point: ${p[0] ? truncate(p[0], 200) : truncate(brief.intent, 200)}`,
    `4/ Also: ${p[1] ? truncate(p[1], 200) : "(see page draft)"}`,
    `5/ CTA: ${truncate(brief.intent, 160)}`,
  ].join("\n");
}

export function buildRepurposeBlocksFromDraft(input: {
  contentBrief: ContentBriefView;
  seoBody: string;
  geoNotes: string;
  linkedinPost: string;
}): RepurposeBlocks {
  const { contentBrief: brief, seoBody, geoNotes, linkedinPost } = input;
  return {
    seoBlogPost: buildSeoBlogBlock(brief, seoBody),
    geoFaqSection: buildGeoFaqBlock(brief, seoBody, geoNotes),
    linkedinVariationShort: buildLinkedInShort(brief, seoBody),
    linkedinVariationStandard: buildLinkedInStandard(brief, seoBody),
    linkedinVariationThread: buildLinkedInThread(brief, seoBody),
  };
}

/** All LinkedIn shells in one paste-friendly file. */
export function formatLinkedInVariationsPlain(blocks: RepurposeBlocks): string {
  return [
    "--- Variation A (short) ---",
    blocks.linkedinVariationShort,
    "",
    "--- Variation B (standard) ---",
    blocks.linkedinVariationStandard,
    "",
    "--- Variation C (thread-style) ---",
    blocks.linkedinVariationThread,
  ].join("\n");
}

/** Plain text pack for a single copy action (all blocks + optional writer LinkedIn draft). */
export function formatRepurposePackPlain(blocks: RepurposeBlocks, linkedinWriterDraft: string): string {
  const liDraft = linkedinWriterDraft.trim();
  const parts = [
    blocks.seoBlogPost,
    "",
    blocks.geoFaqSection,
    "",
    formatLinkedInVariationsPlain(blocks),
  ];
  if (liDraft.length > 0) {
    parts.push("", "--- LINKEDIN · Your saved draft (reference) ---", liDraft);
  }
  return parts.join("\n");
}
