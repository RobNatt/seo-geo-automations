import { submitOnboarding } from "@/app/actions/onboard";

export const dynamic = "force-dynamic";

/** Allows onboarding + audit server action to finish on Vercel Pro (Hobby remains ~10s cap). */
export const maxDuration = 60;

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">New site onboarding</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Register a homepage, store business context, and run the initial technical audit.
      </p>

      {msg ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {msg}
        </p>
      ) : null}

      <form action={submitOnboarding} className="mt-8 space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Business / site name</span>
          <input
            name="businessName"
            required
            autoComplete="organization"
            className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Site URL (homepage)</span>
          <input
            name="rootUrl"
            type="text"
            required
            placeholder="example.com or https://example.com"
            className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">GEO hint (optional)</span>
          <input
            name="geoHint"
            placeholder="City, region, or service area"
            className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Primary focus / service line (optional)</span>
          <input
            name="primaryFocus"
            placeholder="Creates or reuses a Service and links the homepage"
            className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save site &amp; run audit
        </button>
      </form>
    </main>
  );
}
