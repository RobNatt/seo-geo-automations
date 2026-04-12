import Link from "next/link";

import {
  advancePipelineStageForm,
  applyDraftScaffoldForm,
  savePipelineArtifactsForm,
  savePublishReadyChecklistForm,
  startContentDraftPipelineForm,
} from "@/app/actions/content-draft-pipeline";
import { CopyReportButton } from "@/components/CopyReportButton";
import {
  PIPELINE_STAGES,
  pipelineStageLabel,
  type PipelineStage,
} from "@/lib/sites/content-draft-pipeline";
import { repurposingTargetLabel } from "@/lib/sites/content-brief";
import type { DraftQaStatus } from "@/lib/sites/draft-workspace-qa";
import type { ContentDraftPipelinePageState } from "@/lib/sites/load-content-draft-pipeline";
import { formatLinkedInVariationsPlain } from "@/lib/sites/repurpose-from-draft";
import { publishReadyChecklistCompletion } from "@/lib/sites/publish-ready-checklist";
import { contentQueueItemAllowsPipeline } from "@/lib/sites/load-content-draft-pipeline";

const btn =
  "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200";
const btnPrimary =
  "rounded border border-sky-600 bg-sky-600 px-3 py-1.5 text-sm font-medium text-white dark:border-sky-500 dark:bg-sky-600";

function qaStatusClasses(status: DraftQaStatus): string {
  switch (status) {
    case "pass":
      return "border-emerald-300 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100";
    case "warn":
      return "border-amber-300 bg-amber-50/90 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
    case "fail":
      return "border-rose-300 bg-rose-50/90 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100";
    default:
      return "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900";
  }
}

function QaStatusBadge({ status }: { status: DraftQaStatus }) {
  const label = status === "pass" ? "OK" : status === "warn" ? "Check" : "Fix";
  return (
    <span
      className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${qaStatusClasses(status)}`}
    >
      {label}
    </span>
  );
}

function PublishChecklistBar({
  done,
  total,
  stage,
}: {
  done: number;
  total: number;
  stage: PipelineStage;
}) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        <span>Publish checklist</span>
        <span className={complete ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}>
          {done}/{total}
          {complete ? " · done" : ""}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {stage !== "publish_ready" ? (
        <p className="mt-1.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">
          Check off on the <span className="font-medium text-zinc-600 dark:text-zinc-400">Publish-ready</span> step.
          Each line hints from your brief and page draft.
        </p>
      ) : null}
    </div>
  );
}

function StageStepper({ current }: { current: PipelineStage | null }) {
  const idx = current ? PIPELINE_STAGES.indexOf(current) : -1;
  return (
    <ol className="flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
      {PIPELINE_STAGES.map((s, i) => (
        <li
          key={s}
          className={
            i === idx
              ? "rounded-full border border-sky-500 bg-sky-50 px-2 py-0.5 text-sky-800 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-200"
              : i < idx
                ? "rounded-full border border-emerald-300 bg-emerald-50/80 px-2 py-0.5 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-700"
          }
        >
          {pipelineStageLabel(s)}
        </li>
      ))}
    </ol>
  );
}

function PublishBundlePlain(data: ContentDraftPipelinePageState): string {
  const { contentBrief, artifacts, opportunityKey, queueTitle } = data;
  const lines = [
    `Opportunity: ${opportunityKey}`,
    `Queue title: ${queueTitle}`,
    "",
    "--- Content brief (source of truth) ---",
    `Topic: ${contentBrief.topic}`,
    `Intent: ${contentBrief.intent}`,
    `Audience: ${contentBrief.audience}`,
    contentBrief.targetPageUrl ?
      `Target page: ${contentBrief.targetPageUrl}${contentBrief.targetPageTitle ? ` (${contentBrief.targetPageTitle})` : ""}`
    : "Target page: (not set)",
    "",
    "Primary points:",
    ...(contentBrief.primaryPoints.length > 0 ?
      contentBrief.primaryPoints.map((p) => `  - ${p}`)
    : ["  (none)"]),
    "",
    `Repurposing targets: ${contentBrief.repurposingTargets.join(", ")}`,
    "",
    "--- SEO / page draft ---",
    artifacts.seoBody.trim() || "(empty)",
    "",
    "--- GEO notes ---",
    artifacts.geoNotes.trim() || "(empty)",
    "",
    "--- LinkedIn ---",
    artifacts.linkedinPost.trim() || "(empty)",
  ];
  return lines.join("\n");
}

export function ContentDraftPipelineView({
  data,
  message,
}: {
  data: ContentDraftPipelinePageState;
  message?: string;
}) {
  const {
    siteId,
    siteName,
    queueItemId,
    pipelineStage,
    artifacts,
    contentBrief,
    checklist,
    guidance,
    scaffold,
    sanitize,
    draftWorkspaceQa,
    repurposeBlocks,
    repurposePackPlain,
    publishReadyChecklist,
  } = data;
  const allowed = contentQueueItemAllowsPipeline(data.queueStatus);
  const stage = pipelineStage;
  const publishCheckProgress = publishReadyChecklistCompletion(
    artifacts.publishReadyCheckedIds,
    publishReadyChecklist,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Content draft pipeline
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{siteName}</h1>
          <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">{data.opportunityKey}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{data.queueTitle}</p>
        </div>
        <Link
          href={`/sites/${siteId}`}
          className="text-sm font-medium text-sky-700 underline underline-offset-2 dark:text-sky-400"
        >
          ← Back to site
        </Link>
      </div>

      {message ? (
        <p className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
          {message}
        </p>
      ) : null}

      {!allowed ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          This queue item is done or cancelled — pipeline is read-only in the database; open a new queue row to draft
          again.
        </p>
      ) : null}

      {allowed && stage == null ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Start pipeline</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            A <span className="font-medium text-zinc-800 dark:text-zinc-200">content brief</span> is already stored for
            this queue item (topic, intent, audience, primary points, repurposing targets). Starting the pipeline adds
            stages for drafting and review; you write the copy.
          </p>
          <form action={startContentDraftPipelineForm} className="mt-4">
            <input type="hidden" name="siteId" value={siteId} />
            <input type="hidden" name="itemId" value={queueItemId} />
            <button type="submit" className={btnPrimary}>
              Start drafting pipeline
            </button>
          </form>
        </section>
      ) : null}

      {allowed && stage != null ? (
        <>
          <div className="mb-6">
            <StageStepper current={stage} />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Current stage: <span className="font-medium text-zinc-700 dark:text-zinc-300">{pipelineStageLabel(stage)}</span>
            </p>
            <PublishChecklistBar
              done={publishCheckProgress.done}
              total={publishCheckProgress.total}
              stage={stage}
            />
          </div>

          {stage === "brief" ? (
            <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Brief</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Stored content brief (source of truth). Confirm, then continue to drafts aligned with repurposing
                targets.
              </p>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Topic
                  </dt>
                  <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{contentBrief.topic}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Target page
                  </dt>
                  <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                    {contentBrief.targetPageUrl ? (
                      <>
                        {contentBrief.targetPageTitle?.trim() ? (
                          <span className="font-medium">{contentBrief.targetPageTitle}</span>
                        ) : (
                          <span className="text-zinc-500">(no title)</span>
                        )}
                        <br />
                        <a
                          href={contentBrief.targetPageUrl}
                          className="break-all text-sky-700 underline dark:text-sky-400"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {contentBrief.targetPageUrl}
                        </a>
                      </>
                    ) : (
                      <span className="text-zinc-500">Not set — link a page on the queue row from the site view.</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Intent
                  </dt>
                  <dd className="mt-0.5 leading-snug text-zinc-700 dark:text-zinc-300">{contentBrief.intent}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Audience
                  </dt>
                  <dd className="mt-0.5 leading-snug text-zinc-700 dark:text-zinc-300">{contentBrief.audience}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Primary points
                  </dt>
                  <dd className="mt-0.5">
                    {contentBrief.primaryPoints.length > 0 ? (
                      <ul className="list-inside list-disc text-zinc-700 dark:text-zinc-300">
                        {contentBrief.primaryPoints.map((p, i) => (
                          <li key={`${i}-${p.slice(0, 24)}`} className="leading-snug">
                            {p}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-500">(none — add cluster prompts or edit the brief in a future step)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Repurposing targets
                  </dt>
                  <dd className="mt-0.5 flex flex-wrap gap-1.5">
                    {contentBrief.repurposingTargets.map((id) => (
                      <span
                        key={id}
                        className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        {repurposingTargetLabel(id)}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
              <form action={advancePipelineStageForm} className="mt-4 flex flex-wrap gap-2">
                <input type="hidden" name="siteId" value={siteId} />
                <input type="hidden" name="itemId" value={queueItemId} />
                <input type="hidden" name="seoBody" value={artifacts.seoBody} />
                <input type="hidden" name="geoNotes" value={artifacts.geoNotes} />
                <input type="hidden" name="linkedinPost" value={artifacts.linkedinPost} />
                <button type="submit" className={btnPrimary}>
                  Confirm brief &amp; continue to draft
                </button>
              </form>
            </section>
          ) : null}

          {stage === "draft" ? (
            <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Drafting workspace</h2>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Brief on the left, your drafts in the center (nothing is auto-written). QA on the right is
                  heuristic-only — save to refresh checks after edits.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,15rem)] lg:items-start">
                <aside className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Brief
                  </p>
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Topic</p>
                    <p className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{contentBrief.topic}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Target page</p>
                    <p className="mt-0.5 break-all text-xs text-zinc-700 dark:text-zinc-300">
                      {contentBrief.targetPageUrl ? (
                        <a
                          href={contentBrief.targetPageUrl}
                          className="text-sky-700 underline dark:text-sky-400"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {contentBrief.targetPageUrl}
                        </a>
                      ) : (
                        <span className="text-zinc-500">Not set</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Intent</p>
                    <p className="mt-0.5 text-xs leading-snug text-zinc-700 dark:text-zinc-300">{contentBrief.intent}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Audience</p>
                    <p className="mt-0.5 text-xs leading-snug text-zinc-700 dark:text-zinc-300">{contentBrief.audience}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Primary points</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-zinc-700 dark:text-zinc-300">
                      {contentBrief.primaryPoints.length > 0 ?
                        contentBrief.primaryPoints.map((p, i) => (
                          <li key={`${i}-${p.slice(0, 20)}`}>{p}</li>
                        ))
                      : <li className="list-none text-zinc-500">(none)</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Repurposing</p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {contentBrief.repurposingTargets.map((id) => (
                        <span
                          key={id}
                          className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium dark:border-zinc-600 dark:bg-zinc-800"
                        >
                          {repurposingTargetLabel(id)}
                        </span>
                      ))}
                    </p>
                  </div>
                </aside>

                <div className="min-w-0 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                    <p className="rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">SEO</span> · {guidance.seo}
                    </p>
                    <p className="rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">GEO</span> · {guidance.geo}
                    </p>
                    <p className="rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">LinkedIn</span> ·{" "}
                      {guidance.linkedin}
                    </p>
                  </div>

                  <details className="rounded-md border border-dashed border-zinc-300 bg-zinc-50/50 p-3 dark:border-zinc-600 dark:bg-zinc-900/30">
                    <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      Outline scaffolds (optional — fills all three fields)
                    </summary>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Applies rule-based outlines only; you still write final copy.
                    </p>
                    <form action={applyDraftScaffoldForm} className="mt-2">
                      <input type="hidden" name="siteId" value={siteId} />
                      <input type="hidden" name="itemId" value={queueItemId} />
                      <input type="hidden" name="scaffoldSeo" value={scaffold.seo} />
                      <input type="hidden" name="scaffoldGeo" value={scaffold.geo} />
                      <input type="hidden" name="scaffoldLinkedin" value={scaffold.linkedin} />
                      <button type="submit" className={btn}>
                        Apply scaffolds
                      </button>
                    </form>
                  </details>

                  <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950/40">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Draft state
                    </p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Primary: page/SEO draft. GEO and LinkedIn are optional repurposing slots — expand below.
                    </p>
                    <form className="mt-3 space-y-4">
                      <input type="hidden" name="siteId" value={siteId} />
                      <input type="hidden" name="itemId" value={queueItemId} />
                      <input type="hidden" name="syncSanitizeOverride" value="no" />
                      <WorkspaceDraftFields artifacts={artifacts} />
                      <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                        <button type="submit" formAction={savePipelineArtifactsForm} className={btn}>
                          Save draft
                        </button>
                        <button type="submit" formAction={advancePipelineStageForm} className={btnPrimary}>
                          Continue to review
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <aside className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Draft QA
                  </p>
                  <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">
                    Title, structure, FAQ, and CTA — pattern checks on your text, not auto-edits.
                  </p>
                  <ul className="space-y-2">
                    {draftWorkspaceQa.map((row) => (
                      <li
                        key={row.id}
                        className={`rounded border p-2 text-xs ${qaStatusClasses(row.status)}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold leading-tight">{row.label}</span>
                          <QaStatusBadge status={row.status} />
                        </div>
                        <p className="mt-1 text-[11px] leading-snug opacity-90">{row.detail}</p>
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
            </section>
          ) : null}

          {stage === "review" ? (
            <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Review</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Check every item (deterministic for this opportunity type), then continue.
              </p>
              <form action={advancePipelineStageForm} className="space-y-3">
                <input type="hidden" name="siteId" value={siteId} />
                <input type="hidden" name="itemId" value={queueItemId} />
                <input type="hidden" name="seoBody" value={artifacts.seoBody} />
                <input type="hidden" name="geoNotes" value={artifacts.geoNotes} />
                <input type="hidden" name="linkedinPost" value={artifacts.linkedinPost} />
                <ul className="space-y-2">
                  {checklist.map((c) => (
                    <li key={c.id} className="flex gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        name="reviewCheck"
                        value={c.id}
                        defaultChecked={artifacts.reviewCheckedIds.includes(c.id)}
                        className="mt-1"
                      />
                      <label>{c.label}</label>
                    </li>
                  ))}
                </ul>
                <button type="submit" className={btnPrimary}>
                  Continue to sanitize
                </button>
              </form>
            </section>
          ) : null}

          {stage === "sanitize" ? (
            <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Sanitize</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Rule-based checks on your drafts. Fix text, or tick override and continue (validated on submit).
              </p>
              {sanitize.ok ? (
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">All checks passed.</p>
              ) : (
                <ul className="list-inside list-disc text-sm text-amber-900 dark:text-amber-100">
                  {sanitize.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <form action={advancePipelineStageForm} className="space-y-4">
                <input type="hidden" name="siteId" value={siteId} />
                <input type="hidden" name="itemId" value={queueItemId} />
                <DraftFields artifacts={artifacts} />
                {!sanitize.ok ? (
                  <label className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      name="sanitizeOverride"
                      defaultChecked={artifacts.sanitizeOverride}
                      className="mt-1"
                    />
                    <span>I acknowledge remaining issues and want to mark publish-ready anyway.</span>
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={btnPrimary}>
                    Continue to publish-ready
                  </button>
                </div>
              </form>
              <form action={savePipelineArtifactsForm} className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <input type="hidden" name="siteId" value={siteId} />
                <input type="hidden" name="itemId" value={queueItemId} />
                <input type="hidden" name="syncSanitizeOverride" value="yes" />
                <DraftFields artifacts={artifacts} />
                {!sanitize.ok ? (
                  <label className="mt-3 flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      name="sanitizeOverride"
                      defaultChecked={artifacts.sanitizeOverride}
                      className="mt-1"
                    />
                    <span>Save override flag (without advancing)</span>
                  </label>
                ) : null}
                <button type="submit" className={`${btn} mt-3`}>
                  Save drafts / override
                </button>
              </form>
            </section>
          ) : null}

          {stage === "publish_ready" ? (
            <section className="space-y-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div
                id="publish-checklist"
                className="rounded-lg border border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
              >
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Publish-ready checklist
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Manual confirmation in CMS (not auto-detected). Hints refresh after you save drafts and reload. Stored
                  on this queue item.
                </p>
                <form action={savePublishReadyChecklistForm} className="mt-3 space-y-3">
                  <input type="hidden" name="siteId" value={siteId} />
                  <input type="hidden" name="itemId" value={queueItemId} />
                  <ul className="space-y-3">
                    {publishReadyChecklist.map((row) => (
                      <li
                        key={row.id}
                        className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950/40"
                      >
                        <label className="flex cursor-pointer gap-2.5">
                          <input
                            type="checkbox"
                            name="publishReadyCheck"
                            value={row.id}
                            defaultChecked={artifacts.publishReadyCheckedIds.includes(row.id)}
                            className="mt-1"
                          />
                          <span>
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.label}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                              {row.hint}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button type="submit" className={btn}>
                    Save checklist
                  </button>
                </form>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Publish-ready</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Raw bundle plus deterministic repurposing shells (same brief + core points — structured, not final
                  copy). Mark the queue item done from the site view when live.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyReportButton text={PublishBundlePlain(data)} label="Copy full bundle" />
                  <CopyReportButton text={repurposePackPlain} label="Copy all repurposing" />
                </div>
                <pre className="mt-3 max-h-[280px] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 whitespace-pre-wrap">
                  {PublishBundlePlain(data)}
                </pre>
              </div>

              <div className="border-t border-zinc-200 pt-5 dark:border-zinc-700">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Repurposing outputs
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Built from the content brief and your saved drafts. Paste into blog CMS, page modules, or LinkedIn —
                  then edit for voice and compliance.
                </p>

                <div className="mt-4 space-y-5">
                  <RepurposeBlock
                    title="SEO blog post (shell)"
                    hint="Title, intent, H2 slots from draft, brief bullets, excerpt + checklist."
                    text={repurposeBlocks.seoBlogPost}
                  />
                  <RepurposeBlock
                    title="GEO FAQ section"
                    hint="Q/A frames from brief points and draft question lines; answers pull matching lines or a GEO placeholder."
                    text={repurposeBlocks.geoFaqSection}
                  />
                  <RepurposeBlock
                    title="LinkedIn — 3 variations"
                    hint="Short list, standard post, thread-style — same core signals, different shape."
                    text={formatLinkedInVariationsPlain(repurposeBlocks)}
                  />
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function RepurposeBlock({ title, hint, text }: { title: string; hint: string; text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>
        </div>
        <CopyReportButton text={text} label="Copy block" />
      </div>
      <pre className="max-h-[240px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

function WorkspaceDraftFields({ artifacts }: { artifacts: ContentDraftPipelinePageState["artifacts"] }) {
  return (
    <>
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Page / SEO draft
        <textarea
          name="seoBody"
          rows={18}
          defaultValue={artifacts.seoBody}
          placeholder="Write your page draft here (headings, body, FAQs). QA uses this field first."
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
      <details className="rounded-md border border-zinc-200 bg-zinc-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-900/30">
        <summary className="cursor-pointer text-xs font-medium text-zinc-800 dark:text-zinc-200">
          GEO &amp; LinkedIn drafts
        </summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            GEO notes
            <textarea
              name="geoNotes"
              rows={7}
              defaultValue={artifacts.geoNotes}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            LinkedIn repurposing
            <textarea
              name="linkedinPost"
              rows={7}
              defaultValue={artifacts.linkedinPost}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
        </div>
      </details>
    </>
  );
}

function DraftFields({ artifacts }: { artifacts: ContentDraftPipelinePageState["artifacts"] }) {
  return (
    <>
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        SEO / page draft
        <textarea
          name="seoBody"
          rows={12}
          defaultValue={artifacts.seoBody}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        GEO notes
        <textarea
          name="geoNotes"
          rows={8}
          defaultValue={artifacts.geoNotes}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        LinkedIn repurposing
        <textarea
          name="linkedinPost"
          rows={8}
          defaultValue={artifacts.linkedinPost}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
    </>
  );
}
