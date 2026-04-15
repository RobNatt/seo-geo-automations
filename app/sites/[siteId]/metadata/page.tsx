import Link from "next/link";
import { notFound } from "next/navigation";
import {
  applyPageMetadataForm,
  pageLooksLikeHomepage,
  updateSiteSeoBriefForm,
} from "@/app/actions/seo-metadata";
import { prisma } from "@/lib/db";
import {
  buildMetadataSuggestions,
  mergePrimaryServiceNames,
  parseMarketFocus,
  parsePageType,
  PAGE_TYPES,
} from "@/lib/seo/metadata-suggestions";

export const dynamic = "force-dynamic";

export default async function SiteMetadataPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{
    msg?: string;
    pageId?: string;
    pageType?: string;
    blogTopic?: string;
    location?: string;
  }>;
}) {
  const { siteId } = await params;
  const sp = await searchParams;
  const msg = sp.msg?.trim();

  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });
  if (!site) notFound();

  const [pages, pagesForNames] = await Promise.all([
    prisma.page.findMany({
      where: { siteId },
      orderBy: { createdAt: "asc" },
      include: { service: true },
    }),
    prisma.page.findMany({
      where: { siteId },
      select: { service: { select: { name: true } } },
    }),
  ]);

  const catalogNames = pagesForNames
    .map((p) => p.service?.name)
    .filter((n): n is string => Boolean(n));

  const brief = {
    businessName: site.businessName,
    primaryServices: mergePrimaryServiceNames(site.primaryFocus, catalogNames),
    targetAudience: site.targetAudience ?? "",
    marketFocus: parseMarketFocus(site.marketFocus),
    serviceAreaOrLocation: site.geoHint ?? "",
    primaryConversionGoal: site.primaryConversionGoal ?? "",
    priorityKeyword: site.priorityKeyword ?? undefined,
  };

  const previewPageId = sp.pageId?.trim() ?? "";
  const previewPageType = parsePageType(sp.pageType);
  const blogTopicHint = sp.blogTopic?.trim() || undefined;
  const locationOverride = sp.location?.trim() || undefined;

  const previewPage = previewPageId
    ? pages.find((p) => p.id === previewPageId) ?? null
    : null;

  const suggestions =
    previewPage && previewPageType
      ? buildMetadataSuggestions(brief, {
          pageType: previewPageType,
          linkedServiceName: previewPage.service?.name ?? null,
          blogTopicHint,
          locationOverride,
        })
      : null;

  const homepageHint =
    previewPage && site.rootUrl
      ? pageLooksLikeHomepage(site.rootUrl, previewPage.url)
      : false;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-zinc-500">
        <Link href={`/sites/${siteId}`} className="text-zinc-700 underline dark:text-zinc-300">
          ← Back to site
        </Link>
      </p>
      <h1 className="mt-4 text-xl font-semibold">Metadata &amp; keyword suggestions</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Rule-based copy from your onboarding brief and page type. URLs are not used as the primary signal. Nothing
        is written to the database until you confirm below.
      </p>

      {msg ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {msg}
        </p>
      ) : null}

      <section className="mt-10 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Business brief (source of truth)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Filled at onboarding or here. Drives titles, meta descriptions, and keyword strategy.
        </p>
        <form action={updateSiteSeoBriefForm} className="mt-4 space-y-4">
          <input type="hidden" name="siteId" value={siteId} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Target audience</span>
            <input
              name="targetAudience"
              defaultValue={site.targetAudience ?? ""}
              placeholder="Who you serve"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Market focus</span>
            <select
              name="marketFocus"
              defaultValue={site.marketFocus ?? ""}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— Select —</option>
              <option value="local">Local</option>
              <option value="regional">Regional</option>
              <option value="national">National</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Service area / location</span>
            <input
              name="geoHint"
              defaultValue={site.geoHint ?? ""}
              placeholder="City, region, or service area"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Primary conversion goal</span>
            <input
              name="primaryConversionGoal"
              defaultValue={site.primaryConversionGoal ?? ""}
              placeholder="e.g. calls, form leads, bookings"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Priority keyword (optional)</span>
            <input
              name="priorityKeyword"
              defaultValue={site.priorityKeyword ?? ""}
              className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save brief
          </button>
        </form>
      </section>

      <section className="mt-10 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Preview suggestions</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Pick a page and page type. Optional hints refine blog and location templates. Then preview; apply is a
          separate step.
        </p>

        <form method="get" className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Page</span>
            <select
              name="pageId"
              required
              defaultValue={previewPageId}
              className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— Choose —</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.url}
                  {p.service ? ` · ${p.service.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Page type (strategy)</span>
            <select
              name="pageType"
              required
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
            <span className="text-zinc-600 dark:text-zinc-400">Blog / support topic hint (optional)</span>
            <input
              name="blogTopic"
              defaultValue={sp.blogTopic ?? ""}
              placeholder="e.g. How to winterize outdoor lines"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Location override (optional)</span>
            <input
              name="location"
              defaultValue={sp.location ?? ""}
              placeholder="Overrides GEO hint for location pages only"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-900"
          >
            Preview suggestions
          </button>
        </form>

        {homepageHint && previewPageType && previewPageType !== "homepage" ? (
          <p className="mt-4 text-xs text-amber-800 dark:text-amber-200">
            Note: This URL matches the site homepage, but the selected page type is not “homepage”. Strategy follows
            your selection, not the URL alone.
          </p>
        ) : null}

        {suggestions && previewPage && previewPageType ? (
          <div className="mt-8 space-y-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Confidence</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{suggestions.confidenceNote}</p>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Suggested title</p>
              <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{suggestions.suggestedTitle}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {suggestions.titleReasoning}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Suggested meta description</p>
              <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{suggestions.suggestedMetaDescription}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {suggestions.metaReasoning}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Keyword options (ranked)</p>
              <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                {suggestions.keywords.map((k) => (
                  <li key={k.phrase}>
                    <span className="font-medium">{k.phrase}</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      relevance {k.relevanceScore} · opportunity {k.opportunityScore} · intent {k.intent} · rank{" "}
                      {k.rankScore}
                    </span>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{k.reasoning}</p>
                  </li>
                ))}
              </ol>
            </div>

            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
              {suggestions.confirmPrompt}
            </p>

            <form action={applyPageMetadataForm} className="space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <input type="hidden" name="siteId" value={siteId} />
              <input type="hidden" name="pageId" value={previewPage.id} />
              <input type="hidden" name="pageType" value={previewPageType} />
              {blogTopicHint ? <input type="hidden" name="blogTopicHint" value={blogTopicHint} /> : null}
              {locationOverride ? <input type="hidden" name="locationOverride" value={locationOverride} /> : null}
              <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <input type="checkbox" name="confirmed" value="1" className="mt-1" />
                <span>
                  I reviewed the suggested title and meta description and want to save them to this page (keywords are
                  suggestions only and are not stored automatically).
                </span>
              </label>
              <button
                type="submit"
                className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Apply title, meta description &amp; page type
              </button>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
}
