import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientPortalHubView } from "@/components/ClientPortalHubView";
import { portalOfferingTagline, portalProductName, resolvePortalSiteId } from "@/lib/product-portal";
import { prisma } from "@/lib/db";
import { loadClientSiteReport } from "@/lib/sites/load-client-site-report";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const siteId = resolvePortalSiteId(token);
  const product = portalProductName();
  if (!siteId) {
    return { title: product };
  }
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { businessName: true },
  });
  return {
    title: site ? `${site.businessName} · ${product}` : product,
    description: "Program hub: status, report, and next steps.",
  };
}

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const siteId = resolvePortalSiteId(token);
  if (!siteId) notFound();

  const data = await loadClientSiteReport(siteId);
  if (!data) notFound();

  const tagline = portalOfferingTagline();

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10 dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none">
      <ClientPortalHubView token={token} data={data} tagline={tagline} />
    </div>
  );
}
