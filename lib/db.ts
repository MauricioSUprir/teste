import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

// Em produção (Vercel) o banco é o Turso (SQLite na nuvem), configurado por
// TURSO_DATABASE_URL/TURSO_AUTH_TOKEN. Sem essas variáveis, usa o arquivo
// local prisma/dev.db — nada muda no uso no computador.
function criarClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

// Singleton — evita abrir uma conexão nova a cada hot-reload em dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? criarClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
