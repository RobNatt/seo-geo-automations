/**
 * Short ?err= codes for onboarding failures (avoid cookies and long query strings on Vercel).
 */

export const ONBOARD_ERR_USER_MESSAGES: Record<string, string> = {
  missing_database_url:
    "Add DATABASE_URL in Vercel → Project → Settings → Environment Variables (enable it for Production), then redeploy.",
  sqlite_file_vercel:
    "DATABASE_URL points at a file: SQLite database. Vercel cannot use that reliably. Use Postgres (Neon or Vercel Postgres: set Prisma to provider = \"postgresql\" and run npx prisma db push) or Turso with Prisma’s libSQL setup.",
  postgres_schema_sqlite:
    "DATABASE_URL is for Postgres, but prisma/schema.prisma still uses provider = \"sqlite\". Switch the datasource to postgresql and run npx prisma db push against your database.",
  onboard_failed:
    "Something went wrong while onboarding. Open this deployment’s Vercel Logs and search for prisma: or Error for details.",
};

export function onboardFailureErrCode(error: unknown): string {
  const m = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ");
  if (/Environment variable not found:\s*DATABASE_URL/i.test(m)) return "missing_database_url";
  if (/Unable to open the database file|error code 14/i.test(m)) return "sqlite_file_vercel";
  if (/file:.*SQLite|filesystem cannot open that database|file: SQLite path/i.test(m)) return "sqlite_file_vercel";
  if (/Postgres connection string.*sqlite|still has provider = .sqlite/i.test(m)) return "postgres_schema_sqlite";
  return "onboard_failed";
}

export function messageForOnboardErrCode(code: string | undefined): string | null {
  if (!code) return null;
  return ONBOARD_ERR_USER_MESSAGES[code] ?? ONBOARD_ERR_USER_MESSAGES.onboard_failed;
}
