/**
 * Robô de backup dos dados vivos do servidor.
 *
 * O disco do Render é temporário: tudo o que fica em /tmp some a cada
 * publicação. Este script roda de hora em hora no GitHub Actions, baixa cada
 * conjunto de dados pelo endpoint de exportação e versiona o resultado no
 * repositório. É desses arquivos que o servidor se recupera quando sobe de
 * novo (ver os *_BACKUP_URL em apps/servidor/index.mjs).
 *
 * Regra de segurança: o servidor diz em restauracaoOk se conseguiu recuperar
 * a memória ao subir. Se não conseguiu, um conjunto vazio significa dado
 * perdido e o backup anterior é preservado. Se conseguiu, um conjunto vazio
 * significa exclusão de verdade feita no painel — e essa sim é gravada.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SERVIDOR = process.env.SERVIDOR ?? "https://beautynow-servidor.onrender.com";
const CHAVE = (process.env.CHAVE ?? "").trim();

if (!CHAVE) {
  console.error("CHAVE vazia — nada a fazer.");
  process.exit(1);
}

const CONJUNTOS = [
  { rota: "/b2b/exportar", arquivo: "b2b-backup.json", contar: (d) => d?.cadastros?.length ?? 0 },
  {
    rota: "/afiliados/exportar",
    arquivo: "afiliados-backup.json",
    contar: (d) =>
      (d?.cadastro?.length ?? 0) +
      (d?.vendas?.length ?? 0) +
      (d?.saques?.length ?? 0) +
      Object.keys(d?.pendentes ?? {}).length,
  },
  { rota: "/avaliacoes/exportar", arquivo: "avaliacoes-backup.json", contar: (d) => d?.avaliacoes?.length ?? 0 },
  { rota: "/pedidos/exportar", arquivo: "pedidos-backup.json", contar: (d) => d?.pedidos?.length ?? 0 },
  {
    rota: "/catalogo/precos/exportar",
    arquivo: "precos-backup.json",
    contar: (d) => Object.values(d?.precos ?? {}).reduce((s, v) => s + Object.keys(v ?? {}).length, 0),
  },
  { rota: "/enviar-banners/exportar", arquivo: "banners-enviados.json", contar: (d) => Object.keys(d?.banners ?? {}).length },
];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** O plano free do Render dorme: a primeira chamada pode levar ~1 minuto. */
async function acordarServidor() {
  for (let i = 1; i <= 4; i++) {
    const r = await fetch(`${SERVIDOR}/`, { signal: AbortSignal.timeout(90_000) }).catch(() => null);
    if (r) return true;
    console.log(`servidor ainda dormindo (tentativa ${i})`);
    await espera(15_000);
  }
  return false;
}

async function baixar(rota) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(`${SERVIDOR}${rota}?chave=${encodeURIComponent(CHAVE)}`, {
        signal: AbortSignal.timeout(90_000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (erro) {
      console.log(`  ${rota}: tentativa ${i} falhou (${erro.message})`);
      if (i < 3) await espera(10_000);
    }
  }
  return null;
}

/** Compara só os dados, para não commitar mudança fantasma a cada hora. */
function semCarimbo(dados) {
  const { geradoEm, restauracaoOk, ...resto } = dados ?? {};
  return JSON.stringify(resto);
}

await acordarServidor();

let mudou = 0;
for (const conjunto of CONJUNTOS) {
  const novo = await baixar(conjunto.rota);
  if (novo === null) {
    console.log(`${conjunto.arquivo}: servidor não respondeu — backup mantido.`);
    continue;
  }

  const quantosNovo = conjunto.contar(novo);
  let antigo = null;
  if (existsSync(conjunto.arquivo)) {
    try {
      antigo = JSON.parse(readFileSync(conjunto.arquivo, "utf8"));
    } catch {
      antigo = null;
    }
  }
  const quantosAntigo = antigo ? conjunto.contar(antigo) : 0;

  // vazio + servidor que não conseguiu recuperar a memória = dado perdido,
  // não exclusão: o backup bom fica de pé
  if (quantosNovo === 0 && quantosAntigo > 0 && novo.restauracaoOk !== true) {
    console.log(
      `${conjunto.arquivo}: servidor devolveu VAZIO sem confirmar a restauração ` +
        `e o backup tem ${quantosAntigo} registro(s) — backup PRESERVADO.`,
    );
    continue;
  }

  if (antigo && semCarimbo(antigo) === semCarimbo(novo)) {
    console.log(`${conjunto.arquivo}: sem mudança (${quantosNovo} registro(s)).`);
    continue;
  }

  writeFileSync(conjunto.arquivo, `${JSON.stringify(novo, null, 2)}\n`);
  console.log(`${conjunto.arquivo}: atualizado — ${quantosAntigo} → ${quantosNovo} registro(s).`);
  mudou++;
}

console.log(mudou ? `\n${mudou} arquivo(s) de backup atualizado(s).` : "\nNada mudou desde o último backup.");
