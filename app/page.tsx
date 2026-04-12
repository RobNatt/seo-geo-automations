import Link from "next/link";

const cards = [
  {
    href: "/onboard",
    title: "New site onboarding",
    body: "Register a site, capture business context, run the first audit.",
  },
  {
    href: "/sites",
    title: "Sites",
    body: "All onboarded sites, stages, and latest homepage audit state.",
  },
  {
    href: "/services",
    title: "Services",
    body: "Define service lines and attach pages.",
  },
  {
    href: "/pages",
    title: "Pages",
    body: "Catalog URLs for audits and triggers.",
  },
  {
    href: "/audits",
    title: "Audit dashboard",
    body: "Recent runs and check outcomes.",
  },
  {
    href: "/tasks",
    title: "Trigger tasks",
    body: "Work queued by schedules; run audits from the queue.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Milestone build: page and service catalog, audit dashboard, and trigger-based task queue.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="block rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{c.title}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{c.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
