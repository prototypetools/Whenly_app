import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client singleton.
 * Mencegah kebocoran koneksi saat Next.js melakukan hot reload di mode dev.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
