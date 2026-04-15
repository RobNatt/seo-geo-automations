/**
 * Merge query params into a path (path may already include ?query).
 */
export function appendSearchParams(pathWithOptionalQuery: string, additions: Record<string, string>): string {
  const u = new URL(pathWithOptionalQuery, "https://placeholder.local");
  for (const [k, v] of Object.entries(additions)) {
    if (v) u.searchParams.set(k, v);
  }
  return u.pathname + u.search;
}

/**
 * Reads a server-rendered hidden input and returns a safe `focus` query value (element id on the page).
 */
export function focusTokenFromFormData(formData: FormData): string | null {
  const v = String(formData.get("scrollTo") ?? "").trim();
  if (v === "launch-checklist") return "launch-checklist";
  if (v === "open-fix-tasks") return "open-fix-tasks";
  if (v === "check-results") return "check-results";
  if (v.startsWith("open-fix-task:")) {
    const id = v.slice("open-fix-task:".length);
    if (/^[a-z0-9]+$/i.test(id) && id.length >= 20 && id.length <= 40) return `open-fix-task-${id}`;
  }
  return null;
}
