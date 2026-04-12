import Link from "next/link";
import { importContentPerformanceCsvForm } from "@/app/actions/content-performance";
import type {
  ContentPerformanceDashboard,
  ContentPerformanceInsightRow,
} from "@/lib/sites/load-content-performance-dashboard";
import { CONTENT_REFRESH_HIGH_PRIORITY_MIN_SCORE } from "@/lib/sites/content-refresh-rank";

const btn =
  "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200";

const exampleCsv = `url,period_start,period_end,impressions,clicks,engaged_sessions,conversions
/services/plumbing,2026-03-01,2026-03-07,1200,42,18,0`;

function InsightColumn({
  siteId,
  title,
  subtitle,
  items,
  empty,
  borderClass,
}: {
  siteId: string;
  title: string;
  subtitle: string;
  items: ContentPerformanceInsightRow[];
  empty: string;
  borderClass: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border bg-zinc-50/80 p-3 dark:bg-zinc-900/40 ${borderClass}`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">{title}</h3>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">{subtitle}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-1 flex-col gap-3">
          {items.map((row) => (
            <li key={row.pageId} className="border-t border-zinc-200/80 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-700/80">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <a
                  href={row.url}
                  className="break-all text-sm font-medium text-sky-700 underline dark:text-sky-400"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open live page
                </a>
                <Link
                  href={`/sites/${siteId}/refresh/${row.pageId}`}
                  className="shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
                >
                  Refresh workflow
                </Link>
              </div>
              <p className="mt-0.5 break-all font-mono text-[10px] text-zinc-500 dark:text-zinc-500">{row.url}</p>
              {row.title?.trim() ? (
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-500">{row.title}</p>
              ) : null}
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">{row.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ContentPerformanceSection({
  siteId,
  dashboard,
}: {
  siteId: string;
  dashboard: ContentPerformanceDashboard;
}) {
  const hasSnapshots = dashboard.snapshotCount > 0;

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Content performance
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Snapshot-driven view: strongest pages, declining momentum, and high-priority refreshes (score ≥{" "}
        {CONTENT_REFRESH_HIGH_PRIORITY_MIN_SCORE}). Import CSV to populate; all signals are rule-based.
      </p>

      {dashboard.latestImportHint ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">{dashboard.latestImportHint}</p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          No rows in the last ~120 days — import a CSV below to light up this section.
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <InsightColumn
          siteId={siteId}
          title="Top performing"
          subtitle="Latest period only: solid volume (≥50 impressions, ≥2 clicks), ranked by clicks then reach."
          items={dashboard.topPerforming}
          empty={
            hasSnapshots ?
              "No page cleared the volume bar for “top” yet — lower thresholds or wait for more traffic."
            : "Import performance CSV to rank top pages."
          }
          borderClass="border-emerald-200 dark:border-emerald-900/50"
        />
        <InsightColumn
          siteId={siteId}
          title="Declining"
          subtitle="Period-over-period: traffic down ≥25% (with enough prior volume) or CTR down sharply vs prior."
          items={dashboard.declining}
          empty={
            hasSnapshots ?
              "No declining momentum detected in the current snapshot window."
            : "Import performance CSV to detect declines."
          }
          borderClass="border-rose-200 dark:border-rose-900/50"
        />
        <InsightColumn
          siteId={siteId}
          title="Needs refresh"
          subtitle={`High-priority tier from the refresh ruleset (same scores as reports).`}
          items={dashboard.needingRefresh}
          empty={
            hasSnapshots ?
              "No page is in the high-priority refresh band right now."
            : "Import performance CSV to compute refresh priority."
          }
          borderClass="border-amber-200 dark:border-amber-900/50"
        />
      </div>

      <div className="mt-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50/50 p-3 dark:border-zinc-600 dark:bg-zinc-900/30">
        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">Import CSV (manual)</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">
          Required: <span className="font-mono">url, period_start, period_end, impressions, clicks</span>. Optional:{" "}
          <span className="font-mono">engaged_sessions, conversions, opportunity_key, cluster_key</span>. Dates{" "}
          <span className="font-mono">YYYY-MM-DD</span>.
        </p>
        <pre className="mt-2 overflow-x-auto rounded border border-zinc-200 bg-white p-2 font-mono text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          {exampleCsv}
        </pre>
        <form action={importContentPerformanceCsvForm} className="mt-3 space-y-2">
          <input type="hidden" name="siteId" value={siteId} />
          <textarea
            name="csvText"
            rows={4}
            placeholder="Paste CSV here…"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <button type="submit" className={btn}>
            Import performance CSV
          </button>
        </form>
      </div>

      {dashboard.recentSnapshots.length > 0 ? (
        <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Recent snapshot rows
          </h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
            {dashboard.recentSnapshots.map((s, i) => (
              <li key={`${s.pageUrl}-${s.periodEnd}-${i}`} className="flex flex-wrap gap-x-2">
                <span className="font-mono text-zinc-500">
                  {s.periodStart}→{s.periodEnd}
                </span>
                <span className="break-all">{s.pageUrl}</span>
                <span>
                  imp {s.impressions ?? "—"}, clk {s.clicks ?? "—"}
                  {s.ctr != null ? `, CTR ${(s.ctr * 100).toFixed(2)}%` : ""}
                </span>
                <span className="text-zinc-500">({s.source})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
