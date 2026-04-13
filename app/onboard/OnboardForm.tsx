"use client";

import { submitOnboarding } from "@/app/actions/onboard";

/**
 * Client form so GET /onboard does not import the server action module (and Prisma) in the RSC graph.
 * The action still runs only on the server when submitted.
 */
export function OnboardForm() {
  return (
    <form
      action={submitOnboarding}
      className="mt-8 space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
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
  );
}
