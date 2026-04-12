import type { LaunchBlocker } from "@/lib/sites/launch-blockers";

export type LaunchReportPlainTextInput = {
  generatedAtIso: string;
  businessName: string;
  rootUrl: string;
  homepageUrl: string | null;
  readinessLabel: string;
  readinessNextStep: string;
  launchBlockers: LaunchBlocker[];
  latestAudit: {
    status: string;
    startedAtIso: string;
    summaryLine: string;
  } | null;
  checklistItems: { label: string; done: boolean }[];
  openFixes: { bucket: string; priorityScore: number; title: string; detail: string | null }[];
  /** Optional block from buildContentGapsPlainTextSection (content-gap-rank). */
  contentGapsPlainTextSection?: string;
  /** Optional block from buildContentRefreshPlainTextSection (content-refresh-rank). */
  contentRefreshPlainTextSection?: string;
};

/** Plain-text report for clipboard / email / chat. */
export function buildLaunchReportPlainText(input: LaunchReportPlainTextInput): string {
  const lines: string[] = [];
  lines.push("LAUNCH REPORT");
  lines.push("=============");
  lines.push(`Site: ${input.businessName}`);
  lines.push(`URL: ${input.rootUrl}`);
  if (input.homepageUrl) lines.push(`Homepage audited: ${input.homepageUrl}`);
  lines.push(`Generated: ${input.generatedAtIso}`);
  lines.push("");
  lines.push("READINESS");
  lines.push("---------");
  lines.push(`State: ${input.readinessLabel}`);
  lines.push(`Next step: ${input.readinessNextStep}`);
  lines.push("");
  lines.push("LAUNCH BLOCKERS");
  lines.push("--------------");
  if (input.launchBlockers.length === 0) {
    lines.push("None.");
  } else {
    for (const b of input.launchBlockers) {
      lines.push(`• ${b.title}${b.detail ? ` — ${b.detail}` : ""}`);
    }
  }
  lines.push("");
  lines.push("LATEST AUDIT (HOMEPAGE)");
  lines.push("-----------------------");
  if (input.latestAudit) {
    lines.push(`Status: ${input.latestAudit.status}`);
    lines.push(`Started: ${input.latestAudit.startedAtIso}`);
    lines.push(`Summary: ${input.latestAudit.summaryLine}`);
  } else {
    lines.push("No audit run yet.");
  }
  lines.push("");
  const done = input.checklistItems.filter((i) => i.done).length;
  const total = input.checklistItems.length;
  lines.push(`LAUNCH CHECKLIST (${done}/${total})`);
  lines.push("------------------");
  for (const item of input.checklistItems) {
    lines.push(`${item.done ? "[x]" : "[ ]"} ${item.label}`);
  }
  lines.push("");
  lines.push(`OPEN FIX TASKS (${input.openFixes.length})`);
  lines.push("----------------");
  if (input.openFixes.length === 0) {
    lines.push("None.");
  } else {
    let n = 1;
    for (const t of input.openFixes) {
      lines.push(`${n}. [${t.bucket}] ${t.title} (priority ${t.priorityScore})`);
      if (t.detail?.trim()) {
        lines.push(`   ${t.detail.trim().replace(/\s+/g, " ")}`);
      }
      n += 1;
    }
  }
  lines.push("");
  if (input.contentGapsPlainTextSection?.trim()) {
    lines.push(input.contentGapsPlainTextSection.trim());
    lines.push("");
  }
  if (input.contentRefreshPlainTextSection?.trim()) {
    lines.push(input.contentRefreshPlainTextSection.trim());
    lines.push("");
  }
  lines.push("— End of report —");
  return lines.join("\n");
}
