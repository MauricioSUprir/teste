/**
 * Busca do catálogo — roda no navegador, sobre o catálogo inteiro.
 *
 * A primeira versão procurava o texto digitado, inteiro, dentro do nome:
 * "shampoo widi", "batom mari maria", "kpro", "shampo" ou "cachos" não
 * achavam nada. Aqui cada palavra da busca é procurada separadamente (em
 * qualquer ordem) no nome, na marca, na categoria, na linha e no SKU/EAN, e
 * cada uma pode casar por:
 *  - palavra igual (sem acento, sem maiúscula, singular ou plural);
 *  - sinônimo ou abreviação do Hub ("sh" = shampoo, "cond" = condicionador);
 *  - começo de palavra ("hidrat" → hidratação), para quem ainda está digitando;
 *  - erro de digitação ("shampo", "oceani", "senciense").
 * Todas as palavras precisam casar; se nada casa com todas, mostra os
 * produtos que casam com a maioria, para a busca nunca terminar em branco
 * quando há algo parecido.
 *
 * Funções puras (sem window): consultas.ts monta o universo e chama
 * `pesquisar`, e scripts/testar-busca.mjs mede a qualidade com buscas reais.
 */
import type { Produto } from "./tipos";

export interface FonteBusca {
  nomeMarca: (slug: string) => string;
  nomeCategoria: (slug: string) => string;
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " e ");
}

/** palavras que não ajudam a achar produto */
const VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "e", "com", "para", "pra", "em", "a", "o", "as", "os",
  "no", "na", "nos", "nas", "um", "uma", "ao", "aos", "p", "c", "the", "and", "por", "in",
]);

/** expressões de mais de uma palavra que viram uma só antes da busca */
const EXPRESSOES: [RegExp, string][] = [
  [/\bagua oxigenada\b/g, "oxidante"],
  [/\bemulsao reveladora\b/g, "oxidante"],
  [/\bfiltro solar\b/g, "protetor solar"],
  [/\bleave[\s-]+in\b/g, "leavein"],
  [/\banti[\s-]+frizz\b/g, "antifrizz"],
  [/\bshampoo a seco\b/g, "shampoo seco"],
];

/**
 * Sinônimos e abreviações que aparecem nos nomes do Hub. Cada grupo é de
 * palavras equivalentes, já sem acento.
 */
const GRUPOS_SINONIMOS: string[][] = [
  ["shampoo", "xampu", "sh", "champu"],
  ["condicionador", "cond", "cd", "conditioner"],
  ["mascara", "masc", "mask", "masque"],
  ["batom", "bto", "lipstick"],
  ["liquido", "liquida", "liq"],
  ["hidratacao", "hidratante", "hidratantes", "hydration", "hidration", "hydrating", "moisture", "moisturizing"],
  ["nutricao", "nutrition", "nutritiva", "nutritivo", "nourishing"],
  ["reconstrucao", "reconstrutor", "reconstrutora", "reconstructor", "repair", "reparador", "reparadora", "reparacao"],
  ["oleo", "oil", "oleos", "oils"],
  ["protetor", "protecao", "fps", "spf"],
  ["solar", "sun"],
  ["cabelo", "cabelos", "capilar", "hair", "fios"],
  ["cacho", "cachos", "cacheado", "cacheados", "curly", "curls", "curvaturas"],
  ["liso", "lisos", "liss", "alisamento"],
  ["matizador", "matizadora", "desamarelador", "desamareladora", "violet"],
  ["descolorante", "descoloracao"],
  ["oxidante", "oxi", "ox", "oxigenada", "reveladora"],
  ["pomada", "cera", "wax"],
  ["perfume", "perfum", "parfum", "colonia", "fragrancia"],
  ["maquina", "maquinas", "maquininha", "clipper"],
  ["aparador", "trimmer", "barbeador"],
  ["base", "foundation"],
  ["po", "powder"],
  ["corretivo", "concealer", "corret"],
  ["iluminador", "highlighter", "highlight", "ilumina", "ilumi"],
  ["delineador", "eyeliner", "delin"],
  ["pincel", "pinceis", "brush"],
  ["sabonete", "soap", "sabao"],
  ["kit", "kits", "combo"],
  ["gloss", "lipgloss", "brilho labial"],
  ["leavein", "leave"],
  ["pentear", "ativador"],
  ["finalizador", "finalizadora", "finalizacao"],
  ["tonalizante", "coloracao", "tintura", "tinta", "color"],
  ["unha", "unhas", "esmalte"],
  ["barba", "beard"],
];

/** abreviações de marca usadas nos nomes do Hub ("JJ -", "MM ", "WD") */
const APELIDOS_MARCA: Record<string, string[]> = {
  "jacques-janine": ["jj"],
  "mari-maria": ["mm"],
  "widi-care": ["wd", "widi"],
  senscience: ["snc", "sns"],
  "beleza-brasileira": ["bb"],
  "d-vence": ["dv"],
  "k-pro": ["kp"],
  "bruna-tavares": ["bt"],
};

const SINONIMOS = new Map<string, Set<string>>();
for (const grupo of GRUPOS_SINONIMOS) {
  for (const palavra of grupo) {
    const atual = SINONIMOS.get(palavra) ?? new Set<string>();
    for (const outra of grupo) if (outra !== palavra) atual.add(outra);
    SINONIMOS.set(palavra, atual);
  }
}

/** singular simples: "cachos" → "cacho", "condicionadores" → "condicionador", "protecoes" → "protecao" */
function singular(p: string): string {
  if (p.length <= 4 || !p.endsWith("s") || p.endsWith("ss")) return p;
  if (p.endsWith("oes")) return `${p.slice(0, -3)}ao`;
  if (/[rz]es$/.test(p)) return p.slice(0, -2);
  return p.slice(0, -1);
}

/** unidade padronizada: "litros"/"lt" → "l", "gr" → "g" */
const UNIDADES: Record<string, string> = { l: "l", lt: "l", litro: "l", litros: "l", ml: "ml", g: "g", gr: "g", grs: "g", kg: "kg" };

/** 1000 ml = 1 l, 1000 g = 1 kg: os dois jeitos valem */
function medidas(numero: string, unidade: string): string[] {
  const u = UNIDADES[unidade];
  if (!u) return [];
  const n = numero.replace(",", ".");
  const saida = [`${n}${u}`];
  if (u === "ml" && Number(n) === 1000) saida.push("1l");
  if (u === "l" && Number(n) === 1) saida.push("1000ml");
  if (u === "g" && Number(n) === 1000) saida.push("1kg");
  if (u === "kg" && Number(n) === 1) saida.push("1000g");
  return saida;
}

/**
 * Quebra um texto em palavras de busca. "K.PRO" vira "k", "pro" e "kpro";
 * "Leave-In" vira "leave", "in" e "leavein"; "500ML" vira "500ml", "500" e "ml".
 */
export function palavras(texto: string): string[] {
  const t = normalizar(texto);
  const saida = new Set<string>();
  const sequencia: string[] = [];
  for (const bloco of t.split(/\s+/)) {
    if (!bloco) continue;
    const partes = bloco.split(/[^a-z0-9]+/).filter(Boolean);
    for (const parte of partes) {
      saida.add(parte);
      sequencia.push(parte);
      // número colado na unidade: "500ml" também vale como "500" e "ml"
      const m = parte.match(/^(\d+(?:[.,]\d+)?)([a-z]+)$/);
      if (m) {
        saida.add(m[1]);
        saida.add(m[2]);
        for (const x of medidas(m[1], m[2])) saida.add(x);
      }
      // sigla colada no número: "SPF50" vale como "spf" e "50"
      const s = parte.match(/^([a-z]+)(\d+)$/);
      if (s) {
        saida.add(s[1]);
        saida.add(s[2]);
      }
    }
    // palavra com pontuação no meio, junta: k.pro → kpro, d'vence → dvence
    if (partes.length > 1) saida.add(partes.join(""));
  }
  // número separado da unidade: "1 L" também vale como "1l" (e "1000ml")
  for (let i = 0; i + 1 < sequencia.length; i++) {
    if (/^\d+$/.test(sequencia[i])) for (const x of medidas(sequencia[i], sequencia[i + 1])) saida.add(x);
  }
  return [...saida];
}

/**
 * Palavras da busca digitada: como `palavras`, mas número e unidade viram uma
 * palavra só ("1 litro" → "1l"), senão "1" e "litro" teriam de casar sozinhos.
 */
function palavrasDaBusca(texto: string): string[] {
  let t = normalizar(texto);
  for (const [re, troca] of EXPRESSOES) t = t.replace(re, troca);
  const brutas = t.split(/[^a-z0-9]+/).filter(Boolean);
  const saida: string[] = [];
  for (let i = 0; i < brutas.length; i++) {
    const atual = brutas[i];
    const juntas = /^\d+([.,]\d+)?$/.test(atual) && brutas[i + 1] ? medidas(atual, brutas[i + 1]) : [];
    if (juntas.length) {
      saida.push(juntas[0]);
      i++;
      continue;
    }
    const m = atual.match(/^(\d+(?:[.,]\d+)?)([a-z]+)$/);
    const colada = m ? medidas(m[1], m[2]) : [];
    saida.push(colada[0] ?? atual);
  }
  // "k.pro" e "d'vence" digitados com pontuação: fica a forma junta
  for (const bloco of t.split(/\s+/)) {
    const partes = bloco.split(/[^a-z0-9]+/).filter(Boolean);
    if (partes.length > 1 && partes.some((x) => x.length <= 2)) {
      for (const x of partes) saida.splice(saida.indexOf(x), 1);
      saida.push(partes.join(""));
    }
  }
  return [...new Set(saida)].filter((p) => !VAZIAS.has(p));
}

/** distância de edição (troca de letras vizinhas conta como 1) */
function distancia(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  const linhas: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    linhas.push(new Array(b.length + 1).fill(0));
    linhas[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) linhas[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let menorDaLinha = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(linhas[i - 1][j] + 1, linhas[i][j - 1] + 1, linhas[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, linhas[i - 2][j - 2] + 1);
      linhas[i][j] = v;
      if (v < menorDaLinha) menorDaLinha = v;
    }
    if (menorDaLinha > limite) return limite + 1;
  }
  return linhas[a.length][b.length];
}

/** quantos erros de digitação aceitar numa palavra deste tamanho */
const tolerancia = (p: string) => (p.length >= 8 ? 2 : p.length >= 4 ? 1 : 0);

interface Documento {
  produto: Produto;
  titulo: Set<string>;
  marca: Set<string>;
  outros: Set<string>; // categoria, linha, atributos
  codigos: Set<string>; // SKU e EAN
  tituloTexto: string;
  emEstoque: boolean;
  comFoto: boolean;
}

const cacheDocumentos = new Map<string, Documento>();

function documento(p: Produto, fonte: FonteBusca): Documento {
  const chave = `${p.slug}|${p.titulo}|${p.marca}|${p.categorias.join(",")}|${p.variantes.map((v) => v.estoque).join(",")}|${p.imagens?.length ?? 0}`;
  const pronto = cacheDocumentos.get(chave);
  if (pronto) return pronto.produto === p ? pronto : { ...pronto, produto: p };
  const comSingular = (lista: string[]) => new Set(lista.flatMap((x) => [x, singular(x)]));
  const nomeMarca = fonte.nomeMarca(p.marca);
  const marca = comSingular([...palavras(nomeMarca), ...palavras(p.marca), ...(APELIDOS_MARCA[p.marca] ?? [])]);
  const outros = comSingular([
    ...p.categorias.flatMap((c) => [...palavras(c), ...palavras(fonte.nomeCategoria(c))]),
    ...palavras(p.linha ?? ""),
    ...palavras(Object.values(p.atributos ?? {}).flat().join(" ")),
  ]);
  const codigos = new Set(
    [p.especificacoes?.EAN, p.especificacoes?.SKU, ...p.variantes.map((v) => v.sku)]
      .filter(Boolean)
      .map((c) => normalizar(String(c)).replace(/[^a-z0-9]/g, ""))
  );
  const doc: Documento = {
    produto: p,
    titulo: comSingular(palavras(p.titulo)),
    marca,
    outros,
    codigos,
    tituloTexto: ` ${palavras(p.titulo).join(" ")} `,
    emEstoque: p.variantes.some((v) => v.estoque > 0),
    comFoto: (p.imagens?.length ?? 0) > 0,
  };
  if (cacheDocumentos.size > 5000) cacheDocumentos.clear();
  cacheDocumentos.set(chave, doc);
  return doc;
}

/**
 * Para uma palavra da busca, as palavras do catálogo que valem como ela, com
 * a força de cada uma (1 = igual; menos = sinônimo, começo ou erro de digitação).
 */
function equivalentes(termo: string, vocabulario: Set<string>, ultima: boolean): Map<string, number> {
  const mapa = new Map<string, number>();
  const marcar = (palavra: string, forca: number) => {
    if ((mapa.get(palavra) ?? 0) < forca) mapa.set(palavra, forca);
  };
  const base = singular(termo);
  marcar(termo, 1);
  marcar(base, 1);
  for (const s of [...(SINONIMOS.get(termo) ?? []), ...(SINONIMOS.get(base) ?? [])]) {
    for (const parte of palavras(s)) marcar(parte, 0.9);
  }
  const numero = /^\d/.test(termo);
  // começo de palavra: quem está digitando ainda não terminou ("hidrat")
  const minimoPrefixo = ultima ? 2 : 3;
  // palavra que existe no catálogo foi digitada certo: não procura parecidas
  // ("descolorante" não deve trazer "desodorante")
  const existe = vocabulario.has(termo) || vocabulario.has(base);
  const limite = existe ? 0 : tolerancia(termo);
  for (const palavra of vocabulario) {
    if (palavra === termo) continue;
    if (termo.length >= minimoPrefixo && !numero && palavra.startsWith(termo)) marcar(palavra, ultima ? 0.8 : 0.7);
    else if (limite > 0 && !numero && Math.abs(palavra.length - termo.length) <= limite && palavra[0] === termo[0]) {
      const d = distancia(termo, palavra, limite);
      if (d <= limite) marcar(palavra, d === 1 ? 0.6 : 0.45);
    } else if (!existe && termo.length >= 5 && !numero && palavra.length > termo.length && palavra.includes(termo)) {
      // palavra colada no nome: "widicare", "oilrepair"
      marcar(palavra, 0.5);
    }
  }
  // "shampo" casou com "shampoo" por erro de digitação: os sinônimos de
  // "shampoo" ("sh") também valem, um pouco mais fracos
  for (const [palavra, forca] of [...mapa]) {
    if (forca < 0.6 || palavra === termo) continue;
    for (const s of SINONIMOS.get(palavra) ?? []) for (const parte of palavras(s)) marcar(parte, forca * 0.9);
  }
  return mapa;
}

function melhor(conjunto: Set<string>, eq: Map<string, number>): number {
  let m = 0;
  for (const [palavra, forca] of eq) if (forca > m && conjunto.has(palavra)) m = forca;
  return m;
}

export interface ResultadoBusca {
  produtos: Produto[];
  /** true = nenhum produto casou com todas as palavras; a lista é dos mais parecidos */
  aproximado: boolean;
}

export function pesquisar(universo: Produto[], termo: string, fonte: FonteBusca): ResultadoBusca {
  const termos = palavrasDaBusca(termo);
  if (termos.length === 0) return { produtos: [], aproximado: false };
  const textoBusca = ` ${normalizar(termo).split(/[^a-z0-9]+/).filter(Boolean).join(" ")} `;
  const codigoBusca = normalizar(termo).replace(/[^a-z0-9]/g, "");

  const docs = universo.map((p) => documento(p, fonte));
  const vocabulario = new Set<string>();
  for (const d of docs) for (const conj of [d.titulo, d.marca, d.outros]) for (const w of conj) vocabulario.add(w);
  const ultimoTermo = termos[termos.length - 1];
  const eqs = termos.map((t) => equivalentes(t, vocabulario, t === ultimoTermo));

  const pontuados = docs.map((d) => {
    // SKU ou código de barras digitado inteiro
    if (codigoBusca.length >= 4 && d.codigos.has(codigoBusca)) return { d, casou: termos.length, pontos: 1000 };
    let casou = 0;
    let pontos = 0;
    let marcaCasou = false;
    eqs.forEach((eq) => {
      const naMarca = melhor(d.marca, eq) * 0.9;
      const nota = Math.max(melhor(d.titulo, eq), naMarca, melhor(d.outros, eq) * 0.6);
      if (nota > 0) {
        casou += 1;
        pontos += nota * 10;
        if (naMarca >= 0.8) marcaCasou = true;
      }
    });
    if (casou === 0) return { d, casou, pontos };
    if (textoBusca.trim().includes(" ") && d.tituloTexto.includes(textoBusca)) pontos += 8; // a frase inteira, na ordem
    if (d.tituloTexto.startsWith(` ${termos[0]}`)) pontos += 2;
    if (d.emEstoque) pontos += 4;
    if (d.comFoto) pontos += 1;
    return { d, casou, pontos, marcaCasou };
  });

  const ordenar = (a: { pontos: number; d: Documento }, b: { pontos: number; d: Documento }) =>
    b.pontos - a.pontos || a.d.produto.titulo.localeCompare(b.d.produto.titulo);
  const todas = pontuados.filter((r) => r.casou === termos.length).sort(ordenar);
  if (todas.length > 0 || termos.length === 1) return { produtos: todas.map((r) => r.d.produto), aproximado: false };

  // nada casou com todas as palavras: os que casam com a maioria
  const minimo = Math.ceil(termos.length / 2);
  // quem digitou a marca quer a marca: "leave in hidratei" sem leave-in da
  // Hidratei mostra primeiro os produtos Hidratei
  const parecidos = pontuados
    .filter((r) => r.casou >= minimo)
    .sort((a, b) => b.casou - a.casou || Number(b.marcaCasou ?? false) - Number(a.marcaCasou ?? false) || ordenar(a, b));
  return { produtos: parecidos.map((r) => r.d.produto), aproximado: parecidos.length > 0 };
}
