"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isLaunchChecklistKey } from "@/lib/sites/launch-checklist";

export async function setLaunchCheckItemForm(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const doneRaw = String(formData.get("done") ?? "").trim();
  if (!siteId || !key || !isLaunchChecklistKey(key)) return;

  const done = doneRaw === "true";

  await prisma.siteLaunchCheckItem.updateMany({
    where: { siteId, key },
    data: { done },
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  redirect(`/sites/${siteId}`);
}
