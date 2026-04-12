/**
 * Manual content refresh queue — same status vocabulary as the main content queue; deterministic only.
 */

export const CONTENT_REFRESH_QUEUE_STATUS = {
  QUEUED: "queued",
  IN_PROGRESS: "in_progress",
  DONE: "done",
  CANCELLED: "cancelled",
} as const;

export type ContentRefreshQueueStatus =
  (typeof CONTENT_REFRESH_QUEUE_STATUS)[keyof typeof CONTENT_REFRESH_QUEUE_STATUS];

const UNRESOLVED = new Set<string>([
  CONTENT_REFRESH_QUEUE_STATUS.QUEUED,
  CONTENT_REFRESH_QUEUE_STATUS.IN_PROGRESS,
]);

export function isContentRefreshQueueUnresolvedStatus(status: string): boolean {
  return UNRESOLVED.has(status);
}

export function clampContentRefreshQueuePriority(n: number): number {
  if (Number.isNaN(n)) return 50;
  return Math.max(1, Math.min(999, Math.round(n)));
}
