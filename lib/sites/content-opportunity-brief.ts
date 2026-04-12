/**
 * Writer-facing briefs from queued opportunities — deterministic strings only (no generated copy).
 * Rule keys mirror `content-opportunity-rules.ts`; cluster keys use stored title + prompts.
 */

export type ContentOpportunityBriefPage = {
  url: string;
  title: string | null;
};

export type ContentOpportunityBriefInput = {
  opportunityKey: string;
  queueTitle: string | null;
  queueDetail: string | null;
  queuePage: ContentOpportunityBriefPage | null;
  cluster?: {
    title: string;
    prompts: string[];
    targetPages: ContentOpportunityBriefPage[];
  };
};

export type ContentOpportunityBrief = {
  opportunityKey: string;
  targetPage: ContentOpportunityBriefPage | null;
  suggestedTitle: string;
  primaryIntent: string;
};

const CLUSTER_PREFIX = "cluster:";

export function parseClusterOpportunityKey(opportunityKey: string): string | null {
  if (!opportunityKey.startsWith(CLUSTER_PREFIX)) return null;
  const k = opportunityKey.slice(CLUSTER_PREFIX.length).trim();
  return k.length > 0 ? k : null;
}

function humanizeSlug(slug: string): string {
  const s = slug.replace(/[-_]+/g, " ").trim();
  return s.length > 0 ? s : slug;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function intentFromStoredPrompts(prompts: string[]): string {
  const lines = prompts.map((p) => p.trim()).filter(Boolean);
  if (lines.length === 0) {
    return "Add prompts to the cluster to record the exact queries or user intents this page should satisfy.";
  }
  if (lines.length === 1) return `Satisfy this stored prompt: ${truncate(lines[0], 220)}`;
  return `Primary: ${truncate(lines[0], 160)} · Also cover: ${truncate(lines[1], 160)}`;
}

/**
 * Fixed lines for each `content_opp:*` key shape (aligned with rule module; no inference).
 */
function briefLinesForRuleKey(
  opportunityKey: string,
  queueTitle: string | null,
  queueDetail: string | null,
): { suggestedTitle: string; primaryIntent: string } {
  const qt = queueTitle?.trim();
  const qd = queueDetail?.trim();
  const fallbackTitle = qt || opportunityKey;
  const fallbackIntent = qd
    ? truncate(qd, 240)
    : "Execute using your editorial standards; detail was not stored on the queue row.";

  if (opportunityKey === "content_opp:geo:audit_visible_text") {
    return {
      suggestedTitle: "Visible location / service area",
      primaryIntent:
        "State where you operate in visible body copy so visitors and GEO checks see it (not only meta or tags).",
    };
  }
  if (opportunityKey === "content_opp:geo:checklist_visibility") {
    return {
      suggestedTitle: "Confirm on-page GEO visibility",
      primaryIntent:
        "Finish the launch checklist GEO item by making primary service area or location obvious on key pages.",
    };
  }
  if (opportunityKey === "content_opp:geo:fix_task_pending") {
    return {
      suggestedTitle: "Reconcile GEO tasks with current audit",
      primaryIntent:
        "Close or refresh open GEO-related fix tasks now that the audit state has changed.",
    };
  }
  if (opportunityKey === "content_opp:service:no_catalog_mapping") {
    return {
      suggestedTitle: "Map site URLs to service catalog",
      primaryIntent:
        "Link each major offering URL to a Service record so coverage and reporting stay accurate.",
    };
  }
  if (opportunityKey.startsWith("content_opp:service:gap:")) {
    const slug = opportunityKey.slice("content_opp:service:gap:".length);
    const label = humanizeSlug(slug);
    return {
      suggestedTitle: `Service page — ${label}`,
      primaryIntent: `Publish or attach a page that fully explains the “${label}” offering for this site.`,
    };
  }
  if (opportunityKey === "content_opp:faq:no_cluster") {
    return {
      suggestedTitle: "Add an FAQ prompt cluster",
      primaryIntent:
        "Create a faq_* cluster listing real customer questions so FAQ content can be planned and measured.",
    };
  }
  if (opportunityKey.startsWith("content_opp:faq:thin_prompts:")) {
    const ck = opportunityKey.slice("content_opp:faq:thin_prompts:".length);
    return {
      suggestedTitle: `Expand FAQ cluster “${ck}”`,
      primaryIntent:
        "Add more distinct FAQ prompts (stored strings) until coverage meets the thin-FAQ threshold.",
    };
  }
  if (opportunityKey === "content_opp:snippet:title_task_open") {
    return {
      suggestedTitle: "Fix page title (queued)",
      primaryIntent:
        "Write a unique, intent-clear <title> aligned with the page’s primary topic (resolve open fix task).",
    };
  }
  if (opportunityKey === "content_opp:snippet:meta_task_open") {
    return {
      suggestedTitle: "Fix meta description (queued)",
      primaryIntent:
        "Write a concise meta description that matches search intent and snippet length guidance.",
    };
  }

  return {
    suggestedTitle: fallbackTitle,
    primaryIntent: fallbackIntent,
  };
}

export function buildContentOpportunityBrief(input: ContentOpportunityBriefInput): ContentOpportunityBrief {
  const clusterKey = parseClusterOpportunityKey(input.opportunityKey);

  if (input.cluster) {
    const targetPage =
      input.queuePage ?? input.cluster.targetPages[0] ?? null;
    const suggestedTitle = input.cluster.title.trim() || `Prompt cluster (${clusterKey})`;
    return {
      opportunityKey: input.opportunityKey,
      targetPage,
      suggestedTitle,
      primaryIntent: intentFromStoredPrompts(input.cluster.prompts),
    };
  }

  if (clusterKey) {
    return {
      opportunityKey: input.opportunityKey,
      targetPage: input.queuePage,
      suggestedTitle: input.queueTitle?.trim() || `Cluster: ${clusterKey}`,
      primaryIntent:
        input.queueDetail?.trim() ||
        "Cluster not found in catalog — restore it or update this queue item; intents come from stored prompts when the cluster exists.",
    };
  }

  const frag = briefLinesForRuleKey(input.opportunityKey, input.queueTitle, input.queueDetail);
  return {
    opportunityKey: input.opportunityKey,
    targetPage: input.queuePage,
    suggestedTitle: frag.suggestedTitle,
    primaryIntent: frag.primaryIntent,
  };
}

export function formatContentOpportunityBriefBlock(b: ContentOpportunityBrief, index: number): string {
  const target = b.targetPage
    ? `${b.targetPage.title?.trim() || "(no title)"} — ${b.targetPage.url}`
    : "(pick or create target URL)";
  return [
    `— ${index + 1}. ${b.opportunityKey}`,
    `Target page: ${target}`,
    `Suggested title: ${b.suggestedTitle}`,
    `Primary intent: ${b.primaryIntent}`,
    "",
  ].join("\n");
}

export function formatAllContentOpportunityBriefsPlain(briefs: ContentOpportunityBrief[]): string {
  if (briefs.length === 0) return "";
  const header = "CONTENT WRITER BRIEFS\n=====================\n\n";
  return (
    header +
    briefs.map((b, i) => formatContentOpportunityBriefBlock(b, i)).join("\n").trimEnd()
  );
}
