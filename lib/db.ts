import { PrismaClient } from "@prisma/client";

// Singleton do Prisma — evita abrir uma conexão nova a cada hot-reload em dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
