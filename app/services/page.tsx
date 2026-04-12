import { prisma } from "@/lib/db";
import { createService } from "@/app/actions/catalog";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;
  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { pages: true } } },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-xl font-semibold">Services</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Group pages by product or service line.
      </p>

      {msg ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {msg}
        </p>
      ) : null}

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Add service</h2>
        <form action={createService} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Name</span>
            <input
              name="name"
              required
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Slug (optional)</span>
            <input
              name="slug"
              placeholder="auto from name"
              className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">All services</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Pages</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-zinc-500">
                    No services yet.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {s.slug}
                    </td>
                    <td className="px-4 py-2">{s._count.pages}</td>
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
