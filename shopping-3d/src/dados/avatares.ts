/**
 * Os avatares do provador: 16 pessoas do Microsoft Rocketbox (licença MIT,
 * ver public/modelos/LICENCA-ROCKETBOX.txt), convertidas para a web com a
 * máscara da roupa (vermelho = parte de cima, verde = parte de baixo) que
 * deixa cada visitante trocar a cor da blusa e da calça.
 *
 * corCima / corBaixo: cor média original de cada peça (null = a peça não troca de cor,
 * como o vestido de uma peça só). temCabelo: o cabelo é uma malha à parte e pode ser pintado.
 */
export interface InfoAvatar {
  id: string;
  genero: "f" | "m";
  altura: number;
  temCabelo: boolean;
  corCima: string | null;
  corBaixo: string | null;
}

export const AVATARES: InfoAvatar[] = [
  { id: "Female_Adult_01", genero: "f", altura: 1.743, temCabelo: true, corCima: "#b86470", corBaixo: "#394f5b" },
  { id: "Male_Adult_04", genero: "m", altura: 1.869, temCabelo: true, corCima: "#282a26", corBaixo: "#353127" },
  { id: "Female_Party_02", genero: "f", altura: 1.79, temCabelo: true, corCima: "#3e312d", corBaixo: null },
  { id: "Male_Adult_01", genero: "m", altura: 1.824, temCabelo: true, corCima: "#aaa096", corBaixo: "#94825e" },
  { id: "Female_Adult_03", genero: "f", altura: 1.739, temCabelo: true, corCima: "#7c3a73", corBaixo: "#1d1a19" },
  { id: "Male_Adult_12", genero: "m", altura: 1.807, temCabelo: false, corCima: "#3b4249", corBaixo: "#5b676e" },
  { id: "Female_Adult_17", genero: "f", altura: 1.751, temCabelo: true, corCima: "#629775", corBaixo: "#7795a1" },
  { id: "Male_Adult_09", genero: "m", altura: 1.822, temCabelo: true, corCima: "#222127", corBaixo: "#5b676a" },
  { id: "Female_Adult_11", genero: "f", altura: 1.736, temCabelo: true, corCima: "#2a1a14", corBaixo: null },
  { id: "Male_Adult_06", genero: "m", altura: 1.831, temCabelo: true, corCima: "#9e2b29", corBaixo: "#22292a" },
  { id: "Female_Adult_05", genero: "f", altura: 1.736, temCabelo: true, corCima: "#c69f99", corBaixo: "#314a55" },
  { id: "Male_Adult_17", genero: "m", altura: 1.812, temCabelo: false, corCima: "#364f70", corBaixo: "#283234" },
  { id: "Female_Adult_13", genero: "f", altura: 1.752, temCabelo: true, corCima: "#3e3c39", corBaixo: "#2f3b47" },
  { id: "Male_Adult_10", genero: "m", altura: 1.831, temCabelo: true, corCima: "#6c2725", corBaixo: "#252525" },
  { id: "Female_Adult_12", genero: "f", altura: 1.727, temCabelo: true, corCima: "#1d1f1a", corBaixo: "#2e3233" },
  { id: "Male_Adult_16", genero: "m", altura: 1.809, temCabelo: false, corCima: "#3f556f", corBaixo: "#505e67" },
];

/** velocidade da animação de andar (m/s) e do esqueleto de cada gênero */
export const ANIMACAO = {
  f: { velocidade: 1.214 },
  m: { velocidade: 1.012 },
};

export const infoAvatar = (id: string) => AVATARES.find((a) => a.id === id) ?? AVATARES[0];
