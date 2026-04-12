import { prisma } from "@/lib/db";
import { createPage } from "@/app/actions/catalog";

export const dynamic = "force-dynamic";

export default async function PagesCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;
  const [pages, services] = await Promise.all([
    prisma.page.findMany({
      orderBy: { createdAt: "desc" },
      include: { service: true },
    }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-xl font-semibold">Pages</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        URLs in scope for audits and trigger tasks.
      </p>

      {msg ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {msg}
        </p>
      ) : null}

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Add page</h2>
        <form action={createPage} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">URL</span>
            <input
              name="url"
              type="url"
              required
              placeholder="https://example.com/pricing"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Title (optional)</span>
            <input
              name="title"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Service (optional)</span>
            <select
              name="serviceId"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— None —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">All pages</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">URL</th>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pages.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-zinc-500">
                    No pages yet.
                  </td>
                </tr>
              ) : (
                pages.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-2">
                      <div className="max-w-xs truncate font-mono text-xs">{p.url}</div>
                      {p.title ? (
                        <div className="text-xs text-zinc-500">{p.title}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">{p.service?.name ?? "—"}</td>
                    <td className="px-4 py-2">{p.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
