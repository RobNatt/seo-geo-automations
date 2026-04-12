import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/onboard", label: "New site" },
  { href: "/sites", label: "Sites" },
  { href: "/services", label: "Services" },
  { href: "/pages", label: "Pages" },
  { href: "/audits", label: "Audits" },
  { href: "/tasks", label: "Trigger tasks" },
] as const;

export function AppNav() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
          SEO / GEO Ops
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          {links.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
