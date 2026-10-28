/**
 * Planta do shopping e quem ocupa cada loja.
 *
 * Galeria principal ao longo do eixo z: a entrada fica no sul (z = +36), as
 * 8 lojas (4 de cada lado, 12 m de frente × 12 m de fundo = 144 m²) entre
 * z = +24 e z = −24, e a Praça da Beleza com a fonte no norte (até z = −44).
 * Corredor de 16 m (x de −8 a 8); as lojas vão de |x| = 8 a |x| = 20.
 *
 * No fundo da praça ficam as duas lojas âncora — BeautyNow e Be2Beauty —, que
 * são a mesma loja 3D dos sites (30 × 20 m, mundo/loja-site.ts). Nas lojas da
 * galeria fica a Pulse; as outras estão para alugar, e quem quiser pode montar
 * a própria loja numa delas (prévia guardada no aparelho).
 */
import { produtosDaLoja, todosProdutos, type Produto } from "./catalogo";
import { textos } from "../copy/textos";

export const PLANTA = {
  meioCorredor: 8,
  fundoLoja: 20,
  zEntrada: 36,
  zLojasSul: 24,
  zLojasNorte: -24,
  frente: 12,
  zPraca: -44,
  meiaPraca: 32,
  tetoGaleria: 10.5,
  tetoLoja: 4.6,
  piso2: 5.6,
  /** varanda do 2º piso avança sobre o corredor até |x| = 5,6 */
  varanda: 5.6,
};

export interface Unidade {
  /** "101" … "108" */
  numero: string;
  /** −1 = lado esquerdo (x < 0), +1 = direito */
  lado: -1 | 1;
  z0: number;
  z1: number;
  zc: number;
  area: number;
}

/** 101, 103, 105, 107 à esquerda (da entrada para a praça); 102 … 108 à direita */
export const UNIDADES: Unidade[] = [-1, 1].flatMap((lado) =>
  [0, 1, 2, 3].map((i) => {
    const z1 = PLANTA.zLojasSul - i * PLANTA.frente;
    const z0 = z1 - PLANTA.frente;
    return { numero: String(101 + i * 2 + (lado > 0 ? 1 : 0)), lado: lado as -1 | 1, z0, z1, zc: (z0 + z1) / 2, area: PLANTA.frente * (PLANTA.fundoLoja - PLANTA.meioCorredor) };
  })
);

export type Piso = "madeira" | "porcelanato" | "cimento";
export type Letreiro = "beautynow" | "be2beauty" | "pulse" | "moderna" | "classica" | "forte";

export interface EstiloLoja {
  primaria: string;
  secundaria: string;
  parede: string;
  piso: Piso;
  letreiro: Letreiro;
  /** faixa do letreiro na fachada */
  faixa: string;
}

export interface Inquilino {
  id: string;
  nome: string;
  slogan: string;
  unidade: string;
  estilo: EstiloLoja;
  produtos: Produto[];
  atendente: { avatar: string; nome: string; cor: string };
  /** montada pelo visitante no editor (prévia) */
  previa: boolean;
}

const MARCAS_DO_GRUPO: Inquilino[] = [
  {
    id: "pulse",
    nome: "Pulse",
    slogan: "Beauty store",
    unidade: "101",
    estilo: { primaria: "#1C1714", secundaria: "#D99A4E", parede: "#F4EEE7", piso: "cimento", letreiro: "pulse", faixa: "#1C1714" },
    produtos: produtosDaLoja("pulse"),
    atendente: { avatar: "Female_Party_02", nome: "Júlia", cor: "#1C1714" },
    previa: false,
  },
];

/** loja âncora: a loja 3D do site, inteira, no fundo da praça (entrada virada para a praça, +z) */
export interface Ancora {
  inquilino: Inquilino;
  /** centro da loja no shopping */
  cx: number;
  cz: number;
  site: {
    estilo: "conceito" | "profissional";
    logo: { texto: string; destaque: boolean; sufixo?: string }[];
    fraseVitrine: string | null;
    corPrimaria: string;
    corEscura: string;
    /** a atendente do site (Rocketbox com o blazer da loja) */
    modeloAtendente: string;
  };
}

export const ANCORAS: Ancora[] = [
  {
    inquilino: {
      id: "beautynow",
      nome: "BeautyNow",
      slogan: "Beleza que acontece agora.",
      unidade: "A1",
      estilo: { primaria: "#6B2BD9", secundaria: "#EFE6FF", parede: "#FBF8FF", piso: "porcelanato", letreiro: "beautynow", faixa: "#ffffff" },
      produtos: [],
      atendente: { avatar: "Female_Adult_05", nome: "Larissa", cor: "#6B2BD9" },
      previa: false,
    },
    cx: -15.8,
    cz: -54.5,
    site: {
      estilo: "conceito",
      logo: [
        { texto: "BEAUTY", destaque: false },
        { texto: "NOW!", destaque: true },
      ],
      fraseVitrine: "Beleza que acontece agora.",
      corPrimaria: "#6B2BD9",
      corEscura: "#3E1A8C",
      modeloAtendente: "atendente-roxa.glb",
    },
  },
  {
    inquilino: {
      id: "be2beauty",
      nome: "Be2Beauty",
      slogan: "Only professional.",
      unidade: "A2",
      estilo: { primaria: "#13315C", secundaria: "#DCE7F5", parede: "#F1F5FA", piso: "madeira", letreiro: "be2beauty", faixa: "#13315C" },
      produtos: [],
      atendente: { avatar: "Male_Adult_06", nome: "Larissa", cor: "#13315C" },
      previa: false,
    },
    cx: 15.8,
    cz: -54.5,
    site: {
      estilo: "profissional",
      logo: [
        { texto: "BE2", sufixo: "BEAUTY", destaque: true },
        { texto: "ONLY PROFESSIONAL", destaque: false },
      ],
      fraseVitrine: "Only professional.",
      corPrimaria: "#1F5FA8",
      corEscura: "#13315C",
      modeloAtendente: "atendente-azul.glb",
    },
  },
];

// ---- lojas montadas pelo visitante (prévia, só neste aparelho)

export type CategoriaPrevia = keyof typeof textos.editor.categorias;

export interface LojaPrevia {
  nome: string;
  slogan: string;
  primaria: string;
  parede: string;
  piso: Piso;
  letra: "moderna" | "classica" | "forte";
  categoria: CategoriaPrevia;
}

const CHAVE = "shopping3d.lojas";

export function lerPrevias(): Record<string, LojaPrevia> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}");
  } catch {
    return {};
  }
}

export function gravarPrevia(unidade: string, loja: LojaPrevia | null) {
  try {
    const todas = lerPrevias();
    if (loja) todas[unidade] = loja;
    else delete todas[unidade];
    localStorage.setItem(CHAVE, JSON.stringify(todas));
  } catch {
    /* navegador sem armazenamento: a loja vale só até fechar */
  }
}

const CATEGORIA_DO_CATALOGO: Record<CategoriaPrevia, string[]> = {
  cabelos: ["cabelos"],
  maquiagem: ["maquiagem"],
  skincare: ["skincare"],
  corpo: ["corpo-e-banho", "perfumaria"],
};

const AVATAR_PREVIA = ["Female_Adult_17", "Male_Adult_10", "Female_Adult_13", "Male_Adult_16", "Female_Adult_03"];

/** clareia uma cor (mistura com branco) */
export function clarear(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function inquilinoDaPrevia(unidade: string, p: LojaPrevia, i: number): Inquilino {
  const cats = CATEGORIA_DO_CATALOGO[p.categoria] ?? ["cabelos"];
  const produtos = todosProdutos()
    .filter((x) => x.categorias.some((c) => cats.includes(c)))
    .slice(0, 48);
  return {
    id: `previa-${unidade}`,
    nome: p.nome.trim() || textos.editor.nomePadrao,
    slogan: p.slogan.trim(),
    unidade,
    estilo: { primaria: p.primaria, secundaria: clarear(p.primaria, 0.86), parede: p.parede, piso: p.piso, letreiro: p.letra, faixa: p.primaria },
    produtos,
    atendente: { avatar: AVATAR_PREVIA[i % AVATAR_PREVIA.length], nome: "Atendente", cor: p.primaria },
    previa: true,
  };
}

/** quem está em cada unidade agora (undefined = para alugar) */
export function ocupacao(): Map<string, Inquilino> {
  const mapa = new Map<string, Inquilino>();
  for (const q of MARCAS_DO_GRUPO) mapa.set(q.unidade, q);
  for (const a of ANCORAS) mapa.set(a.inquilino.unidade, a.inquilino);
  Object.entries(lerPrevias()).forEach(([u, p], i) => {
    if (!mapa.has(u) && UNIDADES.some((x) => x.numero === u)) mapa.set(u, inquilinoDaPrevia(u, p, i));
  });
  return mapa;
}

export const unidade = (numero: string) => UNIDADES.find((u) => u.numero === numero)!;
