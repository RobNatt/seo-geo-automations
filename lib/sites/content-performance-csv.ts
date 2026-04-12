/**
 * Parse manual CSV/TSV rows for content performance import (deterministic).
 * Header row required. Columns (case-insensitive):
 * url, period_start, period_end, impressions, clicks [, engaged_sessions] [, conversions] [, opportunity_key] [, cluster_key]
 */

import { normalizeUrlKey, resolvePerformanceUrl } from "@/lib/sites/content-performance-url";

export type PageUrlLookup = Map<string, { id: string; url: string }>;

export type ParsedPerformanceRow = {
  pageId: string;
  resolvedUrl: string;
  periodStart: Date;
  periodEnd: Date;
  impressions: number | null;
  clicks: number | null;
  engagedSessions: number | null;
  conversions: number | null;
  opportunityKey: string | null;
  clusterKey: string | null;
  lineNumber: number;
};

export type CsvParseOutcome = {
  rows: ParsedPerformanceRow[];
  fatalErrors: string[];
  rowErrors: string[];
};

function parseIsoDateUtc(s: string): Date | null {
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

function parseIntNullable(s: string): number | null {
  const t = s.trim();
  if (t === "" || t.toLowerCase() === "null") return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function splitLine(line: string): string[] {
  const t = line.trim();
  if (t.includes("\t")) {
    return t.split("\t").map((c) => c.trim());
  }
  return t.split(",").map((c) => c.trim());
}

export function parseContentPerformanceCsv(
  siteRoot: string,
  body: string,
  pageLookup: PageUrlLookup,
): CsvParseOutcome {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return {
      rows: [],
      fatalErrors: ["Need a header row and at least one data row."],
      rowErrors: [],
    };
  }

  const headerCells = splitLine(lines[0]!).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = (name: string): number => headerCells.indexOf(name);

  const iUrl = idx("url");
  const iStart = idx("period_start");
  const iEnd = idx("period_end");
  const iImp = idx("impressions");
  const iClk = idx("clicks");
  const iSess = idx("engaged_sessions");
  const iConv = idx("conversions");
  const iOpp = idx("opportunity_key");
  const iClust = idx("cluster_key");

  if (iUrl < 0 || iStart < 0 || iEnd < 0 || iImp < 0 || iClk < 0) {
    return {
      rows: [],
      fatalErrors: [
        "Missing required columns. Need: url, period_start, period_end, impressions, clicks (optional: engaged_sessions, conversions, opportunity_key, cluster_key).",
      ],
      rowErrors: [],
    };
  }

  const rows: ParsedPerformanceRow[] = [];
  const rowErrors: string[] = [];

  for (let li = 1; li < lines.length; li += 1) {
    const lineNumber = li + 1;
    const cells = splitLine(lines[li]!);
    const urlRaw = cells[iUrl] ?? "";
    const resolved = resolvePerformanceUrl(siteRoot, urlRaw);
    if (!resolved) {
      rowErrors.push(`Line ${lineNumber}: invalid URL «${urlRaw}».`);
      continue;
    }
    const key = normalizeUrlKey(resolved);
    const page = pageLookup.get(key);
    if (!page) {
      rowErrors.push(`Line ${lineNumber}: no page on this site for «${resolved}».`);
      continue;
    }

    const ps = parseIsoDateUtc(cells[iStart] ?? "");
    const pe = parseIsoDateUtc(cells[iEnd] ?? "");
    if (!ps || !pe) {
      rowErrors.push(`Line ${lineNumber}: period_start and period_end must be YYYY-MM-DD.`);
      continue;
    }
    if (pe.getTime() < ps.getTime()) {
      rowErrors.push(`Line ${lineNumber}: period_end before period_start.`);
      continue;
    }

    const impressions = parseIntNullable(cells[iImp] ?? "");
    const clicks = parseIntNullable(cells[iClk] ?? "");
    const engagedSessions = iSess >= 0 ? parseIntNullable(cells[iSess] ?? "") : null;
    const conversions = iConv >= 0 ? parseIntNullable(cells[iConv] ?? "") : null;
    const opportunityKey = iOpp >= 0 ? (cells[iOpp]?.trim() || null) : null;
    const clusterKey = iClust >= 0 ? (cells[iClust]?.trim() || null) : null;

    if (impressions !== null && impressions < 0) {
      rowErrors.push(`Line ${lineNumber}: impressions cannot be negative.`);
      continue;
    }
    if (clicks !== null && clicks < 0) {
      rowErrors.push(`Line ${lineNumber}: clicks cannot be negative.`);
      continue;
    }

    rows.push({
      pageId: page.id,
      resolvedUrl: page.url,
      periodStart: ps,
      periodEnd: pe,
      impressions,
      clicks,
      engagedSessions,
      conversions,
      opportunityKey,
      clusterKey,
      lineNumber,
    });
  }

  return { rows, fatalErrors: [], rowErrors };
}

export function ctrFromRow(impressions: number | null, clicks: number | null): number | null {
  if (impressions === null || impressions <= 0 || clicks === null) return null;
  return Math.round((clicks / impressions) * 1e6) / 1e6;
}
