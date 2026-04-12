/** Canonical homepage URL: https, lowercase host, no trailing slash on root, no query/hash. */
export function normalizeRootUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("URL is required.");

  let withScheme = raw;
  if (!/^https?:\/\//i.test(withScheme)) {
    withScheme = `https://${withScheme}`;
  }

  const u = new URL(withScheme);
  u.hash = "";
  u.search = "";
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase();

  let path = u.pathname.replace(/\/+$/, "") || "";
  if (path && !path.startsWith("/")) path = `/${path}`;

  return `https://${u.hostname}${path}`;
}
