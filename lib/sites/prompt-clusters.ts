import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

/** Trim, drop empties, dedupe by first occurrence (stable order). */
export function normalizePromptStrings(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const t = s.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Read stored JSON as non-empty prompt strings; invalid entries skipped. */
export function parseClusterPrompts(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const x of value) {
    if (typeof x === "string") {
      const t = x.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

export function promptsToStoredJson(prompts: string[]): Prisma.InputJsonValue {
  return normalizePromptStrings(prompts);
}

export type PromptClusterPlannerRow = {
  clusterKey: string;
  clusterTitle: string;
  prompts: string[];
  targetPages: { id: string; url: string; title: string | null }[];
};

const pageSelect = { id: true, url: true, title: true } as const;

export async function listPromptClustersForSite(siteId: string) {
  return prisma.promptCluster.findMany({
    where: { siteId },
    orderBy: [{ key: "asc" }],
    include: { pages: { select: pageSelect } },
  });
}

/** Shape for content opportunity planner UIs (deterministic sort: cluster key, then page url). */
export async function listPromptClusterPlannerRows(siteId: string): Promise<PromptClusterPlannerRow[]> {
  const rows = await listPromptClustersForSite(siteId);
  return rows.map((c) => {
    const pages = [...c.pages].sort((a, b) => a.url.localeCompare(b.url));
    return {
      clusterKey: c.key,
      clusterTitle: c.title,
      prompts: parseClusterPrompts(c.prompts),
      targetPages: pages.map((p) => ({ id: p.id, url: p.url, title: p.title })),
    };
  });
}

export type UpsertPromptClusterInput = {
  siteId: string;
  key: string;
  title: string;
  prompts: string[];
  targetPageIds: string[];
};

/**
 * Idempotent upsert by (siteId, key). Only pages that belong to the site are linked.
 * Target page order is normalized to ascending url for stable relation writes.
 */
export async function upsertPromptClusterForSite(input: UpsertPromptClusterInput) {
  const key = input.key.trim();
  const title = input.title.trim();
  if (!key) throw new Error("PromptCluster key is required");

  const promptsJson = promptsToStoredJson(input.prompts);

  const pages = await prisma.page.findMany({
    where: { siteId: input.siteId, id: { in: input.targetPageIds } },
    select: { id: true, url: true },
    orderBy: { url: "asc" },
  });
  const connectIds = pages.map((p) => p.id);

  return prisma.promptCluster.upsert({
    where: { siteId_key: { siteId: input.siteId, key } },
    create: {
      siteId: input.siteId,
      key,
      title: title || key,
      prompts: promptsJson,
      pages: { connect: connectIds.map((id) => ({ id })) },
    },
    update: {
      title: title || key,
      prompts: promptsJson,
      pages: { set: connectIds.map((id) => ({ id })) },
    },
    include: { pages: { select: pageSelect } },
  });
}

export async function deletePromptClusterForSite(siteId: string, key: string) {
  const k = key.trim();
  if (!k) return 0;
  const r = await prisma.promptCluster.deleteMany({ where: { siteId, key: k } });
  return r.count;
}
