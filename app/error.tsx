"use client";

/**
 * Catches render errors in route segments below the root layout.
 * Production builds hide the real message in the client bundle — use the digest in Vercel Function logs.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Something went wrong</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        This error was caught by the app error boundary. On Vercel, open this deployment →{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Logs</span> (or Runtime Logs) and search
        for the timestamp or digest below — the server log line usually has the real exception.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          Digest: {error.digest}
        </p>
      ) : null}
      {process.env.NODE_ENV === "development" ? (
        <pre className="mt-4 max-h-48 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900">
          {error.message}
        </pre>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
      >
        Try again
      </button>
    </main>
  );
}
