/**
 * Server-only: do not import this module from Client Components or shared code that runs in the browser.
 * Next.js will not bundle Prisma for the client if you only import from Server Components and Route Handlers.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
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
