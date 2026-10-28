/**
 * Ajuda para montar a arquitetura com poucas chamadas de desenho: as peças
 * do mesmo material entram num "lote" e viram uma malha só no fim.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { soltarGeometria } from "./memoria";

export interface OpcoesLote {
  sombra?: boolean;
  recebe?: boolean;
}

export class Lotes {
  private pecas = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; op: OpcoesLote }>();
  readonly grupo = new THREE.Group();

  adicionar(material: THREE.Material, geo: THREE.BufferGeometry, op: OpcoesLote = {}) {
    let p = this.pecas.get(material);
    if (!p) {
      p = { geos: [], op };
      this.pecas.set(material, p);
    }
    // todas as peças do lote precisam dos mesmos atributos
    if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((geo.attributes.position.count) * 2), 2));
    if (geo.index) geo = geo.toNonIndexed();
    p.geos.push(geo);
  }

  /** caixa com o centro em (x, y, z) */
  caixa(material: THREE.Material, l: number, a: number, p: number, x: number, y: number, z: number, op?: OpcoesLote, rotY = 0) {
    const g = new THREE.BoxGeometry(l, a, p);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this.adicionar(material, g, op);
  }

  /** caixa pelos cantos (x0..x1, y0..y1, z0..z1); uv em metros (textura que repete) */
  bloco(material: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, op?: OpcoesLote) {
    const l = Math.abs(x1 - x0);
    const a = Math.abs(y1 - y0);
    const p = Math.abs(z1 - z0);
    const g = new THREE.BoxGeometry(l, a, p);
    uvEmMetros(g);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.adicionar(material, g, op);
  }

  fechar() {
    for (const [material, { geos, op }] of this.pecas) {
      const geo = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      // peça fixa: no celular a geometria só fica na placa de vídeo
      soltarGeometria(geo);
      const m = new THREE.Mesh(geo, material);
      m.castShadow = !!op.sombra;
      m.receiveShadow = op.recebe ?? true;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.grupo.add(m);
    }
    this.pecas.clear();
    return this.grupo;
  }
}

/** uv de cada face = tamanho real da face em metros (para textura que repete) */
export function uvEmMetros(g: THREE.BufferGeometry) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ny > 0.5) uv.setXY(i, x, z);
    else if (nx > 0.5) uv.setXY(i, z, y);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
}

/** plano no chão (y fixo) de x0..x1, z0..z1 com uv em metros, virado para cima */
export function planoChao(x0: number, z0: number, x1: number, z1: number, y = 0) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
  return g;
}

/** plano de teto (virado para baixo) */
export function planoTeto(x0: number, z0: number, x1: number, z1: number, y: number) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return g;
}

/** placa com textura (quadro, letreiro, tela), centro em (x, y, z), virada para o ângulo rotY (0 = +z) */
export function placa(material: THREE.Material, l: number, a: number, x: number, y: number, z: number, rotY: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(l, a), material);
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  return m;
}
