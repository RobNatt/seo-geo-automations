/**
 * Fixed manual checklist for the page refresh workflow — no generated copy.
 */

export const PAGE_REFRESH_CHECKLIST_GROUPS = {
  content: "Content",
  metadata: "Metadata",
  dates: "Dates & freshness",
  links: "Internal links",
} as const;

export type PageRefreshChecklistGroup = keyof typeof PAGE_REFRESH_CHECKLIST_GROUPS;

export const PAGE_REFRESH_CHECKLIST_ITEMS: readonly {
  key: string;
  group: PageRefreshChecklistGroup;
  label: string;
}[] = [
  { key: "content_facts", group: "content", label: "Verify facts, pricing, and offers are current" },
  { key: "content_ctas", group: "content", label: "Update primary CTAs and on-page goals" },
  { key: "content_structure", group: "content", label: "Refresh headings, intro, and key sections for clarity" },
  { key: "metadata_title", group: "metadata", label: "Review page title (browser tab + search result title)" },
  { key: "metadata_description", group: "metadata", label: "Review meta description for accuracy and intent" },
  { key: "metadata_social", group: "metadata", label: "Check social / Open Graph fields if you use them" },
  { key: "dates_visible", group: "dates", label: "Update visible “last updated” or similar copy where shown" },
  { key: "dates_footer", group: "dates", label: "Spot-check sitewide year / copyright if shown on this template" },
  { key: "links_contextual", group: "links", label: "Add or fix contextual internal links to related pages" },
  { key: "links_reciprocal", group: "links", label: "Ensure key hub pages still link to this URL where it helps users" },
];

const ALLOWED_KEYS = new Set(PAGE_REFRESH_CHECKLIST_ITEMS.map((i) => i.key));

export function sanitizePageRefreshChecklist(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const k of Object.keys(raw as object)) {
      if (!ALLOWED_KEYS.has(k)) continue;
      out[k] = Boolean((raw as Record<string, unknown>)[k]);
    }
  }
  return out;
}

export function defaultPageRefreshChecklist(): Record<string, boolean> {
  return Object.fromEntries(PAGE_REFRESH_CHECKLIST_ITEMS.map((i) => [i.key, false])) as Record<string, boolean>;
}

export function mergeStoredPageRefreshChecklist(stored: unknown): Record<string, boolean> {
  return { ...defaultPageRefreshChecklist(), ...sanitizePageRefreshChecklist(stored) };
}

export function checklistCompletionCount(state: Record<string, boolean>): { done: number; total: number } {
  const total = PAGE_REFRESH_CHECKLIST_ITEMS.length;
  const done = PAGE_REFRESH_CHECKLIST_ITEMS.filter((i) => state[i.key]).length;
  return { done, total };
}
