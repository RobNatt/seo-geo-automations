export type CheckOutcome = {
  checkKey: string;
  status: "pass" | "fail" | "warn" | "skipped" | "error";
  message: string;
  evidence?: Record<string, unknown>;
};

const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;
const META_DESC_RE =
  /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i;

function stripTagsForVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const GEO_AREA_NOTE_VISIBLE_CHECK_KEY = "geo_area_note_visible" as const;

function hintNeedle(geoHint: string): string | null {
  const t = geoHint.trim();
  if (t.length < 2) return null;
  const slice = t.length <= 48 ? t : t.slice(0, 48).trim();
  return slice.length >= 2 ? slice.toLowerCase() : null;
}

export type RunChecksOptions = {
  /** When set, adds a warn-only GEO baseline check (substring match on visible text). */
  geoHint?: string | null;
};

export async function runChecksForHtml(
  url: string,
  fetchResult: { ok: boolean; status: number; html: string; error?: string },
  options?: RunChecksOptions,
): Promise<CheckOutcome[]> {
  const out: CheckOutcome[] = [];

  out.push({
    checkKey: "url_resolvable",
    status: fetchResult.ok ? "pass" : "fail",
    message: fetchResult.ok
      ? `HTTP ${fetchResult.status}`
      : fetchResult.error ?? `HTTP ${fetchResult.status}`,
    evidence: { status: fetchResult.status },
  });

  if (!fetchResult.ok || !fetchResult.html) {
    out.push({
      checkKey: "title_present",
      status: "skipped",
      message: "No HTML body (request failed).",
    });
    out.push({
      checkKey: "meta_description_present",
      status: "skipped",
      message: "No HTML body (request failed).",
    });
    return out;
  }

  const html = fetchResult.html;
  const titleMatch = html.match(TITLE_RE);
  const title = titleMatch?.[1]?.trim() ?? "";
  out.push({
    checkKey: "title_present",
    status: title.length > 0 ? "pass" : "fail",
    message: title.length > 0 ? `Title length ${title.length}` : "Missing or empty <title>.",
    evidence: title ? { length: title.length } : undefined,
  });

  const metaMatch = html.match(META_DESC_RE);
  const desc = (metaMatch?.[1] ?? metaMatch?.[2] ?? "").trim();
  if (!desc) {
    out.push({
      checkKey: "meta_description_present",
      status: "fail",
      message: "Missing meta description.",
    });
  } else if (desc.length < 50) {
    out.push({
      checkKey: "meta_description_present",
      status: "warn",
      message: `Meta description short (${desc.length} chars).`,
      evidence: { length: desc.length },
    });
  } else if (desc.length > 320) {
    out.push({
      checkKey: "meta_description_present",
      status: "warn",
      message: `Meta description long (${desc.length} chars).`,
      evidence: { length: desc.length },
    });
  } else {
    out.push({
      checkKey: "meta_description_present",
      status: "pass",
      message: `Meta description OK (${desc.length} chars).`,
      evidence: { length: desc.length },
    });
  }

  const needle = options?.geoHint != null ? hintNeedle(options.geoHint) : null;
  if (needle) {
    const visible = stripTagsForVisibleText(html).toLowerCase();
    const found = visible.includes(needle);
    out.push({
      checkKey: GEO_AREA_NOTE_VISIBLE_CHECK_KEY,
      status: found ? "pass" : "warn",
      message: found
        ? "Onboarding location note appears in visible page text."
        : "Onboarding location note was not found in visible page text — confirm service area or NAP is obvious to visitors.",
    });
  }

  return out;
}

export async function fetchPageForAudit(url: string, timeoutMs = 12_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "SEO-GEO-Ops/1.0 (internal audit)" },
    });
    const status = res.status;
    const ct = res.headers.get("content-type") ?? "";
    const html =
      ct.includes("text/html") || ct.includes("application/xhtml")
        ? await res.text()
        : "";
    const ok = res.ok && !!html;
    return {
      ok,
      status,
      html,
      error: res.ok && !html ? `Non-HTML response (${ct || "unknown type"})` : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, html: "", error: msg };
  } finally {
    clearTimeout(t);
  }
}
