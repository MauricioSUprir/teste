/**
 * Busca do catálogo — roda no navegador, sobre o catálogo inteiro.
 *
 * A primeira versão procurava o texto digitado, inteiro, dentro do nome:
 * "shampoo widi", "batom mari maria", "kpro", "shampo" ou "cachos" não
 * achavam nada. Aqui cada palavra da busca é procurada separadamente (em
 * qualquer ordem) no nome, na marca, na categoria, na linha e no SKU/EAN, e
 * cada uma pode casar por:
 *  - palavra igual (sem acento, sem maiúscula, singular ou plural);
 *  - sinônimo, tradução ou abreviação do Hub ("sh" = shampoo, "red" = vermelho);
 *  - começo de palavra ("hidrat" → hidratação), para quem ainda está digitando;
 *  - erro de digitação ("shampo", "oceani", "matisador"), só quando a palavra
 *    digitada não existe no catálogo.
 * Todas as palavras precisam casar; se nada casa com todas, mostra os
 * produtos que casam com a maioria, para a busca nunca terminar em branco
 * quando há algo parecido.
 *
 * Funções puras (sem window): consultas.ts monta o universo e chama
 * `pesquisar`; scripts/testar-busca.mjs mede a qualidade com buscas reais e
 * scripts/buscar.mjs roda uma busca no terminal.
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
  "de", "da", "do", "das", "dos", "e", "com", "para", "pra", "pro", "em", "a", "o", "as", "os",
  "no", "na", "nos", "nas", "um", "uma", "ao", "aos", "p", "c", "the", "and", "por", "in",
]);

/**
 * Expressões que viram outra antes da busca (o texto já chega sem acento).
 * Servem para o que o cliente fala de um jeito e o Hub escreve de outro.
 */
const EXPRESSOES: [RegExp, string][] = [
  [/\bagua oxigenada\b/g, "oxidante"],
  [/\bemulsao reveladora\b/g, "oxidante"],
  [/\b(?:protetor(?:es)?|filtros?|bloqueador(?:es)?) solar(?:es)?\b/g, "spf solar"],
  [/\b(?:protetor(?:es)?|protecao|protecoes) termic[oa]s?\b/g, "termoprotetor"],
  [/\btermo[\s-]+protetor(?:es)?\b/g, "termoprotetor"],
  [/\bleave[\s-]+in\b/g, "leavein"],
  [/\banti[\s-]+frizz\b/g, "antifrizz"],
  [/\b(?:shampoo a seco|dry shampoo)\b/g, "shampoo seco"],
  [/\bescova progressiva\b/g, "progressiva"],
  [/\b(?:redutor|reducao) de volume\b/g, "redutor"],
  // "shampoo roxo", "máscara violeta": é o matizador
  [/\b(shampoo|sh|condicionador|cond|mascara|masc)\s+(?:roxo|roxa|violeta|lilas)\b/g, "$1 matizador"],
  [/\banti[\s-]*r?residuos?\b/g, "anti residuo"],
  [/\bco[\s-]?wash\b/g, "co wash"],
  [/\b(?:sem|zero|livre de|free) sulfatos?\b|\bsulfat(?:o|e)s? free\b/g, "sulfato"],
  [/\bumecta(?:cao|coes|r)\b/g, "oleo capilar"],
  [/\brim+e(?:l|is)\b/g, "mascara cilios"],
  [/\bbrilho labial\b/g, "gloss"],
  [/\b(?:removedor|remover|tirar|tira) (?:de )?(?:maquiagem|make)\b/g, "demaquilante"],
  [/\bbeauty ?blender\b/g, "esponja maquiagem"],
  [/\bbodysplash(?:e?s)?\b/g, "body splash"],
  [/\bskin ?care\b/g, "skincare"],
  [/\banti[\s-]*(?:idade|r?rugas|envelhecimento|age|aging)\b|\brugas\b/g, "rejuvenescedor"],
  [/\blimpeza (?:facial|de pele|do rosto)\b/g, "sabonete facial"],
  [/\bpos? (?:faciais|facial|(?:para|pra|pro|de|p)(?: o)? rosto)\b/g, "po"],
  [/\bpos (compact|solt|translucid)/g, "po $1"],
];

/**
 * Sinônimos, traduções e abreviações dos nomes do Hub. Cada grupo é de
 * palavras equivalentes (valem nos dois sentidos), já sem acento e sem espaço.
 */
const GRUPOS_SINONIMOS: string[][] = [
  ["shampoo", "xampu", "sh", "champu", "shampu", "champo", "xampoo", "xampo"],
  ["condicionador", "cond", "cd", "conditioner"],
  ["mascara", "masc", "mask", "masque"],
  ["batom", "bto", "lipstick"],
  ["liquido", "liquida", "liq"],
  ["hidratacao", "hidratante", "hidratantes", "hydration", "hidration", "hydrating", "moisture", "moisturizing", "moisturizer", "moist", "hidra", "hydra"],
  ["nutricao", "nutrition", "nutritiva", "nutritivo", "nourishing"],
  ["reconstrucao", "reconstrutor", "reconstrutora", "reconstructor", "repair", "reparador", "reparadora", "reparacao"],
  ["oleo", "oil", "oleos", "oils"],
  ["protetor", "protecao", "fps", "spf"],
  ["solar", "sun"],
  ["termoprotetor", "termico", "termica", "termoativado", "termo", "protector"],
  ["cabelo", "cabelos", "capilar", "hair", "fios"],
  ["cacho", "cachos", "cacheado", "cacheados", "curly", "curls", "curvaturas"],
  ["liso", "lisos", "liss", "alisamento"],
  ["progressiva", "alisante", "redutor", "reduct", "selagem", "alinhamento", "realinhamento"],
  ["botox", "btx"],
  ["matizador", "matizadora", "desamarelador", "desamareladora", "violet"],
  ["descolorante", "descoloracao"],
  ["oxidante", "oxi", "ox", "oxigenada", "reveladora", "emulsao"],
  ["volume", "volumes", "vol"],
  ["tonalizante", "tonalizador", "ton", "coloracao", "tintura", "tinta", "color"],
  ["loiro", "loira", "louro", "loura", "blond", "blonde"],
  ["cinza", "acinzentado", "acinzentada", "acinz", "acz", "cza", "acin", "grey", "gray"],
  ["muito", "mto"],
  ["claro", "clara"],
  ["escuro", "escura"],
  ["preto", "preta", "black"],
  ["marrom", "brown"],
  ["rosa", "pink", "rose"],
  ["vermelho", "vermelha", "red"],
  ["dourado", "dourada", "gold", "golden"],
  ["prata", "silver"],
  ["branco", "branca", "white"],
  ["pomada", "cera", "wax"],
  ["fixador", "fixadora", "fix"],
  ["perfume", "perfum", "parfum", "colonia", "fragrancia"],
  ["arabe", "arabes", "arabia", "arabian"],
  ["maquina", "maquinas", "maquininha", "clipper"],
  ["aparador", "trimmer", "barbeador"],
  ["base", "foundation"],
  ["po", "powder"],
  ["corretivo", "concealer", "corret"],
  ["iluminador", "highlighter", "highlight", "ilumina", "ilumi"],
  ["bronzer", "bronzeador"],
  ["contorno", "contour"],
  ["bastao", "stick"],
  ["delineador", "eyeliner", "delin"],
  ["pincel", "pinceis", "brush"],
  ["esponja", "esponjinha", "sponge"],
  ["sabonete", "soap", "sabao", "cleanser", "cleansing"],
  ["kit", "kits", "combo", "gift", "estojo", "set"],
  ["gloss", "lipgloss"],
  ["labial", "labiais", "labios", "labio", "lip", "lips", "boca"],
  ["esfoliante", "esfoliantes", "esfoliacao", "scrub", "exfoliant"],
  ["leavein", "leave"],
  ["pentear", "ativador"],
  ["finalizadora", "finalizacao"], // máquina finalizadora (Wahl); o finalizador de cabelo é etiqueta
  ["antifrizz", "frizz"],
  ["unha", "unhas", "esmalte"],
  ["barba", "beard"],
  ["vitamina", "vitamin", "vit"],
  ["creme", "cream"],
  ["corporal", "corpo", "body"],
  ["locao", "lotion"],
  ["facial", "rosto", "face"],
  ["pele", "skincare"],
  ["oleosa", "oleoso", "oleosidade", "antioleosidade"],
  ["rejuvenescedor", "rejuvenescedora", "retinol", "bakuchiol"],
  ["acne", "antiacne", "espinha"],
  ["pe", "pes", "pezinho"],
];

/** abreviações de marca usadas nos nomes do Hub ("JJ -", "MM ", "WD") e grafias comuns */
const APELIDOS_MARCA: Record<string, string[]> = {
  "jacques-janine": ["jj"],
  "mari-maria": ["mm"],
  "widi-care": ["wd", "widi"],
  senscience: ["snc", "sns"],
  "beleza-brasileira": ["bb"],
  "d-vence": ["dv"],
  "k-pro": ["kp"],
  "bruna-tavares": ["bt"],
  wahl: ["wal"],
};

/** abreviação digitada vale como a palavra cheia ("sh jj" = "shampoo jj") */
const ABREVIACOES = new Set(["sh", "cond", "cd", "masc", "bto", "liq"]);

/** palavra sem número que pede um tamanho: "shampoo litro", "máscara kilo" */
const TAMANHO_SEM_NUMERO: Record<string, string[]> = {
  litro: ["1l"],
  lavatorio: ["1l", "1kg"],
  kilo: ["1kg"],
  quilo: ["1kg"],
};

/**
 * Etiquetas: o que o produto é, quando o nome não diz com a palavra que o
 * cliente usa. [regra no nome (sem acento), categoria (opcional), etiquetas].
 */
const ETIQUETAS: [RegExp, string | null, string[]][] = [
  // nuance de cor no nome ("K.PRO 9.2 Louro…", "5NL", "7.3+"): é tonalizante/coloração
  [/\b\d{1,2}\.\d{1,2}\+?(?!\d)|\b\d{1,2}nl\b/, "cabelos", ["tonalizante", "coloracao"]],
  // matizador cujo nome não diz "matizador"
  [/\bspecial (?:silver|blond)\b/, "cabelos", ["matizador"]],
  // finalizador de cabelo: leave-in, creme de pentear, gelatina, óleo…
  [/\b(?:finalizador|finalizando|leave|creme de pentear|ativador|modelador|gelatina|geleia|mousse|oleo|oil|serum|fluido|spray|pomada|cera|style stick|bruma|day after|reparador de pontas|termoativado)\b/, "cabelos", ["finalizador"]],
  // "Lip Matte", "Color My Lips": batom sem a palavra batom
  [/\blip matte\b|\bcolor my lips\b/, null, ["batom"]],
  // tint de maquiagem é de lábio (skin tint é base)
  [/\btint\b(?<!skin tint)/, null, ["labial", "lip"]],
  // água/leite micelar de rosto é demaquilante (o micelar de cabelo não)
  [/\bmicelar\b/, "skincare", ["demaquilante"]],
];
// o finalizador não vale para quem é de lavatório/química
const NAO_FINALIZADOR = /\b(?:shampoo|condicionador|mascara|kit|co wash|acidificante|tonalizante|coloracao|descolorante|oxi|emulsao|ampola|proteina|reconstrutor)\b/;

/** marcas de suplemento: o Hub não diz "suplemento" em lugar nenhum */
const MARCAS_SUPLEMENTO = new Set(["rituaria", "denavita"]);

/** tipo do produto no nome: "Mascara Capilar Tec Oil" é máscara, não óleo */
const TIPOS_NO_TITULO = ["shampoo", "condicionador", "mascara", "leavein"];
const TIPOS_NA_BUSCA = [...TIPOS_NO_TITULO, "oleo"];

const SINONIMOS = new Map<string, Set<string>>();
for (const grupo of GRUPOS_SINONIMOS) {
  for (const palavra of grupo) {
    const atual = SINONIMOS.get(palavra) ?? new Set<string>();
    for (const outra of grupo) if (outra !== palavra) atual.add(outra);
    SINONIMOS.set(palavra, atual);
  }
}
const tipoDe = (w: string, tipos: string[]) => tipos.find((t) => t === w || SINONIMOS.get(t)?.has(w));

/** singular simples: "cachos" → "cacho", "condicionadores" → "condicionador", "batons" → "batom" */
function singular(p: string): string {
  if (p.length <= 4 || !p.endsWith("s") || p.endsWith("ss")) return p;
  if (p.endsWith("oes")) return `${p.slice(0, -3)}ao`;
  if (p.endsWith("ns")) return `${p.slice(0, -2)}m`;
  if (/[rz]es$/.test(p)) return p.slice(0, -2);
  return p.slice(0, -1);
}

/** unidade padronizada: "litros"/"lt" → "l", "gr" → "g", "volumes"/"v" → "vol" */
const UNIDADES: Record<string, string> = {
  l: "l", lt: "l", litro: "l", litros: "l",
  ml: "ml",
  g: "g", gr: "g", grs: "g",
  kg: "kg", kilo: "kg", kilos: "kg", quilo: "kg", quilos: "kg",
  v: "vol", vol: "vol", vols: "vol", volume: "vol", volumes: "vol",
};

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
 * Uma palavra "como digitada" (sem espaço) em formas de busca:
 *  - número e unidade colados: "500ml" → "500ml" (+ "500", "ml" no catálogo);
 *  - código de nuance: "6.0", "7.38", "6/0" → "6.0" (não se confunde com 60g);
 *  - pontuação no meio: "k.pro" → "kpro", "d'vence" → "dvence";
 *  - sigla e número: "SPF50" → "spf" e "50"; "MM10N" → "mm" e "10n".
 */
function formasDoBloco(bloco: string): { principal: string[]; extras: string[] } {
  const medida = bloco.match(/^(\d+(?:[.,]\d+)?)([a-z]+)$/);
  if (medida && UNIDADES[medida[2]]) {
    const ms = medidas(medida[1], medida[2]);
    return { principal: [ms[0]], extras: [medida[1], medida[2], ...ms.slice(1)] };
  }
  const partes = bloco.split(/[^a-z0-9]+/).filter(Boolean);
  if (partes.length === 0) return { principal: [], extras: [] };
  if (partes.length > 1 && partes.every((x) => /^\d+$/.test(x))) {
    return { principal: [partes.join(".")], extras: partes };
  }
  if (partes.length > 1) {
    const junta = partes.join("");
    // "k.pro", "d'vence": a forma junta é a principal; "leave-in": as partes
    return partes.some((x) => x.length <= 2) ? { principal: [junta], extras: partes } : { principal: partes, extras: [junta] };
  }
  const p = partes[0];
  const extras: string[] = [];
  const colado = p.match(/^(\d+)([a-z]+)$/);
  if (colado) extras.push(colado[1], colado[2]);
  const sigla = p.match(/^([a-z]+)(\d+)$/);
  if (sigla) extras.push(sigla[1], sigla[2], sigla[2].replace(/^0+(?=\d)/, ""));
  const tom = p.match(/^([a-z]+)(\d+[a-z]+)$/);
  if (tom) extras.push(tom[1], tom[2]);
  if (/^0+\d/.test(p)) extras.push(p.replace(/^0+(?=\d)/, ""));
  return { principal: [p], extras };
}

/** palavras de um texto do catálogo (nome, marca, categoria), com todas as formas */
export function palavras(texto: string): string[] {
  const t = normalizar(texto);
  const saida = new Set<string>();
  const sequencia: string[] = [];
  for (const bloco of t.split(/\s+/)) {
    if (!bloco) continue;
    const { principal, extras } = formasDoBloco(bloco);
    for (const x of [...principal, ...extras]) saida.add(x);
    sequencia.push(...bloco.split(/[^a-z0-9]+/).filter(Boolean));
  }
  for (let i = 0; i + 1 < sequencia.length; i++) {
    const [a, b] = [sequencia[i], sequencia[i + 1]];
    // número separado da unidade: "1 L" também vale como "1l" (e "1000ml")
    if (/^\d+$/.test(a)) for (const x of medidas(a, b)) saida.add(x);
    // sigla separada do número: "MMC 05" vale como "mmc05", "FPS 50" como "fps50"
    if (/^[a-z]{2,4}$/.test(a) && /^\d+$/.test(b)) saida.add(`${a}${b}`);
  }
  return [...saida];
}

/**
 * Palavras da busca digitada: uma por ideia. "1 litro" vira "1l", "6.0" fica
 * "6.0", "k.pro" vira "kpro" (senão "1" e "litro" teriam de casar sozinhos).
 */
function palavrasDaBusca(texto: string): string[] {
  let t = normalizar(texto);
  for (const [re, troca] of EXPRESSOES) t = t.replace(re, troca);
  const blocos = t.split(/\s+/).filter(Boolean);
  const saida: string[] = [];
  for (let i = 0; i < blocos.length; i++) {
    const atual = blocos[i];
    const proximo = blocos[i + 1];
    if (/^\d+([.,]\d+)?$/.test(atual) && proximo) {
      const juntas = medidas(atual, proximo);
      if (juntas.length) {
        saida.push(juntas[0]);
        i++;
        continue;
      }
    }
    saida.push(...formasDoBloco(atual).principal);
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
/** primeira letra pelo som: "kaviar" ~ "caviar", "queratina" ~ "keratina" */
const SOM_INICIAL: Record<string, string> = { k: "c", q: "c", z: "s" };
const inicial = (p: string) => SOM_INICIAL[p[0]] ?? p[0];

interface Documento {
  produto: Produto;
  titulo: Set<string>;
  marca: Set<string>;
  outros: Set<string>; // categoria, linha, atributos, etiquetas
  codigos: Set<string>; // SKU e EAN
  tituloTexto: string;
  tipos: Set<string>; // tipo de produto que o nome declara (shampoo, máscara…)
  posQuimica: boolean; // "Pós Progressiva": cuidado depois da química, não a química
  kit: boolean;
  emEstoque: boolean;
  comFoto: boolean;
}

const cacheDocumentos = new Map<string, Documento>();

function documento(p: Produto, fonte: FonteBusca): Documento {
  const chave = `${p.slug}|${p.titulo}|${p.marca}|${p.categorias.join(",")}|${p.variantes.map((v) => v.estoque).join(",")}|${p.imagens?.length ?? 0}`;
  const pronto = cacheDocumentos.get(chave);
  if (pronto) return pronto.produto === p ? pronto : { ...pronto, produto: p };
  const comSingular = (lista: string[]) => new Set(lista.flatMap((x) => [x, singular(x)]));
  const tituloNormal = normalizar(p.titulo);
  const palavrasTitulo = palavras(p.titulo);
  const etiquetas: string[] = [];
  for (const [re, categoria, novas] of ETIQUETAS) {
    if ((categoria === null || p.categorias.includes(categoria)) && re.test(tituloNormal)) etiquetas.push(...novas);
  }
  if (etiquetas.includes("finalizador") && NAO_FINALIZADOR.test(tituloNormal)) etiquetas.splice(etiquetas.indexOf("finalizador"), 1);
  if (MARCAS_SUPLEMENTO.has(p.marca) && !p.categorias.includes("skincare")) etiquetas.push("suplemento");
  const titulo = comSingular(palavrasTitulo);
  const marca = comSingular([...palavras(fonte.nomeMarca(p.marca)), ...palavras(p.marca), ...(APELIDOS_MARCA[p.marca] ?? [])]);
  const outros = comSingular([
    ...p.categorias.flatMap((c) => [...palavras(c), ...palavras(fonte.nomeCategoria(c))]),
    ...palavras(p.linha ?? ""),
    ...palavras(Object.values(p.atributos ?? {}).flat().join(" ")),
    ...etiquetas,
  ]);
  // "batom" de "Lip Matte" pesa como se estivesse no nome
  for (const e of etiquetas) if (e === "batom" || e === "gloss") titulo.add(e);
  const codigos = new Set(
    [p.especificacoes?.EAN, p.especificacoes?.SKU, ...p.variantes.map((v) => v.sku)]
      .filter(Boolean)
      .map((c) => normalizar(String(c)).replace(/[^a-z0-9]/g, ""))
  );
  const tipos = new Set<string>();
  for (const w of titulo) {
    const tipo = tipoDe(w, TIPOS_NO_TITULO);
    if (tipo) tipos.add(tipo);
  }
  const doc: Documento = {
    produto: p,
    titulo,
    marca,
    outros,
    codigos,
    tituloTexto: ` ${tituloNormal.split(/[^a-z0-9]+/).filter(Boolean).join(" ")} `,
    tipos,
    kit: titulo.has("kit") || titulo.has("kits"),
    posQuimica: /\bpos[\s-]+(?:progressiva|quimica|escova|alisamento|coloracao|descoloracao)\b/.test(tituloNormal),
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
  const sinonimos = [...(SINONIMOS.get(termo) ?? []), ...(SINONIMOS.get(base) ?? [])];
  // abreviação digitada ("sh") vale como a palavra cheia: o nome por extenso
  // pesa mais que a sigla dos kits ("Kit … SH + Cond")
  const abreviacao = ABREVIACOES.has(termo);
  marcar(termo, abreviacao ? 0.9 : 1);
  marcar(base, abreviacao ? 0.9 : 1);
  for (const s of sinonimos) marcar(s, abreviacao ? 1 : 0.9);
  for (const x of TAMANHO_SEM_NUMERO[base] ?? []) marcar(x, 0.9);
  const numero = /^\d/.test(termo);
  // começo de palavra: quem está digitando ainda não terminou ("hidrat")
  const minimoPrefixo = ultima ? 2 : 3;
  // palavra (ou sinônimo dela) que existe no catálogo foi digitada certo: não
  // procura parecidas ("descolorante" não traz "desodorante"; "pele" não vira "pelo")
  const existe = vocabulario.has(termo) || vocabulario.has(base) || sinonimos.some((s) => vocabulario.has(s));
  const limite = existe ? 0 : tolerancia(termo);
  // palavra curta já completa ("pes", "po") e abreviação no meio da busca
  // ("cond widi") não são começo de outra ("pesadinho", "condicionante")
  const podePrefixo = termo.length >= minimoPrefixo && !(existe && termo.length <= 3) && !(abreviacao && !ultima);
  if (!numero) {
    for (const palavra of vocabulario) {
      if (palavra === termo) continue;
      if (podePrefixo && palavra.startsWith(termo)) marcar(palavra, ultima ? 0.8 : 0.7);
      else if (limite > 0 && Math.abs(palavra.length - termo.length) <= limite && inicial(palavra) === inicial(termo)) {
        const d = distancia(termo, palavra, limite);
        if (d <= limite) marcar(palavra, d === 1 ? 0.6 : 0.45);
      } else if (!existe && termo.length >= 5 && palavra.length > termo.length && palavra.includes(termo)) {
        // palavra colada no nome: "widicare", "oilrepair"
        marcar(palavra, 0.5);
      }
    }
    // erro de digitação de uma palavra que só existe como sinônimo
    // ("matisador", "oxidande": nenhum nome diz "matizador"/"oxidante")
    if (limite > 0) {
      for (const chave of SINONIMOS.keys()) {
        if (Math.abs(chave.length - termo.length) > limite || inicial(chave) !== inicial(termo)) continue;
        if (distancia(termo, chave, limite) <= limite) {
          marcar(chave, 0.6);
          for (const s of SINONIMOS.get(chave) ?? []) marcar(s, 0.55);
        }
      }
    }
  }
  // "shampo" casou com "shampoo" por erro de digitação: os sinônimos de
  // "shampoo" ("sh") também valem, um pouco mais fracos
  for (const [palavra, forca] of [...mapa]) {
    if (forca < 0.6 || palavra === termo) continue;
    for (const s of SINONIMOS.get(palavra) ?? []) marcar(s, forca * 0.9);
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

interface Pontuado {
  d: Documento;
  casou: number;
  pontos: number;
  marcaCasou: boolean;
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
  // quem não pediu kit quer o produto avulso primeiro
  const pediuKit = eqs.some((eq) => (eq.get("kit") ?? 0) >= 0.9);
  const pediuPos = termos.includes("pos");
  // tipo de produto pedido ("óleo capilar"): nome que declara outro tipo desce
  const tiposPedidos = new Set(termos.map((t) => tipoDe(singular(t), TIPOS_NA_BUSCA)).filter(Boolean));

  const pontuados: Pontuado[] = docs.map((d) => {
    // SKU ou código de barras digitado inteiro. Código de 3 caracteres também
    // vale (Widi "777"); se o número também aparece em nomes ("200" de
    // "200ML"), o produto do SKU entra na lista mas não passa à frente
    if (codigoBusca.length >= 3 && d.codigos.has(codigoBusca)) {
      return { d, casou: termos.length, pontos: codigoBusca.length >= 4 || !vocabulario.has(codigoBusca) ? 1000 : 1, marcaCasou: false };
    }
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
    if (casou === 0) return { d, casou, pontos, marcaCasou };
    if (textoBusca.trim().includes(" ") && d.tituloTexto.includes(textoBusca)) pontos += 8; // a frase inteira, na ordem
    if (d.tituloTexto.startsWith(` ${termos[0]} `)) pontos += 2;
    if (!pediuKit && d.kit) pontos -= 6;
    if (d.posQuimica && !pediuPos) pontos -= 3;
    if (tiposPedidos.size > 0 && d.tipos.size > 0 && ![...tiposPedidos].some((t) => d.tipos.has(t as string))) pontos -= 5;
    if (d.emEstoque) pontos += 4;
    if (d.comFoto) pontos += 1;
    return { d, casou, pontos, marcaCasou };
  });

  const ordenar = (a: Pontuado, b: Pontuado) => b.pontos - a.pontos || a.d.produto.titulo.localeCompare(b.d.produto.titulo);
  const todas = pontuados.filter((r) => r.casou === termos.length).sort(ordenar);
  if (todas.length > 0 || termos.length === 1) return { produtos: todas.map((r) => r.d.produto), aproximado: false };

  // nada casou com todas as palavras: os que casam com a maioria. Quem
  // digitou a marca quer a marca ("leave in hidratei" sem leave-in da
  // Hidratei mostra primeiro os produtos Hidratei)
  const minimo = Math.ceil(termos.length / 2);
  const parecidos = pontuados
    .filter((r) => r.casou >= minimo)
    .sort((a, b) => b.casou - a.casou || Number(b.marcaCasou) - Number(a.marcaCasou) || ordenar(a, b));
  return { produtos: parecidos.map((r) => r.d.produto), aproximado: parecidos.length > 0 };
}
