import type { FixBucket, FixRecommendation } from "@/lib/audits/fix-plan";
import { FixPriorityExplainer } from "@/components/FixPriorityExplainer";

const BUCKET_COPY: Record<
  FixBucket,
  { label: string; description: string }
> = {
  immediate: {
    label: "Immediate",
    description: "Blocking issues or high-impact, low-effort fixes—do these first.",
  },
  soon: {
    label: "Soon",
    description: "Important follow-ups after immediate items; moderate effort or sequencing.",
  },
  later: {
    label: "Later",
    description: "Polish, tuning, or lower-urgency work once core issues are handled.",
  },
};

const BUCKET_ORDER: FixBucket[] = ["immediate", "soon", "later"];

export function FixRecommendations({
  grouped,
  showPriorityExplainer = true,
}: {
  grouped: Record<FixBucket, FixRecommendation[]>;
  showPriorityExplainer?: boolean;
}) {
  const total = BUCKET_ORDER.reduce((n, b) => n + grouped[b].length, 0);

  if (total === 0) {
    return <p className="text-sm text-zinc-500">No fixes needed — all checks passed.</p>;
  }

  return (
    <div className="space-y-8">
      {BUCKET_ORDER.map((bucket) => {
        const items = grouped[bucket];
        if (items.length === 0) return null;
        const meta = BUCKET_COPY[bucket];
        return (
          <section key={bucket}>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{meta.label}</h3>
            <p className="mt-0.5 text-xs text-zinc-500">{meta.description}</p>
            <ol className="mt-3 space-y-3">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {item.checkKey}:{item.sourceStatus}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      impact {item.impact}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      effort {item.effort}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      score {item.priorityScore}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.detail}</p>
                  <p className="mt-2 text-xs text-zinc-500">{item.rankingNote}</p>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      {showPriorityExplainer ? <FixPriorityExplainer /> : null}
    </div>
  );
}
