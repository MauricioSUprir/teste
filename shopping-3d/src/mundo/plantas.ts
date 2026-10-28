/**
 * Plantas de verdade na loja 3D: três modelos escaneados do Poly Haven
 * (licença CC0 — uso livre, inclusive comercial, sem precisar dar crédito),
 * enxugados para a web (menos triângulos, fotos de 512 px, compressão
 * meshopt): ~500 KB no total.
 *
 *  - grande  (singônio, das folhas do potted_plant_02) num vaso alto da loja;
 *  - media   (antúrio, anthurium_botany_01 "b") num vaso baixo;
 *  - pequena (haworthia no vasinho branco, potted_plant_04, inteira).
 *
 * Cada tipo vira uma malha instanciada (uma chamada de desenho para todas as
 * plantas iguais). Se o modelo não baixar, entra uma folhagem simples no lugar.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type TipoPlanta = "grande" | "media" | "pequena";

export interface LugarPlanta {
  tipo: TipoPlanta;
  /** onde a origem do modelo fica (base da folhagem / do vasinho) */
  matriz: THREE.Matrix4;
}

/** altura da "terra" dentro de cada modelo: é onde ele encosta na boca do vaso */
export const TERRA_DO_MODELO: Record<TipoPlanta, number> = { grande: 0.32, media: 0, pequena: 0 };

/** folhagem de bolinhas (a planta antiga), para quando o modelo não chega */
function folhagemDeReserva(tipo: TipoPlanta) {
  const bolas: [number, number, number, number][] =
    tipo === "pequena"
      ? [
          [0, 0.2, 0, 0.07],
          [0.04, 0.18, 0.03, 0.05],
          [-0.04, 0.19, -0.02, 0.05],
        ]
      : [
          [0, 0.75, 0, 0.3],
          [0.16, 0.6, 0.05, 0.22],
          [-0.15, 0.65, -0.06, 0.24],
          [0.04, 0.95, -0.1, 0.22],
          [-0.06, 0.52, 0.14, 0.2],
        ];
  const escala = tipo === "media" ? 0.45 : 1;
  const geos = bolas.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r * escala, 1).translate(x * escala, y * escala, z * escala));
  const geo = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return geo;
}

export interface Plantas {
  grupo: THREE.Group;
  descartar: () => void;
}

/** baixa os modelos e põe uma planta em cada lugar; `camadas` = camadas da luz assada */
export async function carregarPlantas(base: string, lugares: LugarPlanta[], camadas: number[]): Promise<Plantas> {
  const grupo = new THREE.Group();
  const lixo: { dispose: () => void }[] = [];
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const tipos = [...new Set(lugares.map((l) => l.tipo))];
  const auxM = new THREE.Matrix4();

  function instanciar(geo: THREE.BufferGeometry, material: THREE.Material, local: THREE.Matrix4, meus: LugarPlanta[]) {
    const malha = new THREE.InstancedMesh(geo, material, meus.length);
    meus.forEach((l, k) => malha.setMatrixAt(k, auxM.multiplyMatrices(l.matriz, local)));
    malha.castShadow = true;
    malha.receiveShadow = true;
    for (const c of camadas) malha.layers.enable(c);
    malha.computeBoundingSphere();
    grupo.add(malha);
    lixo.push(malha);
  }

  await Promise.all(
    tipos.map(async (tipo) => {
      const meus = lugares.filter((l) => l.tipo === tipo);
      try {
        const gltf = await loader.loadAsync(`${base}planta-${tipo}.glb`);
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const m = o.material as THREE.MeshStandardMaterial;
          // folha fina: as duas faces; um pouco de luz própria para não ficar preta na sombra
          m.side = THREE.DoubleSide;
          m.envMapIntensity = 1.4;
          lixo.push(o.geometry, m);
          for (const t of [m.map, m.normalMap, m.roughnessMap, m.aoMap]) if (t) lixo.push(t);
          instanciar(o.geometry, m, o.matrixWorld.clone(), meus);
        });
      } catch {
        const geo = folhagemDeReserva(tipo);
        const m = new THREE.MeshStandardMaterial({ color: "#58884a", roughness: 0.75, flatShading: true });
        lixo.push(geo, m);
        instanciar(geo, m, new THREE.Matrix4(), meus);
      }
    })
  );
  return { grupo, descartar: () => lixo.forEach((x) => x.dispose()) };
}
