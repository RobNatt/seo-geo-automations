"use client";

import { useState } from "react";

/**
 * Two-step onboarding clarification:
 * 1) URL + business identity
 * 2) Brief fields used by deterministic metadata/keyword engines
 */
export function OnboardForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [businessName, setBusinessName] = useState("");
  const [rootUrl, setRootUrl] = useState("");

  const canContinue = businessName.trim().length > 0 && rootUrl.trim().length > 0;

  return (
    <form
      action="/api/onboard"
      method="post"
      className="mt-8 space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {step === 1 ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 1 of 2 · Site URL</p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Business / site name</span>
            <input
              name="businessName"
              required
              autoComplete="organization"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Site URL (homepage)</span>
            <input
              name="rootUrl"
              type="text"
              required
              value={rootUrl}
              onChange={(e) => setRootUrl(e.target.value)}
              placeholder="example.com or https://example.com"
              className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!canContinue}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Continue to brief
          </button>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 2 of 2 · Brief</p>
          <p className="text-xs text-zinc-500">
            This brief powers deterministic keyword/title suggestions after onboarding. Nothing is auto-applied.
          </p>

          <input type="hidden" name="businessName" value={businessName} />
          <input type="hidden" name="rootUrl" value={rootUrl} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Primary services (comma or new-line separated)</span>
            <textarea
              name="primaryServices"
              required
              rows={3}
              placeholder="web design, SEO, GEO"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Target audience</span>
            <input
              name="targetAudience"
              required
              placeholder="small businesses, agencies, growth teams"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Market focus</span>
            <select
              name="marketFocus"
              required
              defaultValue="local"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="local">Local</option>
              <option value="regional">Regional</option>
              <option value="national">National</option>
              <option value="dual">Dual (local + national)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Service area (comma or new-line separated)</span>
            <textarea
              name="serviceArea"
              required
              rows={2}
              placeholder="Omaha, Nebraska metro"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Primary conversion goal</span>
            <input
              name="primaryConversionGoal"
              required
              placeholder="booked calls, lead forms, demos"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Brand tone</span>
            <select
              name="brandTone"
              required
              defaultValue="outcome-led"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="technical">Technical</option>
              <option value="outcome-led">Outcome-led</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Optional priority keyword</span>
            <input
              name="optionalPriorityKeyword"
              placeholder="optional seed keyword"
              className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Legacy GEO hint (optional)</span>
            <input
              name="geoHint"
              placeholder="City, region, or service area"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Legacy primary focus (optional)</span>
            <input
              name="primaryFocus"
              placeholder="Creates or reuses a Service and links the homepage"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
            >
              Back
            </button>
            <button
              type="submit"
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save site &amp; run audit
            </button>
          </div>
        </>
      )}
    </form>
  );
}
