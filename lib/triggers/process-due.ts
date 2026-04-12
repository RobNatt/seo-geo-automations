import { prisma } from "@/lib/db";

/**
 * For each enabled trigger with intervalMinutes set, if the interval has elapsed
 * since lastFiredAt, enqueue one audit task per active page and update lastFiredAt.
 */
export async function enqueueDueTriggerTasks(now = new Date()) {
  const triggers = await prisma.trigger.findMany({
    where: { enabled: true, intervalMinutes: { not: null } },
  });

  const pages = await prisma.page.findMany({ where: { status: "active" } });
  let created = 0;

  for (const t of triggers) {
    const mins = t.intervalMinutes;
    if (mins == null || mins <= 0) continue;

    const last = t.lastFiredAt;
    const due =
      !last || now.getTime() - last.getTime() >= mins * 60 * 1000;

    if (!due) continue;

    await prisma.$transaction(async (tx) => {
      for (const p of pages) {
        await tx.triggerTask.create({
          data: {
            triggerId: t.id,
            kind: "audit_page",
            pageId: p.id,
            title: `Audit page: ${p.url}`,
            status: "pending",
          },
        });
        created += 1;
      }
      await tx.trigger.update({
        where: { id: t.id },
        data: { lastFiredAt: now },
      });
    });
  }

  return { created };
}
