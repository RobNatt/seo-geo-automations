"use client";

import { useState } from "react";
import {
  REPORT_TEMPLATE_IDS,
  REPORT_TEMPLATE_LABEL,
  type ReportTemplateId,
} from "@/lib/sites/report-templates/constants";
import { CopyReportButton } from "@/components/CopyReportButton";

export function ReportTemplatesExportSection({
  texts,
}: {
  texts: Record<ReportTemplateId, string>;
}) {
  const [active, setActive] = useState<ReportTemplateId>("monthly_seo");

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Report templates
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Same underlying data, different emphasis — deterministic plain text for clients. Copy or print / Save as PDF.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REPORT_TEMPLATE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={
              active === id ?
                "rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            }
          >
            {REPORT_TEMPLATE_LABEL[id]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyReportButton text={texts[active]} label={`Copy ${REPORT_TEMPLATE_LABEL[active]}`} />
      </div>
      <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
        {texts[active]}
      </pre>
    </section>
  );
}
