/**
 * POST to a Route Handler instead of a Server Action so GET /onboard never triggers Next.js
 * server-action cookie setup during RSC (which throws: cookies only modifiable in actions / route handlers).
 */
export function OnboardForm() {
  return (
    <form
      action="/api/onboard"
      method="post"
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
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">Target audience (optional)</span>
        <input
          name="targetAudience"
          placeholder="e.g. homeowners, SMB operators, local families"
          className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">Market focus (optional)</span>
        <select
          name="marketFocus"
          className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">— Select —</option>
          <option value="local">Local</option>
          <option value="regional">Regional</option>
          <option value="national">National</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">Primary conversion goal (optional)</span>
        <input
          name="primaryConversionGoal"
          placeholder="e.g. phone calls, form leads, bookings, online orders"
          className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">Priority keyword (optional)</span>
        <input
          name="priorityKeyword"
          placeholder="Seed keyword — suggestions only; never auto-applied without confirmation"
          className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
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
