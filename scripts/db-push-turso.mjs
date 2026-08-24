// Aplica o schema do Prisma no banco Turso (nuvem).
// Uso:  TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:push:turso
// (ou defina as variáveis no .env)

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

// Carrega o .env manualmente (sem depender de flags do Node)
if (existsSync(".env")) {
  for (const linha of readFileSync(".env", "utf-8").split("\n")) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Defina TURSO_DATABASE_URL (e TURSO_AUTH_TOKEN). Veja docs/DEPLOY.md.");
  process.exit(1);
}

// Gera o SQL de criação a partir do schema
const sql = execSync(
  "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
  { encoding: "utf-8" }
);

const client = createClient({ url, authToken });

const comandos = sql
  .split(";")
  .map((c) => c.trim())
  .filter((c) => c.length > 0 && !c.startsWith("--"));

let aplicados = 0;
let pulados = 0;
for (const comando of comandos) {
  try {
    await client.execute(comando);
    aplicados++;
  } catch (erro) {
    const msg = String(erro?.message ?? erro);
    // Tabela/índice já existe: normal ao rodar de novo — ignora
    if (msg.includes("already exists")) {
      pulados++;
    } else {
      console.error(`Falha no comando:\n${comando}\n→ ${msg}`);
      process.exit(1);
    }
  }
}

console.log(`Schema aplicado no Turso: ${aplicados} comandos executados, ${pulados} já existiam.`);
client.close();
