import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientSiteReportView } from "@/components/ClientSiteReportView";
import { prisma } from "@/lib/db";
import { clientReportBrandName, resolveClientReportSiteId } from "@/lib/sites/client-report-access";
import { loadClientSiteReport } from "@/lib/sites/load-client-site-report";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const siteId = resolveClientReportSiteId(token);
  if (!siteId) {
    return { title: clientReportBrandName() };
  }
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { businessName: true },
  });
  return {
    title: site ? `${site.businessName} · Status` : clientReportBrandName(),
    description: "Launch readiness and program summary for your website.",
  };
}

export default async function ClientReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const siteId = resolveClientReportSiteId(token);
  if (!siteId) notFound();

  const data = await loadClientSiteReport(siteId);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10 dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none">
      <ClientSiteReportView data={data} />
    </div>
  );
}
