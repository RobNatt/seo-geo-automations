/**
 * Content execution queue — mirrors fix-task style statuses; kept deterministic for forms and queries.
 */

export const CONTENT_QUEUE_STATUS = {
  QUEUED: "queued",
  IN_PROGRESS: "in_progress",
  DONE: "done",
  CANCELLED: "cancelled",
} as const;

export type ContentQueueStatus = (typeof CONTENT_QUEUE_STATUS)[keyof typeof CONTENT_QUEUE_STATUS];

const UNRESOLVED = new Set<string>([CONTENT_QUEUE_STATUS.QUEUED, CONTENT_QUEUE_STATUS.IN_PROGRESS]);

export function isContentQueueUnresolvedStatus(status: string): boolean {
  return UNRESOLVED.has(status);
}

/** Allowed category values for enqueue (caller may map UI labels here). */
export const CONTENT_QUEUE_CATEGORIES = [
  "service",
  "faq",
  "geo",
  "onpage",
  "snippet",
  "supporting",
  "other",
] as const;

export type ContentQueueCategory = (typeof CONTENT_QUEUE_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(CONTENT_QUEUE_CATEGORIES);

export function normalizeContentQueueCategory(raw: string): ContentQueueCategory | null {
  const c = raw.trim().toLowerCase();
  return CATEGORY_SET.has(c) ? (c as ContentQueueCategory) : null;
}

export function clampContentQueuePriority(n: number): number {
  if (Number.isNaN(n)) return 50;
  return Math.max(1, Math.min(999, Math.round(n)));
}
