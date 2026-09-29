// Carregador de modelos glTF otimizados (compressão meshopt; sem Draco/wasm extra).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function loadModel(url: string): Promise<THREE.Object3D | null> {
  try {
    const g = await loader.loadAsync(url);
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      // metais nunca "espelho" em Marte (poeira fina): rugosidade mínima 0,3
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const s = mat as THREE.MeshStandardMaterial;
        if (s.isMeshStandardMaterial) { s.roughness = Math.max(0.3, s.roughness); if (s.map) s.map.anisotropy = 4; }
      }
    });
    return g.scene;
  } catch (e) {
    console.warn('modelo não carregou', url, e);
    return null;
  }
}
