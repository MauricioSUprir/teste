/**
 * Categoria de cada produto. O Hub não envia categoria: ela é deduzida do
 * nome do produto (e, no desempate, da marca). Usado pela sincronização e por
 * scripts/aplicar-correcoes.mjs. Ordem importa: termos mais específicos primeiro.
 *
 * Revisão 15/10: Nina e Byem são maquiagem (estavam como marcas de cabelo,
 * e batom, stick e pincel caíam em "Cabelos"); máquinas e aparadores
 * (Wahl) ganham regra própria; pincel, esponja e stick contam como maquiagem.
 */
export const REGRAS_CATEGORIA = [
  ["Máquinas e aparadores", /\b(m[aá]quina|aparador|trimmer|clipper|barbeador|secador|chapinha|prancha alisadora|escova rotativa|modelador de cachos)/i],
  // termos inequívocos de cabelo vêm antes — coloração/tonalizante/descolorante
  // caíam em Maquiagem/Beleza e "shampoo micelar" caía em Skincare (auditoria 20/08)
  ["Cabelos", /\b(shampoo|xampu|condicionador|colora[çc][aã]o|tonalizante|descolorante|oxidante|oxi \d|bruma capilar|hair|capilar|juba|mechas|matizador|desamarelador|progressiva|queratina|cachos|style stick|pomada|cera modeladora|pasta modeladora)/i],
  ["Unhas", /\b(esmalte|unha|cutícula|cuticula|alicate|manicure)/i],
  ["Skincare", /\b(skincare|facial|rosto|anti[- ]?idade|antimanchas|niacinamida|hialur[oô]nico|sérum facial|serum facial|acne|vitamina c|protetor solar|limpeza de pele|tônico facial|tonico facial|micelar|água thermal|agua thermal|cravos do nariz|retirar cravos)/i],
  ["Maquiagem", /\b(batom|bto|gloss|lipgloss|lip ?tint|base |base$|corretivo|blush|iluminador|highlighter|bronzer|primer|rimel|rímel|cilios|cílios|delineador|sombra|paleta|contorno|contour|bruma|pó (compacto|solto|facial)|po (compacto|solto|facial)|lip |matte|labial|sobrancelha|maquiagem|makeup|make |pincel|esponja|stick|rouge|lapiseira)/i],
  // "PERFUM SPRAY" (abreviado no Hub) também é perfume; "perfumado" não
  ["Perfumaria", /\b(perfume|perfum\b|colônia|colonia|body splash|eau de|desodorante col)/i],
  ["Corpo e Banho", /\b(bumbum|corporal|body |sabonete|esfoliante corporal|desodorante|banho|loção corporal|locao corporal|hidratante corporal|óleo corporal|oleo corporal)/i],
  ["Cabelos", /\b(máscara|mascara|leave[- ]?in|cabelo|finalizador|creme de pentear|gelatina|ampola|reconstru|hidrata|nutri|liso|frizz|termoprotetor|tônico capilar|tonico capilar|óleo|oleo|serum|botox)/i],
];
const MARCAS_MAQUINA = /wahl/i;
const MARCAS_CABELO = /k\.?pro|jacques|arvensis|widi|hidratei|senscience|joico|rebeel|evoly|d'?vence|moroccanoil|ricca/i;
const MARCAS_MAKE = /mari maria|oceane|issue|latika|nina|byem|bruna tavares|ruby rose/i;
// higiene bucal (Kess: gel, escova e fio dental) fica em Corpo e Banho
const MARCAS_CORPO = /kess|dentalclean/i;
// dermocosméticos: "Hidratante Reparador", "Serum Antiolheiras" e
// "Demaquilante em Óleo" são de rosto, não de cabelo (revisão 16/10)
const MARCAS_SKINCARE = /sallve|bioderma/i;
// Ruby Rose só tem maquiagem: "Serum Glow" não é sérum de cabelo
const MAKE_SEM_CABELO = /ruby rose/i;
const ULTIMA_REGRA = REGRAS_CATEGORIA.length - 1;

export function categorizar(nome, marca) {
  for (const [i, [categoria, regex]] of REGRAS_CATEGORIA.entries()) {
    if (!regex.test(nome)) continue;
    if (i === ULTIMA_REGRA && MARCAS_SKINCARE.test(marca)) return "Skincare";
    if (i === ULTIMA_REGRA && MAKE_SEM_CABELO.test(marca)) return "Maquiagem";
    return categoria;
  }
  if (MARCAS_SKINCARE.test(marca)) return "Skincare";
  if (MARCAS_MAQUINA.test(marca)) return "Máquinas e aparadores";
  if (MARCAS_CABELO.test(marca)) return "Cabelos";
  if (MARCAS_MAKE.test(marca)) return "Maquiagem";
  if (MARCAS_CORPO.test(marca)) return "Corpo e Banho";
  return "Beleza";
}
