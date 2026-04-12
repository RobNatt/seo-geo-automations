/**
 * Deterministic content drafting workflow: stages, checklists, scaffolds, and sanitize rules.
 * No generated prose — writers fill channels; machine logic is thresholds and fixed copy only.
 */

import {
  parseClusterOpportunityKey,
  type ContentOpportunityBrief,
} from "@/lib/sites/content-opportunity-brief";
import { classifyPromptClusterKind } from "@/lib/sites/content-opportunity-kind";

export const PIPELINE_STAGES = [
  "brief",
  "draft",
  "review",
  "sanitize",
  "publish_ready",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_INDEX: Record<PipelineStage, number> = {
  brief: 0,
  draft: 1,
  review: 2,
  sanitize: 3,
  publish_ready: 4,
};

export type PipelineArtifactsV1 = {
  v: 1;
  seoBody: string;
  geoNotes: string;
  linkedinPost: string;
  briefAcknowledged: boolean;
  /** Checklist item ids the reviewer marked done (subset of `buildReviewChecklist` ids). */
  reviewCheckedIds: string[];
  /** Allow leaving sanitize with open issues (explicit human ack). */
  sanitizeOverride: boolean;
  /** Manual publish-ready checklist (ids from `publish-ready-checklist`). */
  publishReadyCheckedIds: string[];
};

export type DraftPipelineContext = {
  opportunityKey: string;
  category: string;
};

export type ReviewChecklistItem = { id: string; label: string };

export type RepurposeGuidance = {
  seo: string;
  geo: string;
  linkedin: string;
};

const STAGE_SET = new Set<string>(PIPELINE_STAGES);

export function normalizePipelineStage(raw: string | null | undefined): PipelineStage | null {
  if (raw == null || raw === "") return null;
  const s = raw.trim().toLowerCase();
  return STAGE_SET.has(s) ? (s as PipelineStage) : null;
}

export function defaultPipelineArtifacts(): PipelineArtifactsV1 {
  return {
    v: 1,
    seoBody: "",
    geoNotes: "",
    linkedinPost: "",
    briefAcknowledged: false,
    reviewCheckedIds: [],
    sanitizeOverride: false,
    publishReadyCheckedIds: [],
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function parsePipelineArtifacts(raw: unknown): PipelineArtifactsV1 {
  const d = defaultPipelineArtifacts();
  if (!isRecord(raw)) return d;
  if (raw.v !== 1) return d;
  const seoBody = typeof raw.seoBody === "string" ? raw.seoBody : "";
  const geoNotes = typeof raw.geoNotes === "string" ? raw.geoNotes : "";
  const linkedinPost = typeof raw.linkedinPost === "string" ? raw.linkedinPost : "";
  const briefAcknowledged = raw.briefAcknowledged === true;
  const sanitizeOverride = raw.sanitizeOverride === true;
  let reviewCheckedIds: string[] = [];
  if (Array.isArray(raw.reviewCheckedIds)) {
    reviewCheckedIds = raw.reviewCheckedIds.filter((x): x is string => typeof x === "string");
  }
  let publishReadyCheckedIds: string[] = [];
  if (Array.isArray(raw.publishReadyCheckedIds)) {
    publishReadyCheckedIds = raw.publishReadyCheckedIds.filter((x): x is string => typeof x === "string");
  }
  return {
    v: 1,
    seoBody,
    geoNotes,
    linkedinPost,
    briefAcknowledged,
    reviewCheckedIds,
    sanitizeOverride,
    publishReadyCheckedIds,
  };
}

export function isGeoHeavyOpportunity(ctx: DraftPipelineContext): boolean {
  const c = ctx.category.trim().toLowerCase();
  if (c === "geo") return true;
  return ctx.opportunityKey.startsWith("content_opp:geo:");
}

export function isClusterOpportunity(ctx: DraftPipelineContext): boolean {
  return parseClusterOpportunityKey(ctx.opportunityKey) != null;
}

function clusterKind(ctx: DraftPipelineContext): ReturnType<typeof classifyPromptClusterKind> {
  const k = parseClusterOpportunityKey(ctx.opportunityKey);
  if (!k) return "other";
  return classifyPromptClusterKind(k);
}

export function repurposeGuidance(ctx: DraftPipelineContext): RepurposeGuidance {
  const geoHeavy = isGeoHeavyOpportunity(ctx);
  const kind = clusterKind(ctx);

  const seo =
    kind === "faq"
      ? "SEO: use a clear question-style H1 or title; answer first in a short paragraph; add depth with H2s for follow-ups. Keep language aligned with stored prompts."
      : kind === "service"
        ? "SEO: lead with the offering, service area, and proof (reviews, certs); one primary CTA; avoid thin boilerplate."
        : "SEO: match search intent in the opening; structure with headings; internal links to related services or pillars where relevant.";

  const geo =
    geoHeavy || kind === "service"
      ? "GEO: state who you serve, where, and what you do in plain sentences an assistant could quote; avoid vague national claims if you are local."
      : "GEO: include factual anchors (location, scope, exclusions) so LLM-style answers can cite you accurately.";

  const linkedin =
    "LinkedIn: hook in one line; 2–4 short paragraphs or bullets; tie back to the same promise as the page; end with a single CTA. No hashtag stuffing.";

  return { seo, geo, linkedin };
}

export function draftScaffold(brief: ContentOpportunityBrief, ctx: DraftPipelineContext): {
  seo: string;
  geo: string;
  linkedin: string;
} {
  const t = brief.suggestedTitle.trim() || "Page";
  const intent = brief.primaryIntent.trim() || "(primary intent)";
  const target = brief.targetPage?.url?.trim() ?? "(set target URL on the queue row)";

  const seo = [
    `## ${t}`,
    "",
    "### Primary intent",
    intent,
    "",
    "### Outline / body",
    "- Key section 1",
    "- Key section 2",
    "- Objections / FAQs (if any)",
    "",
    "### Meta & snippet",
    `- Title idea: ${t}`,
    "- Meta description (≈150–160 characters):",
    "",
    "### Links & CTAs",
    `- Primary URL focus: ${target}`,
    "- Internal links to add:",
    "",
  ].join("\n");

  const geo = [
    `## GEO / citation notes — ${t}`,
    "",
    "### Answer-first facts",
    "- What you do (one sentence):",
    "- Who it is for:",
    "- Where you operate:",
    "",
    "### Scope & limits",
    "- Inclusions:",
    "- Exclusions or caveats:",
    "",
    "### Phrases to keep consistent with the live site",
    "- Brand / legal entity:",
    "- Service names:",
    "",
  ].join("\n");

  const linkedin = [
    "## Hook (one sentence)",
    "",
    "## Value (bullets)",
    "- ",
    "- ",
    "",
    "## CTA",
    "",
    `## Link`,
    target,
    "",
  ].join("\n");

  const geoBlock =
    isGeoHeavyOpportunity(ctx) ?
      `${geo}\n\n_(GEO-weighted opportunity — prioritize plain, quotable location and scope.)_`
    : geo;

  return { seo, geo: geoBlock, linkedin };
}

export function buildReviewChecklist(
  ctx: DraftPipelineContext,
): ReviewChecklistItem[] {
  const items: ReviewChecklistItem[] = [
    {
      id: "plan_target",
      label: "Target URL or publishing location is decided (or queue target page is correct).",
    },
    {
      id: "title_intent",
      label: "Suggested title and primary intent are reflected in your outline or draft notes.",
    },
    {
      id: "one_channel_substance",
      label: "At least one channel (SEO, GEO, or LinkedIn) has enough substance to hand off or paste into CMS.",
    },
  ];

  const cat = ctx.category.trim().toLowerCase();
  if (cat === "service" || clusterKind(ctx) === "service") {
    items.push({
      id: "service_depth",
      label: "Service draft covers offer, service area signal, proof, and a clear next step.",
    });
  }
  if (cat === "faq" || clusterKind(ctx) === "faq") {
    items.push({
      id: "faq_coverage",
      label: "FAQ-style prompts or questions from planning are explicitly addressed.",
    });
  }
  if (isGeoHeavyOpportunity(ctx)) {
    items.push({
      id: "geo_plain",
      label: "GEO notes state location/service area plainly (visible-copy mindset, not keyword stuffing).",
    });
  }
  if (isClusterOpportunity(ctx)) {
    items.push({
      id: "cluster_alignment",
      label: "Content aligns with the prompt cluster’s stored intents.",
    });
  }

  items.push({
    id: "voice_accuracy",
    label: "Claims, numbers, and offers match what the site may legally/factually state.",
  });

  items.sort((a, b) => a.id.localeCompare(b.id));
  return items;
}

export function reviewChecklistComplete(
  checklist: ReviewChecklistItem[],
  checkedIds: string[],
): boolean {
  const needed = new Set(checklist.map((c) => c.id));
  const got = new Set(checkedIds);
  for (const id of needed) {
    if (!got.has(id)) return false;
  }
  return true;
}

const LINKEDIN_MAX = 3000;
const MIN_SUBSTANCE_TOTAL = 40;

export function runSanitize(
  artifacts: PipelineArtifactsV1,
  ctx: DraftPipelineContext,
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const seo = artifacts.seoBody.trim();
  const geo = artifacts.geoNotes.trim();
  const li = artifacts.linkedinPost.trim();
  const total = seo.length + geo.length + li.length;

  if (total < MIN_SUBSTANCE_TOTAL) {
    issues.push(
      `Add more substance across SEO / GEO / LinkedIn drafts (combined trimmed length is under ${MIN_SUBSTANCE_TOTAL} characters).`,
    );
  }

  if (li.length > LINKEDIN_MAX) {
    issues.push(`LinkedIn draft exceeds ${LINKEDIN_MAX} characters (current ${li.length}).`);
  }

  if (isGeoHeavyOpportunity(ctx) && geo.length < 30) {
    issues.push("GEO-heavy opportunity: expand GEO notes (aim for at least ~30 characters of concrete location/scope detail).");
  }

  if (catNeedsSeoDepth(ctx) && seo.length > 0 && seo.length < 80) {
    issues.push(
      "Service/FAQ-style opportunity: SEO body looks thin — expand sections or trim placeholders (rough guide ≥80 characters of real draft).",
    );
  }

  const ok = issues.length === 0;
  return { ok, issues };
}

function catNeedsSeoDepth(ctx: DraftPipelineContext): boolean {
  const cat = ctx.category.trim().toLowerCase();
  if (cat === "service" || cat === "faq") return true;
  const k = clusterKind(ctx);
  return k === "service" || k === "faq";
}

export function pipelineStageLabel(stage: PipelineStage): string {
  switch (stage) {
    case "brief":
      return "Brief";
    case "draft":
      return "Draft";
    case "review":
      return "Review";
    case "sanitize":
      return "Sanitize";
    case "publish_ready":
      return "Publish-ready";
    default:
      return stage;
  }
}

export function nextPipelineStage(stage: PipelineStage): PipelineStage | null {
  const i = STAGE_INDEX[stage];
  if (i >= STAGE_INDEX.publish_ready) return null;
  return PIPELINE_STAGES[i + 1] ?? null;
}

export type AdvancePipelineResult =
  | { ok: true; nextStage: PipelineStage }
  | { ok: false; error: string };

export function tryAdvancePipeline(
  stage: PipelineStage,
  artifacts: PipelineArtifactsV1,
  ctx: DraftPipelineContext,
  checklist: ReviewChecklistItem[],
): AdvancePipelineResult {
  if (stage === "publish_ready") {
    return { ok: false, error: "Already at publish-ready." };
  }

  if (stage === "brief") {
    if (!artifacts.briefAcknowledged) {
      return { ok: false, error: "Confirm the brief before continuing." };
    }
    const n = nextPipelineStage(stage);
    return n ? { ok: true, nextStage: n } : { ok: false, error: "Invalid stage." };
  }

  if (stage === "draft") {
    const n = nextPipelineStage(stage);
    return n ? { ok: true, nextStage: n } : { ok: false, error: "Invalid stage." };
  }

  if (stage === "review") {
    if (!reviewChecklistComplete(checklist, artifacts.reviewCheckedIds)) {
      return { ok: false, error: "Complete every review checklist item before continuing." };
    }
    const n = nextPipelineStage(stage);
    return n ? { ok: true, nextStage: n } : { ok: false, error: "Invalid stage." };
  }

  if (stage === "sanitize") {
    const { ok, issues } = runSanitize(artifacts, ctx);
    if (!ok && !artifacts.sanitizeOverride) {
      const hint = issues[0] ?? "Resolve sanitize findings or acknowledge override.";
      return { ok: false, error: hint };
    }
    const n = nextPipelineStage(stage);
    return n ? { ok: true, nextStage: n } : { ok: false, error: "Invalid stage." };
  }

  return { ok: false, error: "Unknown stage." };
}
