/**
 * Resolve pasted performance URLs to `Page.url` values for this site (deterministic).
 */

export function stripTrailingSlash(href: string): string {
  const s = href.trim();
  if (s.length <= 1) return s;
  return s.replace(/\/+$/, "");
}

export function normalizeUrlKey(href: string): string {
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    const path = stripTrailingSlash(`${u.pathname || "/"}`);
    const q = u.search ? u.search : "";
    return `${host}${path}${q}`;
  } catch {
    return href.trim().toLowerCase();
  }
}

/** Turn a cell into an absolute URL string comparable to stored `Page.url`. */
export function resolvePerformanceUrl(siteRoot: string, raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const root = new URL(siteRoot.match(/^https?:\/\//i) ? siteRoot : `https://${siteRoot}`);
    if (/^https?:\/\//i.test(t)) {
      return stripTrailingSlash(new URL(t).href);
    }
    const path = t.startsWith("/") ? t : `/${t}`;
    return stripTrailingSlash(new URL(path, root).href);
  } catch {
    return null;
  }
}

export function buildPageUrlLookup(
  pages: { id: string; url: string }[],
): Map<string, { id: string; url: string }> {
  const m = new Map<string, { id: string; url: string }>();
  for (const p of pages) {
    m.set(normalizeUrlKey(p.url), p);
  }
  return m;
}
