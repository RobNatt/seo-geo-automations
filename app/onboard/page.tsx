import { firstQueryString, messageForOnboardErrCode } from "@/lib/onboard-error-codes";
import { OnboardForm } from "./OnboardForm";

export const dynamic = "force-dynamic";

/** Allows onboarding + audit server action to finish on Vercel Pro (Hobby remains ~10s cap). */
export const maxDuration = 60;

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string | string[]; err?: string | string[] }>;
}) {
  const sp = await searchParams;
  const queryMsg = firstQueryString(sp.msg);
  const err = firstQueryString(sp.err);
  const errMsg = messageForOnboardErrCode(err);
  const msg = queryMsg ?? errMsg;

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

      <OnboardForm />
    </main>
  );
}
