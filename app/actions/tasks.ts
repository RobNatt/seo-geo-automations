"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runPageAudit } from "@/lib/audits/run-page-audit";
import { enqueueDueTriggerTasks } from "@/lib/triggers/process-due";

export async function processDueTriggers() {
  await enqueueDueTriggerTasks();
  revalidatePath("/tasks");
  revalidatePath("/audits");
}

export async function enqueueTriggerNow(triggerId: string) {
  const trigger = await prisma.trigger.findUnique({ where: { id: triggerId } });
  if (!trigger?.enabled) return;

  const pages = await prisma.page.findMany({ where: { status: "active" } });
  await prisma.$transaction(async (tx) => {
    for (const p of pages) {
      await tx.triggerTask.create({
        data: {
          triggerId: trigger.id,
          kind: "audit_page",
          pageId: p.id,
          title: `Audit page: ${p.url}`,
          status: "pending",
        },
      });
    }
    await tx.trigger.update({
      where: { id: trigger.id },
      data: { lastFiredAt: new Date() },
    });
  });
  revalidatePath("/tasks");
  revalidatePath("/audits");
}

export async function completeTask(taskId: string) {
  await prisma.triggerTask.update({
    where: { id: taskId },
    data: { status: "completed", completedAt: new Date() },
  });
  revalidatePath("/tasks");
}

export async function runAuditTask(taskId: string) {
  const task = await prisma.triggerTask.findUnique({ where: { id: taskId } });
  if (!task || task.status !== "pending") return;
  if (task.kind === "audit_page" && task.pageId) {
    await runPageAudit(task.pageId);
    await prisma.triggerTask.update({
      where: { id: taskId },
      data: { status: "completed", completedAt: new Date() },
    });
  }
  revalidatePath("/tasks");
  revalidatePath("/audits");
}

export async function processDueTriggersForm() {
  await processDueTriggers();
}

export async function enqueueTriggerNowForm(formData: FormData) {
  const id = String(formData.get("triggerId") ?? "");
  if (id) await enqueueTriggerNow(id);
}

export async function runAuditTaskForm(formData: FormData) {
  const id = String(formData.get("taskId") ?? "");
  if (id) await runAuditTask(id);
}

export async function completeTaskForm(formData: FormData) {
  const id = String(formData.get("taskId") ?? "");
  if (id) await completeTask(id);
}
