import type { FixBucket } from "@/lib/audits/fix-plan";

/**
 * Deterministic ordering for open fix tasks (same rules everywhere: detail, report, exports).
 * Unknown buckets sort after `later`.
 */
export const OPEN_FIX_TASK_BUCKET_RANK: Record<FixBucket, number> = {
  immediate: 0,
  soon: 1,
  later: 2,
};

export type OpenFixTaskSortable = {
  bucket: string;
  priorityScore: number;
  dedupeKey: string;
};

export function compareOpenFixTasksByPriority(a: OpenFixTaskSortable, b: OpenFixTaskSortable): number {
  const ra = OPEN_FIX_TASK_BUCKET_RANK[a.bucket as FixBucket] ?? 9;
  const rb = OPEN_FIX_TASK_BUCKET_RANK[b.bucket as FixBucket] ?? 9;
  const d = ra - rb;
  if (d !== 0) return d;
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  return a.dedupeKey.localeCompare(b.dedupeKey);
}

export function sortOpenFixTasksByPriority<T extends OpenFixTaskSortable>(tasks: T[]): T[] {
  return [...tasks].sort(compareOpenFixTasksByPriority);
}

/** UI workflow lanes — maps fix-plan buckets without changing sort/dedupe. */
export type OpenFixWorkflowGroup = "now" | "next" | "later";

export const OPEN_FIX_WORKFLOW_ORDER: OpenFixWorkflowGroup[] = ["now", "next", "later"];

export const OPEN_FIX_WORKFLOW_COPY: Record<
  OpenFixWorkflowGroup,
  { title: string; hint: string }
> = {
  now: {
    title: "Do now",
    hint: "Immediate — blocking or quick wins; tackle these first.",
  },
  next: {
    title: "Do next",
    hint: "Soon — after “now” items are cleared.",
  },
  later: {
    title: "Do later",
    hint: "Later — tuning and lower-urgency follow-ups.",
  },
};

/**
 * Split an already-sorted task list into workflow groups. Order inside each group
 * matches the input order (caller should pass `sortOpenFixTasksByPriority` output).
 * Unknown buckets go to “later”.
 */
export function groupOpenFixTasksByWorkflow<T extends { bucket: string }>(
  sortedTasks: T[],
): Record<OpenFixWorkflowGroup, T[]> {
  const out: Record<OpenFixWorkflowGroup, T[]> = { now: [], next: [], later: [] };
  for (const t of sortedTasks) {
    const b = t.bucket as FixBucket;
    if (b === "immediate") out.now.push(t);
    else if (b === "soon") out.next.push(t);
    else out.later.push(t);
  }
  return out;
}
