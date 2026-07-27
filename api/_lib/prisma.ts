/**
 * Prisma Client singleton for Vercel serverless functions.
 *
 * WHY A SINGLETON: each Vercel function invocation can spin up a fresh
 * Lambda-style container. If we naively `new PrismaClient()` on every
 * request, we exhaust Neon's connection pool under load. Instead we cache
 * the client on `globalThis` so warm containers reuse the same connection.
 *
 * Pair this with Neon's pooled connection string (DATABASE_URL with
 * `?pgbouncer=true`) for the right scaling behavior.
 *
 * Import from any api/ handler:
 *   import { prisma } from '../_lib/prisma';
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
