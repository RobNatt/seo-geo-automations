import { prisma } from "@/lib/db";
import {
  completeTaskForm,
  enqueueTriggerNowForm,
  processDueTriggersForm,
  runAuditTaskForm,
} from "@/app/actions/tasks";

export const dynamic = "force-dynamic";

export default async function TriggerTasksPage() {
  const [rawTasks, triggers] = await Promise.all([
    prisma.triggerTask.findMany({
      take: 80,
      orderBy: { createdAt: "desc" },
      include: { trigger: true, page: true },
    }),
    prisma.trigger.findMany({ orderBy: { name: "asc" } }),
  ]);

  const tasks = [...rawTasks].sort((a, b) => {
    const pri = (s: string) => (s === "pending" ? 0 : 1);
    const d = pri(a.status) - pri(b.status);
    if (d !== 0) return d;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-xl font-semibold">Trigger tasks</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Tasks are created when a scheduled trigger is due, or when you enqueue manually. Running a task performs the page audit.
      </p>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Triggers</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {triggers.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800"
            >
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-zinc-500">
                  {t.enabled ? "Enabled" : "Disabled"}
                  {t.intervalMinutes != null
                    ? ` · every ${t.intervalMinutes} min`
                    : " · no schedule (manual only)"}
                  {t.lastFiredAt ? ` · last fired ${t.lastFiredAt.toISOString()}` : ""}
                </div>
              </div>
              <form action={enqueueTriggerNowForm}>
                <input type="hidden" name="triggerId" value={t.id} />
                <button
                  type="submit"
                  disabled={!t.enabled}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-zinc-600"
                >
                  Enqueue audits now
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={processDueTriggersForm} className="mt-6">
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Run schedule check (enqueue due triggers)
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Task queue</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">Task</th>
                <th className="px-4 py-2 font-medium">Trigger</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-zinc-500">
                    No tasks yet. Enqueue from a trigger or wait for a scheduled run.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-2">
                      <div>{task.title}</div>
                      {task.page ? (
                        <div className="font-mono text-xs text-zinc-500">{task.page.url}</div>
                      ) : null}
                      <div className="text-xs text-zinc-400">{task.createdAt.toISOString()}</div>
                    </td>
                    <td className="px-4 py-2">{task.trigger.name}</td>
                    <td className="px-4 py-2">{task.status}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {task.status === "pending" && task.kind === "audit_page" && task.pageId ? (
                          <form action={runAuditTaskForm}>
                            <input type="hidden" name="taskId" value={task.id} />
                            <button
                              type="submit"
                              className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                            >
                              Run audit
                            </button>
                          </form>
                        ) : null}
                        {task.status === "pending" ? (
                          <form action={completeTaskForm}>
                            <input type="hidden" name="taskId" value={task.id} />
                            <button
                              type="submit"
                              className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                            >
                              Mark done
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
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
