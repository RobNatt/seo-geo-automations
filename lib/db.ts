/**
 * Server-only: do not import this module from Client Components or shared code that runs in the browser.
 * Next.js will not bundle Prisma for the client if you only import from Server Components and Route Handlers.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Prisma schema uses `env("DATABASE_URL")` — that name is case-sensitive.
 * Vercel must use exactly `DATABASE_URL`. We also accept `database_url` and trim whitespace
 * so a mis-cased or padded env var still works.
 */
function ensureDatabaseUrlForPrisma(): void {
  const trimmed =
    process.env.DATABASE_URL?.trim() ||
    process.env.database_url?.trim();
  if (trimmed) {
    process.env.DATABASE_URL = trimmed;
  }
}

function assertSqliteDatasourceUrl(url: string | undefined): void {
  if (!url) return;
  const lower = url.toLowerCase();
  if (lower.startsWith("postgres://") || lower.startsWith("postgresql://")) {
    throw new Error(
      "DATABASE_URL is a Postgres connection string, but prisma/schema.prisma still has provider = \"sqlite\". " +
        "Either switch the datasource to provider = \"postgresql\" and run `npx prisma db push` against that database, " +
        "or use a SQLite file/libSQL setup that matches the current schema.",
    );
  }
}

function createPrismaClient(): PrismaClient {
  ensureDatabaseUrlForPrisma();
  assertSqliteDatasourceUrl(process.env.DATABASE_URL);
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  const site = (client as unknown as { site?: { findMany?: unknown } }).site;
  if (typeof site?.findMany !== "function") {
    throw new Error(
      "Prisma client is missing the Site model (often a failed or locked `prisma generate`). " +
        "Close apps using the DB engine, then run `npx prisma generate`. " +
        "On Windows, antivirus can block renaming `query_engine-windows.dll.node` in node_modules/.prisma/client.",
    );
  }
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
