import Link from "next/link";

export default function SiteNotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Site not found</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        No site exists for this URL. The ID may be wrong, or the database this deployment uses does not contain
        that row.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <strong className="font-medium text-zinc-800 dark:text-zinc-200">On Vercel (or any serverless host):</strong>{" "}
        a local <span className="font-mono text-xs">file:</span> SQLite database is usually{" "}
        <strong className="font-medium text-zinc-800 dark:text-zinc-200">not shared</strong> between the server
        action that saved the site and the page that loads next. Use a hosted database (e.g. Turso, Neon, Vercel
        Postgres) and point <span className="font-mono text-xs">DATABASE_URL</span> at it.
      </p>
      <p className="mt-6">
        <Link href="/sites" className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100">
          Back to all sites
        </Link>
        {" · "}
        <Link href="/onboard" className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100">
          Onboard a site
        </Link>
      </p>
    </main>
  );
}
