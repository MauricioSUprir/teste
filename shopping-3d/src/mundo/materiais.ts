/**
 * Materiais do prédio, criados uma vez e repartidos entre a galeria e as lojas.
 * Tudo PBR (MeshStandard) para pegar o reflexo do ambiente; luzes de teto são
 * emissivas acima de 1 para acenderem no brilho (bloom).
 */
import * as THREE from "three";
import { texturasMadeira, texturasPorcelanato } from "./texturas";
import { corParaTexturas, normalAgua, normalGesso, texturasCimento } from "./texturas-shopping";

/** alta: computador (reflexo no piso); media: celular; baixa: sem sombra do sol; minima: sem brilho também */
export type Qualidade = "alta" | "media" | "baixa" | "minima";

function repetir(t: THREE.Texture, metros: number) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metros, 1 / metros);
  return t;
}

export function criarMateriais(qualidade: Qualidade) {
  const lado = qualidade === "alta" ? 1024 : 512;
  const porc = texturasPorcelanato({ lado, base: corParaTexturas("#efeae3"), veio: corParaTexturas("#b8ada2"), rejunte: corParaTexturas("#d2c9bf"), placa: 1.2, veios: 4, semente: 11 });
  const pisoGaleria = new THREE.MeshStandardMaterial({
    map: repetir(porc.cor, porc.metros),
    normalMap: repetir(porc.normal, porc.metros),
    roughnessMap: repetir(porc.rugosidade, porc.metros),
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.9,
  });
  const porcBranco = texturasPorcelanato({ lado: 512, base: corParaTexturas("#f6f4f1"), veio: corParaTexturas("#d4cdc6"), rejunte: corParaTexturas("#e0dad3"), placa: 0.9, veios: 2, semente: 23 });
  const pisoPorcelanato = new THREE.MeshStandardMaterial({
    map: repetir(porcBranco.cor, porcBranco.metros),
    normalMap: repetir(porcBranco.normal, porcBranco.metros),
    roughnessMap: repetir(porcBranco.rugosidade, porcBranco.metros),
    roughness: 1,
    envMapIntensity: 0.9,
  });
  const mad = texturasMadeira({ clara: corParaTexturas("#c89f73"), escura: corParaTexturas("#8a6040"), semente: 5 });
  const pisoMadeira = new THREE.MeshStandardMaterial({ map: repetir(mad.cor, mad.metros), normalMap: repetir(mad.normal, mad.metros), roughness: 0.55, envMapIntensity: 0.8 });
  const cim = texturasCimento("#b9b4ad", 3, lado === 1024 ? 512 : 256);
  const pisoCimento = new THREE.MeshStandardMaterial({ map: repetir(cim.cor, cim.metros), normalMap: repetir(cim.normal, cim.metros), roughnessMap: repetir(cim.rugosidade, cim.metros), roughness: 1, envMapIntensity: 0.8 });
  const cimCru = texturasCimento("#9d978f", 9, 256);
  const pisoObra = new THREE.MeshStandardMaterial({ map: repetir(cimCru.cor, cimCru.metros), normalMap: repetir(cimCru.normal, cimCru.metros), roughness: 0.92 });

  const nGesso = repetir(normalGesso(4), 3);
  const gesso = new THREE.MeshStandardMaterial({ color: "#ece7e1", roughness: 0.92, normalMap: nGesso, normalScale: new THREE.Vector2(0.6, 0.6) });
  const madeiraBanco = texturasMadeira({ clara: corParaTexturas("#b98a5c"), escura: corParaTexturas("#7a5235"), semente: 8 });
  const agua = normalAgua(2);
  agua.wrapS = agua.wrapT = THREE.RepeatWrapping;
  agua.repeat.set(2, 2);

  const m = {
    pisoGaleria,
    pisos: { porcelanato: pisoPorcelanato, madeira: pisoMadeira, cimento: pisoCimento } as Record<"porcelanato" | "madeira" | "cimento", THREE.MeshStandardMaterial>,
    pisoObra,
    gesso,
    teto: new THREE.MeshStandardMaterial({ color: "#fbfaf8", roughness: 0.95 }),
    pedra: new THREE.MeshStandardMaterial({ color: "#e9e3dc", roughness: 0.45, envMapIntensity: 0.9 }),
    pedraEscura: new THREE.MeshStandardMaterial({ color: "#5a5058", roughness: 0.35, envMapIntensity: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: "#2b2b30", metalness: 0.75, roughness: 0.32 }),
    aco: new THREE.MeshStandardMaterial({ color: "#c9c9cc", metalness: 1, roughness: 0.25 }),
    dourado: new THREE.MeshStandardMaterial({ color: "#d9a98a", metalness: 1, roughness: 0.22 }),
    vidro: new THREE.MeshStandardMaterial({ color: "#d8e9ee", metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide }),
    vidroCeu: new THREE.MeshStandardMaterial({ color: "#e6f2f7", metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    // vidro jateado iluminado por trás (2º piso, fachada da entrada)
    vidroFosco: new THREE.MeshStandardMaterial({ color: "#ebe5de", emissive: "#fff4e6", emissiveIntensity: 0.55, roughness: 0.6 }),
    luz: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.8, 4.4) }),
    luzQuente: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.9, 2.7) }),
    madeira: new THREE.MeshStandardMaterial({ map: repetir(madeiraBanco.cor, madeiraBanco.metros), normalMap: repetir(madeiraBanco.normal, madeiraBanco.metros), roughness: 0.6 }),
    concreto: new THREE.MeshStandardMaterial({ color: "#d3ccc3", roughness: 0.85 }),
    terra: new THREE.MeshStandardMaterial({ color: "#3b2b20", roughness: 1 }),
    agua: new THREE.MeshStandardMaterial({ color: "#2d7fa3", roughness: 0.04, metalness: 0.1, normalMap: agua, normalScale: new THREE.Vector2(0.5, 0.5), transparent: true, opacity: 0.88, envMapIntensity: 1.8 }),
    jato: new THREE.MeshStandardMaterial({ color: "#eaf6ff", emissive: "#bfe6ff", emissiveIntensity: 0.25, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }),
    tecidoCortina: new THREE.MeshStandardMaterial({ color: "#5b2b7a", roughness: 0.85, side: THREE.DoubleSide }),
    espelho: new THREE.MeshStandardMaterial({ color: "#e9eef2", metalness: 1, roughness: 0.06, envMapIntensity: 2.4 }),
    branco: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
    // ---- átrio e fachada (Beauty Shopping)
    /** piso das varandas: o mesmo porcelanato, sem o reflexo (que é só do térreo) */
    pisoVaranda: pisoGaleria.clone(),
    /** testeiras, pilares e escadas: branco laqueado, as duas faces (fitas curvas) */
    fachadaBranca: new THREE.MeshStandardMaterial({ color: "#f7f5f8", roughness: 0.3, envMapIntensity: 1, side: THREE.DoubleSide }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.9, 2.7), side: THREE.DoubleSide }),
    ledLilas: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.2, 5), side: THREE.DoubleSide }),
    lilas: new THREE.MeshStandardMaterial({ color: "#b48fd8", roughness: 0.4, emissive: "#5b2f78", emissiveIntensity: 0.18 }),
    roxo: new THREE.MeshStandardMaterial({ color: "#6f2a93", roughness: 0.3, metalness: 0.1, envMapIntensity: 1.2 }),
    tecidoLilas: new THREE.MeshStandardMaterial({ color: "#bba0dc", roughness: 0.92, side: THREE.DoubleSide }),
    corrimao: new THREE.MeshStandardMaterial({ color: "#1d1b20", roughness: 0.45 }),
  };
  return m;
}

export type Materiais = ReturnType<typeof criarMateriais>;
