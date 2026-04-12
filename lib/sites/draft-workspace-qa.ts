/**
 * Deterministic drafting QA — pattern/heuristic checks only; no generated copy.
 * Primary focus: SEO/page draft (`seoBody`). Optional signals from GEO/LinkedIn for CTA.
 */

import type { ContentBriefView } from "@/lib/sites/content-brief";
import { classifyPromptClusterKind } from "@/lib/sites/content-opportunity-kind";
import { parseClusterOpportunityKey } from "@/lib/sites/content-opportunity-brief";

export type DraftQaStatus = "pass" | "warn" | "fail";

export type DraftWorkspaceQaItem = {
  id: "title" | "structure" | "faq_coverage" | "cta";
  label: string;
  status: DraftQaStatus;
  detail: string;
};

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "your",
  "our",
  "are",
  "you",
  "how",
  "what",
  "when",
  "where",
  "why",
  "who",
]);

function significantTokens(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set(raw)];
}

function firstHeadingLine(draft: string): string | null {
  const m = draft.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim() ?? null;
}

function countH2(draft: string): number {
  const matches = draft.match(/^##\s+[^\n#]/gm);
  return matches?.length ?? 0;
}

function countBulletLines(draft: string): number {
  let n = 0;
  for (const line of draft.split("\n")) {
    if (/^\s*[-*]\s+\S/.test(line)) n += 1;
  }
  return n;
}

function isFaqWeightedOpportunity(category: string, opportunityKey: string): boolean {
  const c = category.trim().toLowerCase();
  if (c === "faq") return true;
  const k = parseClusterOpportunityKey(opportunityKey);
  if (!k) return false;
  return classifyPromptClusterKind(k) === "faq";
}

const CTA_RE =
  /\b(contact\s+us|call\s+us|get\s+in\s+touch|book\s+(now|a)|schedule(\s+a)?\s+consult|get\s+started|request\s+a?\s*quote|free\s+quote|sign\s+up|subscribe|learn\s+more|cta)\b/i;

function hasCtaInText(s: string): boolean {
  return CTA_RE.test(s);
}

function ctaPlacementInDraft(draft: string): "none" | "early" | "late" {
  const t = draft.trim();
  if (t.length < 40) return "none";
  const ctaSection = /#{1,3}\s*cta\b/im.exec(t);
  if (ctaSection) {
    const after = t.slice(ctaSection.index + ctaSection[0].length);
    return hasCtaInText(after) ? "late" : "early";
  }
  const idx = Math.floor(t.length * 0.62);
  const tail = t.slice(idx);
  const head = t.slice(0, idx);
  const inTail = hasCtaInText(tail);
  const inHead = hasCtaInText(head);
  if (inTail) return "late";
  if (inHead) return "early";
  return "none";
}

function primaryPointsCoverage(draft: string, points: string[]): number {
  const d = draft.toLowerCase();
  let hit = 0;
  for (const p of points) {
    const tokens = significantTokens(p).slice(0, 4);
    if (tokens.length === 0) continue;
    const ok = tokens.filter((tok) => d.includes(tok)).length;
    if (ok >= Math.min(2, tokens.length) || (tokens.length === 1 && ok === 1)) hit += 1;
  }
  return hit;
}

export function runDraftWorkspaceQa(input: {
  seoBody: string;
  geoNotes: string;
  linkedinPost: string;
  contentBrief: ContentBriefView;
  category: string;
  opportunityKey: string;
}): DraftWorkspaceQaItem[] {
  const draft = input.seoBody.trim();
  const topic = input.contentBrief.topic.trim();
  const topicTok = significantTokens(topic);
  const draftLower = draft.toLowerCase();
  const head = `${firstHeadingLine(draft) ?? ""} ${draft.slice(0, 520)}`.toLowerCase();

  /** Title alignment — topic tokens or full topic phrase near top / H1. */
  let titleStatus: DraftQaStatus = "pass";
  let titleDetail = "Topic aligns with opening or first heading.";
  if (draft.length < 12) {
    titleStatus = "fail";
    titleDetail = "Add draft text before evaluating title alignment.";
  } else if (topic.length > 0 && topic.length < 4) {
    titleStatus = "warn";
    titleDetail = "Brief topic is very short — confirm the H1 matches editorial intent.";
  } else if (topic.length >= 4 && topicTok.length === 0) {
    if (draftLower.slice(0, 640).includes(topic.toLowerCase())) {
      titleStatus = "pass";
      titleDetail = "Topic phrase appears in the opening.";
    } else {
      titleStatus = "warn";
      titleDetail = "Work the topic phrase into the H1 or first paragraph.";
    }
  } else if (topicTok.length > 0) {
    const hits = topicTok.filter((w) => head.includes(w)).length;
    const need = topicTok.length === 1 ? 1 : 2;
    if (hits >= need) {
      titleStatus = "pass";
      titleDetail = `Matched ${hits} key term(s) from the topic in the title area.`;
    } else if (hits === 1) {
      titleStatus = "warn";
      titleDetail = "Strengthen the H1 or lede so more of the topic terms appear.";
    } else {
      titleStatus = "fail";
      titleDetail = "First heading / opening does not reflect the brief topic yet.";
    }
  }

  /** Structure — headings or lists. */
  const h2 = countH2(draft);
  const bullets = countBulletLines(draft);
  let structStatus: DraftQaStatus;
  let structDetail: string;
  if (draft.length < 80) {
    structStatus = "warn";
    structDetail = "Draft is short — add ## sections or bullet lists as you expand.";
  } else if (h2 >= 2 || bullets >= 3) {
    structStatus = "pass";
    structDetail = `Found ${h2} section heading(s) and ${bullets} bullet line(s).`;
  } else if (h2 === 1 || bullets >= 1) {
    structStatus = "warn";
    structDetail = "Add another section or more bullets for clearer scannability.";
  } else {
    structStatus = "fail";
    structDetail = "Use ## headings and/or bullet lists to break up the page draft.";
  }

  /** FAQ — only strict when opportunity is FAQ-weighted. */
  const faqWeighted = isFaqWeightedOpportunity(input.category, input.opportunityKey);
  const qCount = (draft.match(/\?/g) ?? []).length;
  const faqHeading = /#{1,3}\s*(\(.*\)\s*)?(faq|question)/i.test(draft);
  const covered = primaryPointsCoverage(draft, input.contentBrief.primaryPoints);
  const needPoints = Math.min(2, Math.max(1, input.contentBrief.primaryPoints.length));

  let faqStatus: DraftQaStatus;
  let faqDetail: string;
  if (!faqWeighted) {
    faqStatus = "pass";
    faqDetail = "FAQ coverage not required for this opportunity type.";
  } else if (draft.length < 40) {
    faqStatus = "warn";
    faqDetail = "FAQ opportunity — expand the draft, then add explicit questions or FAQ sections.";
  } else if (qCount >= 2 || (qCount >= 1 && faqHeading) || covered >= needPoints) {
    faqStatus = "pass";
    faqDetail = `FAQ signals: ${qCount} question mark(s), FAQ-style heading: ${faqHeading ? "yes" : "no"}, brief points echoed: ${covered}/${input.contentBrief.primaryPoints.length}.`;
  } else if (qCount >= 1 || covered >= 1) {
    faqStatus = "warn";
    faqDetail = "Add another question, a FAQ heading, or cover more brief primary points.";
  } else {
    faqStatus = "fail";
    faqDetail = "FAQ opportunity — surface questions (?) or a FAQ block aligned with brief points.";
  }

  /** CTA — end-weighted or under a CTA heading; LinkedIn counts as secondary. */
  const combined = `${draft}\n${input.geoNotes}\n${input.linkedinPost}`;
  const place = ctaPlacementInDraft(draft);
  const linkedinCta = hasCtaInText(input.linkedinPost);

  let ctaStatus: DraftQaStatus;
  let ctaDetail: string;
  if (draft.length < 60 && !linkedinCta) {
    ctaStatus = "warn";
    ctaDetail = "Draft is thin — plan a contact/book/quote-style CTA in the lower page or a CTA section.";
  } else if (place === "late" || (linkedinCta && draft.length < 80)) {
    ctaStatus = "pass";
    ctaDetail =
      place === "late" ?
        "CTA language appears toward the end or under a CTA-style section."
      : "LinkedIn draft includes CTA language; add one on the page when you expand.";
  } else if (place === "early") {
    ctaStatus = "warn";
    ctaDetail = "CTA appears early — repeat or strengthen near the end for conversion.";
  } else if (hasCtaInText(combined)) {
    ctaStatus = "warn";
    ctaDetail = "CTA-like wording exists in GEO/LinkedIn fields — mirror it on the page draft near the close.";
  } else if (draft.length > 100) {
    ctaStatus = "fail";
    ctaDetail = "No clear CTA (contact, book, quote, get started, etc.) — add one in the final section.";
  } else {
    ctaStatus = "warn";
    ctaDetail = "Add an explicit next step (contact, book, quote) as you lengthen the draft.";
  }

  const items: DraftWorkspaceQaItem[] = [
    { id: "title", label: "Title / topic alignment", status: titleStatus, detail: titleDetail },
    { id: "structure", label: "Structure (headings & lists)", status: structStatus, detail: structDetail },
    { id: "faq_coverage", label: "FAQ coverage", status: faqStatus, detail: faqDetail },
    { id: "cta", label: "CTA placement", status: ctaStatus, detail: ctaDetail },
  ];

  return items;
}
