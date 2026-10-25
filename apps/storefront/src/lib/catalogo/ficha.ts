/**
 * Ficha do produto (tipo, para que cabelo ou pele, público, ação, acabamento,
 * tom, tamanho e selos) tirada do que o produto já diz: os atributos e
 * especificações quando existem e, no catálogo do Hub — que quase só traz o
 * nome —, as palavras do título e da descrição ("Shampoo… Cachos… 500 ml").
 *
 * Só entra o que está escrito: nada é deduzido além do texto. Produto sem
 * pista nenhuma fica só com o tipo da categoria.
 */
import { normalizar } from "./busca";
import type { Produto } from "./tipos";

export interface Ficha {
  tipo: string | null;
  /** público: masculino, feminino, infantil */
  para: string[];
  cabelo: string[];
  pele: string[];
  acao: string[];
  acabamento: string[];
  /** tom da coloração ("5.2 Castanho Claro Mate") */
  tom: string | null;
  tamanho: string | null;
  selos: string[];
  /** começo da descrição, quando existe */
  resumo: string | null;
}

type Regra = [RegExp, string];

// a ordem importa: a primeira que casar dá o tipo (as mais específicas primeiro)
const TIPOS: Regra[] = [
  [/\bpinceis?\b|\bpincel\b|\bbrush\b/, "Pincel"],
  [/\besponja\b|\bpuff\b/, "Esponja de maquiagem"],
  [/\bshampoo a seco\b|\bbatiste\b/, "Shampoo a seco"],
  [/\bshampoo\b/, "Shampoo"],
  [/\bmascara (de|para) cilios\b|\brimel\b|\bcilios\b|\blash\b/, "Máscara de cílios"],
  [/\bmascara facial\b|\bmascara (de )?argila\b/, "Máscara facial"],
  [/\bmascara\b|\bmasque\b|\bmask\b/, "Máscara capilar"],
  [/\bcondicionador\b|\bcond\b|\bconditioner\b|\bcondicionante\b/, "Condicionador"],
  [/\bleave[ -]?in\b/, "Leave-in"],
  [/\bbruma capilar\b|\bhair mist\b/, "Bruma capilar"],
  [/\b(oleo|oil)\b.*\b(corporal|corpo|body)\b|\bbody oil\b/, "Óleo corporal"],
  [/\b(oleo|oil)\b.*\b(capilar|cabelo|hair)\b|\bhair oil\b/, "Óleo capilar"],
  [/\bcleansing\b|\blimpeza facial\b|\bgel de limpeza\b/, "Limpeza facial"],
  [/\bcreme de pentear\b|\bpentear\b/, "Creme de pentear"],
  [/\bativador(a)?\b/, "Ativador de cachos"],
  [/\bgelatina\b|\bgel\b/, "Gelatina modeladora"],
  [/\bmousse\b/, "Mousse"],
  [/\btonalizante\b/, "Tonalizante"],
  [/\bcoloracao\b|\btintura\b/, "Coloração"],
  [/\bdescolorante\b|\bpo descolorante\b/, "Descolorante"],
  [/\boxidante\b|\bagua oxigenada\b|\bemulsao reveladora\b/, "Água oxigenada"],
  [/\breconstrutor\b/, "Reconstrutor"],
  [/\bcomplexo\b|\bprebiotic\w*|\bsuplemento\b|\bformula da\b|\bimunidade\b/, "Suplemento"],
  [/\bgeleia\b/, "Gelatina modeladora"],
  [/\bfluido\b/, "Fluido"],
  [/\besfrega\b/, "Esfoliante"],
  [/\bantiestrias\b/, "Creme antiestrias"],
  [/\broll[ -]?on\b/, "Roll-on"],
  [/\bacidificante\b/, "Acidificante"],
  [/\bampola\b|\bcapsulas?\b|\bunidose\b|\bshot\b/, "Ampola de tratamento"],
  [/\bprotetor solar\b|\bfps\b|\bsolar\b/, "Protetor solar"],
  [/\bagua micelar\b|\bmicelar\b/, "Água micelar"],
  [/\bsabonete\b/, "Sabonete"],
  [/\besfoliante\b/, "Esfoliante"],
  [/\btonico\b/, "Tônico facial"],
  [/\bserum\b/, "Sérum"],
  [/\boleos?\b|\boil\b/, "Óleo"],
  [/\bpomada\b/, "Pomada"],
  [/\bbalm\b.*\bbarba\b|\bbalsamo\b.*\bbarba\b/, "Bálsamo para barba"],
  [/\bbase\b.*\bcushion\b|\bcushion\b/, "Base cushion"],
  [/\bbase e corretivo\b/, "Base e corretivo"],
  [/\bcorretivo\b|\bcorretor\b|\bconcealer\b/, "Corretivo"],
  [/\bprimer\b/, "Primer"],
  [/\bbruma\b|\bfixador de maquiagem\b|\bspray fixador\b/, "Bruma fixadora"],
  [/\bbase\b|\bfoundation\b/, "Base"],
  [/\bpo compacto\b|\bpo solto\b|\bpo translucido\b|\bpowder\b/, "Pó facial"],
  [/\bblush\b/, "Blush"],
  [/\biluminador\b|\bhighlight(er)?\b/, "Iluminador"],
  [/\bbronzer\b|\bbronzeador\b/, "Bronzer"],
  [/\bcontorno\b|\bcontour\b/, "Contorno"],
  [/\bpaleta\b|\bpalette\b/, "Paleta"],
  [/\bsombra\b|\beyeshadow\b/, "Sombra"],
  [/\bdelineador\b|\beyeliner\b|\bcaneta delineadora\b/, "Delineador"],
  [/\b(lapis|lapiseira|liner)\b.*\b(labial|lip|boca)\b|\blip liner\b/, "Lápis labial"],
  [/\b(lapis|lapiseira)\b.*\bsobrancelhas?\b/, "Lápis de sobrancelha"],
  [/\bsobrancelhas?\b|\bbrow\b/, "Para sobrancelhas"],
  [/\blapis\b|\blapiseira\b/, "Lápis de olho"],
  [/\bglossy?\b|\bbrilho labial\b/, "Gloss labial"],
  [/\blip balm\b|\bbalm labial\b|\bbalsamo labial\b|\bprotetor labial\b/, "Hidratante labial"],
  [/\blip tint\b|\btint\b/, "Lip tint"],
  [/\bbatom\b|\blipstick\b|\blabial\b/, "Batom"],
  [/\besmalte\b/, "Esmalte"],
  [/\bperfume\b|\beau de (parfum|toilette)\b|\bcolonia\b|\bedp\b|\bedt\b/, "Perfume"],
  [/\bbody splash\b|\bsplash\b/, "Body splash"],
  [/\bhidratante\b.*\b(corporal|corpo|body)\b|\blocao\b|\bbody cream\b|\bcreme corporal\b|\bbody lotion\b/, "Hidratante corporal"],
  [/\bhidratante\b.*\bfacial\b/, "Hidratante facial"],
  [/\bhidratante\b/, "Hidratante"],
  [/\bspray\b/, "Spray"],
  [/\bcreme\b|\bcream\b/, "Creme"],
  [/\baparador\b|\btrimmer\b/, "Aparador"],
  [/\bmaquina\b|\bclipper\b|\bcortar\b/, "Máquina de corte"],
  [/\bsecador\b/, "Secador"],
  [/\bprancha\b|\bchapinha\b/, "Prancha"],
  [/\blip\b|\blips\b/, "Para os lábios"],
];

const PARA: Regra[] = [
  [/\bmasculin[oa]s?\b|\bmen\b|\bhomens?\b|\bbarba\b|\bbarber\b|\bbeard\b/, "Masculino"],
  [/\bfeminin[oa]s?\b|\bwoman\b|\bwomen\b|\bmulher(es)?\b|\bpour femme\b/, "Feminino"],
  [/\bkids\b|\binfantil\b|\bcriancas?\b|\bbaby\b|\bbebes?\b/, "Infantil"],
];

const CABELO: Regra[] = [
  [/\bcachead[oa]s?\b|\bcachos?\b|\bcachinhos\b|\bcurly\b|\bcacho\b/, "Cacheados"],
  [/\bcresp[oa]s?\b|\bcrespissim[oa]s?\b|\bcoily\b/, "Crespos"],
  [/\bondulad[oa]s?\b|\bwavy\b/, "Ondulados"],
  [/\blis[oa]s?\b|\bliss\b|\bstraight\b/, "Lisos"],
  [/\bloir[oa]s?\b|\blour[oa]s?\b|\bblond(e|s)?\b|\bdescolorid[oa]s?\b|\bplatinad[oa]s?\b|\bmatizador\b|\bdesamarelador\b|\bgrisalh[oa]s?\b/, "Loiros e descoloridos"],
  [/\bcolorid[oa]s?\b|\bcor protegida\b|\bcolor protect\b/, "Coloridos"],
  [/\bdanificad[oa]s?\b|\bquebradic[oa]s?\b|\bfragilizad[oa]s?\b|\bdanos\b/, "Danificados"],
  [/\btransicao capilar\b/, "Em transição capilar"],
  [/\bressecad[oa]s?\b|\bcabelos? sec[oa]s\b/, "Secos"],
  [/\boleos[oa]s?\b|\boleosidade\b|\bantioleosidade\b/, "Oleosos"],
  [/\btodos os (tipos de )?cabelos?\b/, "Todos os tipos"],
];

const PELE: Regra[] = [
  [/\bpele oleosa\b|\boleosa\b|\bantioleosidade\b|\boil control\b/, "Oleosa"],
  [/\bpele seca\b/, "Seca"],
  [/\bacne\b|\bantiacne\b|\bacneica\b/, "Com tendência à acne"],
  [/\bsensivel\b|\bsensiveis\b/, "Sensível"],
  [/\bpele mista\b/, "Mista"],
  [/\btodos os tipos de pele\b/, "Todos os tipos"],
];

const ACAO: Regra[] = [
  [/\bhidrat\w*/, "Hidratação"],
  [/\bnutri\w*/, "Nutrição"],
  [/\breconstru\w*|\brepair\b|\bregener\w*|\brepara\w*/, "Reconstrução"],
  [/\bfrizz\b|\bantifrizz\b/, "Antifrizz"],
  [/\banti ?quebra\b/, "Antiquebra"],
  [/\bmatiz\w*|\bdesamarel\w*|\bsilver\b/, "Matiza o amarelado"],
  [/\bantiqueda\b|\bqueda\b/, "Antiqueda"],
  [/\bcaspa\b|\banticaspa\b/, "Anticaspa"],
  [/\bdefini\w*|\bativador(a)?\b/, "Define os cachos"],
  [/\bvolume\b/, "Volume"],
  [/\btermic\w*|\bthermal\b|\bprotetor termico\b/, "Protege do calor"],
  [/\bdetox\b|\bantirresiduo\b|\blimpeza profunda\b|\blimpeza\b/, "Limpeza profunda"],
  [/\bbrilho\b|\bshine\b|\bgloss\b/, "Brilho"],
  [/\bclareador\b|\buniformiza\w*/, "Uniformiza o tom"],
  [/\bfixa\w*\b/, "Fixação"],
  [/\bcrescimento\b|\bfortalec\w*/, "Fortalecimento"],
];

const ATIVOS: Regra[] = [
  [/\bacido hialuronico\b|\bhialuronico\b|\bhyaluronic\b/, "Ácido hialurônico"],
  [/\bvitamina c\b|\bvit c\b/, "Vitamina C"],
  [/\bniacinamida\b/, "Niacinamida"],
  [/\bretinol\b/, "Retinol"],
  [/\bqueratina\b|\bkeratin\b/, "Queratina"],
  [/\bcolageno\b|\bcollagen\b/, "Colágeno"],
  [/\bargan\b/, "Óleo de argan"],
  [/\bcoco\b|\bcoconut\b/, "Coco"],
  [/\bpantenol\b/, "Pantenol"],
  [/\bbiotina\b/, "Biotina"],
  [/\bceramidas?\b/, "Ceramidas"],
  [/\bbabosa\b|\baloe\b/, "Babosa"],
  [/\bkarite\b|\bshea\b/, "Manteiga de karité"],
];

const ACABAMENTO: Regra[] = [
  [/\bmatte?\b|\bmate\b/, "Matte"],
  [/\bglow\b|\bluminos\w*|\bradiant\b/, "Luminoso"],
  [/\bcremos[oa]\b|\bcreamy\b/, "Cremoso"],
  [/\bglitter\b|\bcintilante\b|\bshimmer\b/, "Cintilante"],
  [/\bliquid[oa]\b|\bliquid\b/, "Líquido"],
  [/\bcompact[oa]\b|\bcompact\b/, "Compacto"],
  [/\bbastao\b|\bstick\b/, "Bastão"],
];

const SELOS: Regra[] = [
  [/\bvegan[oa]?\b|\bveganissim[oa]\b/, "Vegano"],
  [/\blow poo\b/, "Low poo"],
  [/\bno poo\b/, "No poo"],
  [/\bsem sulfato\b|\bsulfate free\b/, "Sem sulfato"],
  [/\bsem parabenos?\b|\bparaben free\b/, "Sem parabenos"],
  [/\bcruelty free\b/, "Cruelty free"],
];

const ROTULO_CABELO: Record<string, string> = {
  liso: "Lisos",
  ondulado: "Ondulados",
  cacheado: "Cacheados",
  crespo: "Crespos",
};

const casar = (texto: string, regras: Regra[]) => [...new Set(regras.filter(([r]) => r.test(texto)).map(([, rotulo]) => rotulo))];

/** "500ml", "1 L", "60G" → "500 ml", "1 L", "60 g" */
function tamanhoDo(titulo: string): string | null {
  const m = titulo.match(/(\d+(?:[.,]\d+)?)\s?(ml|l|lt|litros?|g|gr|kg|mg|oz)\b/i);
  if (!m) return null;
  const unidade = m[2].toLowerCase();
  const u = unidade.startsWith("l") ? "L" : unidade === "gr" ? "g" : unidade;
  return `${m[1].replace(".", ",")} ${u}`;
}

/** tom da coloração no título: "K.PRO 5.2 Castanho Claro Mate Perolizado 60G" → "5.2 Castanho Claro Mate Perolizado" */
function tomDo(titulo: string): string | null {
  const m = titulo.match(/\b(\d{1,2}[.,]\d{1,3}\+?|\d{1,2})\s*[-–(]?\s*((?:[A-Za-zÀ-ú]+\s?){1,5})/);
  if (!m) return null;
  // começa na primeira palavra de cor (pula o nome da linha: "Caviar Color", "Amazing Colors")
  const palavras = m[2].trim().split(/\s+/);
  const inicio = palavras.findIndex((w) => COR_DE_CABELO.test(normalizar(w)));
  if (inicio < 0) return null;
  const nome = palavras.slice(inicio, inicio + 4).filter((w) => !/^(ml|g|gr|plus)$/i.test(w));
  return `${m[1]} ${nome.join(" ")}`;
}
const COR_DE_CABELO = /\b(louro|loiro|castanho|preto|ruivo|vermelho|marrom|cinza|dourado|acobreado|chocolate|marsala|violeta|perola|bege|natural|clarissimo|platinado|cobre|mogno|tabaco|cereja|grafite)\b/;

export function fichaDoProduto(p: Produto): Ficha {
  const texto = ` ${normalizar(`${p.titulo} ${p.linha ?? ""} ${p.descricao ?? ""}`).replace(/[^a-z0-9.,]+/g, " ")} `;
  const titulo = ` ${normalizar(p.titulo).replace(/[^a-z0-9.,]+/g, " ")} `;
  const naCategoria = (c: string) => p.categorias.includes(c);
  const ehCabelo = naCategoria("cabelos") || /capilar|cabelo/.test(texto);
  let tipo = casar(titulo, TIPOS)[0] ?? casar(texto, TIPOS)[0] ?? null;
  // "Máscara" na maquiagem é de cílios; número de tom com cor de cabelo no título é coloração
  if (tipo === "Máscara capilar" && naCategoria("maquiagem") && !ehCabelo) tipo = "Máscara de cílios";
  if (tipo === "Ampola de tratamento" && !ehCabelo) tipo = "Suplemento";
  if (!tipo && ehCabelo && tomDo(p.titulo)) tipo = "Coloração";
  if (!tipo && naCategoria("maquinas-e-aparadores")) tipo = "Máquina ou aparador";
  if (!tipo && naCategoria("perfumaria")) tipo = "Perfume";
  const ehPele = naCategoria("skincare") || naCategoria("maquiagem") || /facial|pele/.test(texto);

  // o que o cadastro já traz vem primeiro
  const a = p.atributos ?? {};
  const cabelo = [...(a.tipoCabelo ?? []).map((t) => ROTULO_CABELO[t] ?? t), ...(ehCabelo ? casar(texto, CABELO) : [])];
  const pele = [...(a.tipoPele ?? []), ...(ehPele && !ehCabelo ? casar(texto, PELE) : [])];
  const acao = [...casar(texto, ACAO), ...casar(texto, ATIVOS), ...(a.ativo ?? [])];
  const selos = casar(texto, SELOS);
  if (a.vegano && !selos.includes("Vegano")) selos.push("Vegano");
  if (a.semSulfato && !selos.includes("Sem sulfato")) selos.push("Sem sulfato");
  if (a.crueltyFree && !selos.includes("Cruelty free")) selos.push("Cruelty free");
  const fps = a.fps ?? Number(texto.match(/\bfps ?(\d{2,3})\b/)?.[1] ?? 0);
  if (fps) selos.push(`FPS ${fps}`);

  const ehCor = tipo === "Coloração" || tipo === "Tonalizante";
  const resumo = (p.descricao ?? "").trim();
  return {
    tipo,
    para: casar(texto, PARA),
    cabelo: [...new Set(cabelo)],
    pele: [...new Set(pele)],
    acao: [...new Set(acao)].slice(0, 5),
    acabamento: naCategoria("maquiagem") || naCategoria("unhas") ? casar(titulo, ACABAMENTO).slice(0, 2) : [],
    tom: ehCor ? tomDo(p.titulo) : null,
    tamanho: p.especificacoes?.Volume ?? p.especificacoes?.Peso ?? tamanhoDo(p.titulo),
    selos,
    resumo: resumo ? (resumo.length > 180 ? `${resumo.slice(0, 177).trimEnd()}…` : resumo) : null,
  };
}
