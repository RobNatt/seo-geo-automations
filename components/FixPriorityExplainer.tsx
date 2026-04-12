export function FixPriorityExplainer() {
  return (
    <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
        How fix priority is calculated
      </summary>
      <div className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
        <p>
          <strong className="text-zinc-800 dark:text-zinc-200">Score</strong> (higher = more urgent within
          the same time bucket):{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">100×I − 10×E + 5×S</code>. Weights:
          impact <em>I</em> (high=3, medium=2, low=1), effort <em>E</em> (low=1, medium=2, high=3), severity{" "}
          <em>S</em> (high=3, medium=2, low=1).
        </p>
        <p>
          <strong className="text-zinc-800 dark:text-zinc-200">Buckets</strong> use fixed rules: URL fetch
          failures → <strong>Immediate</strong>; meta description length warnings → <strong>Later</strong>;
          high impact + low effort → <strong>Immediate</strong>; low impact or high effort without high impact
          → <strong>Later</strong>; otherwise → <strong>Soon</strong>.
        </p>
        <p className="font-mono text-[11px] text-zinc-500">Source: lib/audits/fix-plan.ts (file header).</p>
      </div>
    </details>
  );
}
