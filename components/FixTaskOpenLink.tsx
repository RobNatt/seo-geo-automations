"use client";

export function FixTaskOpenLink({ taskId }: { taskId: string }) {
  return (
    <a
      href={`#open-fix-task-${taskId}`}
      className="shrink-0 text-xs font-medium text-sky-700 underline dark:text-sky-400"
      onClick={(e) => e.stopPropagation()}
    >
      Open
    </a>
  );
}
