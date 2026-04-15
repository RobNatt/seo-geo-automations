import Link from "next/link";
import { notFound } from "next/navigation";
import {
  applyPageMetadataForm,
  previewSiteSuggestionsForm,
  updateSiteSeoBriefForm,
  loadPreviewSuggestions,
} from "@/app/actions/seo-metadata";
import { PAGE_TYPES, type PageType } from "@/lib/metadata";
import { buildSiteBriefFromSite } from "@/lib/site-brief";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SiteMetadataPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ msg?: string; pageId?: string; pageType?: string; topicHint?: string }>;
}) {
  const { siteId } = await params;
  const sp = await searchParams;
  const msg = sp.msg?.trim();

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) notFound();

  const brief = buildSiteBriefFromSite(site);
  const pages = await prisma.page.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
    include: { service: true },
  });

  const pageType = PAGE_TYPES.includes((sp.pageType ?? "") as PageType) ? (sp.pageType as PageType) : null;
  const preview =
    sp.pageId && pageType
      ? await loadPreviewSuggestions({
          siteId,
          pageId: sp.pageId,
          pageType,
          topicHint: sp.topicHint?.trim() || undefined,
        })
      : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-zinc-500">
        <Link href={`/sites/${siteId}`} className="text-zinc-700 underline dark:text-zinc-300">
          ← Back to site
        </Link>
      </p>
      <h1 className="mt-4 text-xl font-semibold">Metadata and keyword suggestions</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Deterministic suggestions from your onboarding brief, page type, and market focus. Nothing auto-applies.
      </p>

      {msg ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {msg}
        </p>
      ) : null}

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Site brief</h2>
        <form action={updateSiteSeoBriefForm} className="mt-4 space-y-3">
          <input type="hidden" name="siteId" value={siteId} />
          <label className="flex flex-col gap-1 text-sm">
            <span>Primary services (comma/new-line)</span>
            <textarea
              name="primaryServices"
              rows={2}
              defaultValue={brief.primaryServices.join(", ")}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Target audience</span>
            <input
              name="targetAudience"
              defaultValue={brief.targetAudience}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Market focus</span>
            <select
              name="marketFocus"
              defaultValue={brief.marketFocus}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="local">local</option>
              <option value="regional">regional</option>
              <option value="national">national</option>
              <option value="dual">dual</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Service area (comma/new-line)</span>
            <textarea
              name="serviceArea"
              rows={2}
              defaultValue={brief.serviceArea.join(", ")}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Primary conversion goal</span>
            <input
              name="primaryConversionGoal"
              defaultValue={brief.primaryConversionGoal}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Brand tone</span>
            <select
              name="brandTone"
              defaultValue={brief.brandTone}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="professional">professional</option>
              <option value="friendly">friendly</option>
              <option value="technical">technical</option>
              <option value="outcome-led">outcome-led</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Optional priority keyword</span>
            <input
              name="optionalPriorityKeyword"
              defaultValue={brief.optionalPriorityKeyword ?? ""}
              className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Legacy GEO hint (optional)</span>
            <input
              name="geoHint"
              defaultValue={site.geoHint ?? ""}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <button className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Save brief
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Preview and confirm</h2>
        <form action={previewSiteSuggestionsForm} className="mt-4 space-y-3">
          <input type="hidden" name="siteId" value={siteId} />
          <label className="flex flex-col gap-1 text-sm">
            <span>Page</span>
            <select
              name="pageId"
              defaultValue={sp.pageId ?? ""}
              className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— Choose —</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.url}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Page type</span>
            <select
              name="pageType"
              defaultValue={sp.pageType ?? ""}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— Choose —</option>
              {PAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Topic hint (for blog pages)</span>
            <input
              name="topicHint"
              defaultValue={sp.topicHint ?? ""}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <button className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600">
            Generate suggestions
          </button>
        </form>

        {preview ? (
          <div className="mt-6 space-y-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">{preview.brief.geoAreaNoteVisible || site.geoAreaNoteVisible}</p>

            <div>
              <h3 className="text-sm font-medium">Metadata options (choose one)</h3>
              <form action={applyPageMetadataForm} className="mt-3 space-y-4">
                <input type="hidden" name="siteId" value={siteId} />
                <input type="hidden" name="pageId" value={preview.page.id} />
                <input type="hidden" name="pageType" value={pageType ?? ""} />
                {sp.topicHint ? <input type="hidden" name="topicHint" value={sp.topicHint} /> : null}

                {preview.metadataOptions.map((opt, idx) => (
                  <label key={`${opt.title}-${idx}`} className="block rounded border border-zinc-200 p-3 dark:border-zinc-700">
                    <div className="flex items-start gap-2">
                      <input type="radio" name="selectedOption" value={String(idx)} defaultChecked={idx === 0} />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{opt.title}</p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">{opt.metaDescription}</p>
                        <p className="text-xs text-zinc-500">{opt.reasoning}</p>
                        <p className="text-xs text-zinc-500">{opt.fitNote}</p>
                      </div>
                    </div>
                  </label>
                ))}

                <div>
                  <p className="text-sm font-medium">Keyword options (ranked)</p>
                  <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                    {preview.keywordOptions.map((k) => (
                      <li key={k.keyword}>
                        <p className="font-medium">{k.keyword}</p>
                        <p className="text-xs text-zinc-500">
                          relevance {k.relevanceScore} · opportunity {k.opportunityScore} · intent {k.intentScore} ·
                          weighted {k.weightedScore}
                        </p>
                        <p className="text-xs text-zinc-500">{k.reasoning}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="confirmed" value="1" className="mt-1" />
                  <span>I confirm this metadata option should be applied to the page. (Keywords are suggestions only.)</span>
                </label>
                <button className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                  Apply selected option
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
