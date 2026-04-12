"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

function isValidHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function slugify(input: string) {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "service";
}

export async function createService(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  let slug = String(formData.get("slug") ?? "").trim();
  if (!name) redirect("/services?msg=" + encodeURIComponent("Name is required."));
  if (!slug) slug = slugify(name);

  try {
    await prisma.service.create({ data: { name, slug } });
  } catch {
    redirect("/services?msg=" + encodeURIComponent("Could not create service (duplicate slug?)."));
  }
  revalidatePath("/services");
  revalidatePath("/pages");
  redirect("/services");
}

export async function createPage(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const serviceId = String(formData.get("serviceId") ?? "").trim();

  if (!url) redirect("/pages?msg=" + encodeURIComponent("URL is required."));
  if (!isValidHttpUrl(url)) redirect("/pages?msg=" + encodeURIComponent("URL must be http(s)."));

  try {
    await prisma.page.create({
      data: {
        url,
        title: title || null,
        serviceId: serviceId || null,
      },
    });
  } catch {
    redirect("/pages?msg=" + encodeURIComponent("Could not create page (duplicate URL?)."));
  }
  revalidatePath("/pages");
  revalidatePath("/audits");
  redirect("/pages");
}
