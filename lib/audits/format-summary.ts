/** Human-readable line from `AuditRun.summary` JSON. */
export function formatRunSummary(raw: string | null): string {
  if (!raw) return "—";
  try {
    const j = JSON.parse(raw) as {
      pass?: number;
      fail?: number;
      warn?: number;
      error?: string;
    };
    if (j.error) return `Error: ${j.error}`;
    const parts = [
      j.pass != null ? `${j.pass} pass` : null,
      j.fail != null ? `${j.fail} fail` : null,
      j.warn != null ? `${j.warn} warn` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : raw;
  } catch {
    return raw;
  }
}

/** For dashboard rules (deterministic next steps). */
export function parseRunSummaryCounts(raw: string | null): {
  pass: number;
  fail: number;
  warn: number;
  hasError: boolean;
} {
  if (!raw) return { pass: 0, fail: 0, warn: 0, hasError: false };
  try {
    const j = JSON.parse(raw) as {
      pass?: number;
      fail?: number;
      warn?: number;
      error?: string;
    };
    return {
      pass: j.pass ?? 0,
      fail: j.fail ?? 0,
      warn: j.warn ?? 0,
      hasError: Boolean(j.error),
    };
  } catch {
    return { pass: 0, fail: 0, warn: 0, hasError: false };
  }
}

/** Error string stored in `AuditRun.summary` when a run fails in the runner. */
export function parseSummaryErrorMessage(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { error?: string };
    return j.error ? String(j.error) : null;
  } catch {
    return null;
  }
}
