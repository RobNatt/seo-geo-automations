/**
 * Server-only: do not import this module from Client Components or shared code that runs in the browser.
 * Next.js will not bundle Prisma for the client if you only import from Server Components and Route Handlers.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Prisma reads `env("DATABASE_URL")` from schema. Vercel Postgres often injects `POSTGRES_PRISMA_URL`
 * (pooled); we normalize so Prisma always sees `DATABASE_URL`.
 */
function ensureDatabaseUrlForPrisma(): void {
  const trimmed =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.database_url?.trim();
  if (trimmed) {
    process.env.DATABASE_URL = trimmed;
  }
}

function assertDatabaseUrlSafeOnVercel(url: string | undefined): void {
  if (!url || !process.env.VERCEL) return;
  const lower = url.toLowerCase();
  if (lower.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL uses a file: path. On Vercel use your Vercel Postgres / Neon URL (postgres:// or postgresql://), " +
        "then run `npx prisma db push` against that database and redeploy.",
    );
  }
}

function createPrismaClient(): PrismaClient {
  ensureDatabaseUrlForPrisma();
  assertDatabaseUrlSafeOnVercel(process.env.DATABASE_URL);
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
