import { notFound } from "next/navigation";

import { ContentDraftPipelineView } from "@/components/ContentDraftPipelineView";
import { loadContentDraftPipelinePageState } from "@/lib/sites/load-content-draft-pipeline";

export const dynamic = "force-dynamic";

export default async function ContentDraftPipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; queueItemId: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { siteId, queueItemId } = await params;
  const { msg } = await searchParams;

  const data = await loadContentDraftPipelinePageState(siteId, queueItemId);
  if (!data) notFound();

  return <ContentDraftPipelineView data={data} message={msg} />;
}
