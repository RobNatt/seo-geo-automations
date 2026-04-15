import { prisma } from "@/lib/db";

export const PARTNERSHIP_STATUS = ["not_started", "in_progress", "done"] as const;
export type PartnershipStatus = (typeof PARTNERSHIP_STATUS)[number];

export const PARTNERSHIP_CHECKLIST = [
  {
    key: "directory_listings",
    type: "directory",
    partnerName: "Clutch + GoodFirms + core directories",
    label: "Directory listings completeness",
    defaultNextAction: "Audit profile completeness and update descriptions, categories, links, and proof points.",
  },
  {
    key: "referral_relationships",
    type: "referral",
    partnerName: "Referral partners",
    label: "Referral partner relationships",
    defaultNextAction: "Identify top 3 referral partners and send a co-referral outline with ideal client profile.",
  },
  {
    key: "podcast_guest_bylines",
    type: "podcast",
    partnerName: "Podcast + guest byline targets",
    label: "Podcast / guest byline opportunities",
    defaultNextAction: "Shortlist 5 relevant shows/publications and draft one pitch template with proof links.",
  },
  {
    key: "client_co_marketing",
    type: "co_marketing",
    partnerName: "Client case-study co-marketing",
    label: "Client co-marketing (case studies)",
    defaultNextAction: "Select 1 client win and propose a joint case-study timeline, owner, and publish channel.",
  },
  {
    key: "chamber_network",
    type: "chamber",
    partnerName: "Local chamber / business networks",
    label: "Local chamber / network status",
    defaultNextAction: "Confirm active memberships and schedule one networking event or speaking application.",
  },
] as const;

export async function ensurePartnershipChecklistForSite(siteId: string) {
  const existing = await prisma.partnership.findMany({
    where: { siteId },
    select: { type: true, partnerName: true },
  });
  const have = new Set(existing.map((e) => `${e.type}::${e.partnerName}`));
  const missing = PARTNERSHIP_CHECKLIST.filter((row) => !have.has(`${row.type}::${row.partnerName}`));
  if (missing.length === 0) return;

  await prisma.partnership.createMany({
    data: missing.map((row) => ({
      siteId,
      type: row.type,
      partnerName: row.partnerName,
      status: "not_started",
      nextAction: row.defaultNextAction,
      notes: "",
    })),
  });
}
