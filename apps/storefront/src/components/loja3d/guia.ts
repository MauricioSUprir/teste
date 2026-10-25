/**
 * Guia "onde fica?": setinhas acesas no chão do lugar onde a pessoa está até a
 * prateleira do produto (ou a seção da marca), com uma onda de luz correndo
 * na direção certa, um anel no ponto de chegada e uma seta boiando em cima do
 * produto. O caminho é o mesmo A* que a cena usa para andar (desvia dos móveis).
 */
import * as THREE from "three";

export interface PontoGuia {
  x: number;
  z: number;
}

export interface Guia {
  grupo: THREE.Group;
  /** desenha a trilha (pontos no chão, do começo ao fim) e a seta sobre `alvo`; `tamanho` > 1 para ver de cima */
  mostrar: (pontos: PontoGuia[], alvo: THREE.Vector3 | null, tamanho?: number) => void;
  esconder: () => void;
  atualizar: (dt: number) => void;
  descartar: () => void;
}

const MAX = 400;
const ESPACO = 0.42; // metros entre setas

export function criarGuia(cor: THREE.Color): Guia {
  const grupo = new THREE.Group();
  grupo.visible = false;
  // seta em "V" deitada no chão, apontando para +z
  const forma = new THREE.Shape();
  forma.moveTo(-0.15, -0.06);
  forma.lineTo(0, 0.08);
  forma.lineTo(0.15, -0.06);
  forma.lineTo(0.15, -0.13);
  forma.lineTo(0, 0.0);
  forma.lineTo(-0.15, -0.13);
  forma.closePath();
  const geoSeta = new THREE.ShapeGeometry(forma).rotateX(-Math.PI / 2);
  geoSeta.scale(1, 1, -1); // o y da forma vira -z ao deitar; desvira para a ponta olhar +z
  const acesa = cor.clone().multiplyScalar(2.6);
  const matSeta = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const setas = new THREE.InstancedMesh(geoSeta, matSeta, MAX);
  setas.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  setas.count = 0;
  setas.frustumCulled = false;
  setas.renderOrder = 4;
  grupo.add(setas);

  const matAnel = new THREE.MeshBasicMaterial({ color: acesa, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 48).rotateX(-Math.PI / 2), matAnel);
  anel.renderOrder = 4;
  grupo.add(anel);
  const matSetaAlta = new THREE.MeshBasicMaterial({ color: acesa });
  const setaAlta = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 20).rotateX(Math.PI), matSetaAlta);
  grupo.add(setaAlta);

  const distancias: number[] = [];
  let fim = new THREE.Vector3();
  let alturaSeta = 0;
  let t = 0;
  const auxM = new THREE.Matrix4();
  const auxQ = new THREE.Quaternion();
  const auxP = new THREE.Vector3();
  const escala = new THREE.Vector3(1, 1, 1);
  const eixoY = new THREE.Vector3(0, 1, 0);

  function mostrar(pontos: PontoGuia[], alvo: THREE.Vector3 | null, tamanho = 1) {
    escala.setScalar(tamanho);
    anel.scale.setScalar(tamanho);
    distancias.length = 0;
    let n = 0;
    let andado = 0;
    let proxima = 0.7; // não desenha embaixo da pessoa
    for (let k = 1; k < pontos.length && n < MAX; k++) {
      const a = pontos[k - 1];
      const b = pontos[k];
      const comp = Math.hypot(b.x - a.x, b.z - a.z);
      if (comp < 1e-4) continue;
      const ang = Math.atan2(b.x - a.x, b.z - a.z);
      while (proxima <= andado + comp && n < MAX) {
        const f = (proxima - andado) / comp;
        auxP.set(a.x + (b.x - a.x) * f, 0.012, a.z + (b.z - a.z) * f);
        setas.setMatrixAt(n, auxM.compose(auxP, auxQ.setFromAxisAngle(eixoY, ang), escala));
        distancias.push(proxima);
        n++;
        proxima += ESPACO;
      }
      andado += comp;
    }
    setas.count = n;
    setas.instanceMatrix.needsUpdate = true;
    const ultimo = pontos[pontos.length - 1];
    fim = new THREE.Vector3(ultimo.x, 0.011, ultimo.z);
    anel.position.copy(fim);
    setaAlta.visible = !!alvo;
    if (alvo) {
      setaAlta.position.copy(alvo);
      alturaSeta = alvo.y;
    }
    grupo.visible = true;
  }

  const auxC = new THREE.Color();
  function atualizar(dt: number) {
    if (!grupo.visible) return;
    t += dt;
    // onda de luz andando para a frente (3 m/s), uma a cada 2,4 m
    for (let k = 0; k < setas.count; k++) {
      const fase = (((distancias[k] - t * 3) % 2.4) + 2.4) % 2.4;
      const onda = Math.max(0, 1 - Math.abs(fase - 1.2) / 0.6);
      auxC.copy(acesa).multiplyScalar(0.6 + 0.4 * onda); // onda suave: piscar forte parecia defeito
      setas.setColorAt(k, auxC);
    }
    if (setas.instanceColor) setas.instanceColor.needsUpdate = true;
    const pulso = (1 + 0.12 * Math.sin(t * 4)) * escala.x;
    anel.scale.set(pulso, 1, pulso);
    matAnel.opacity = 0.55 + 0.3 * Math.sin(t * 4);
    setaAlta.position.y = alturaSeta + 0.42 + Math.sin(t * 3) * 0.05;
    setaAlta.rotation.y += dt * 1.5;
  }

  return {
    grupo,
    mostrar,
    esconder: () => {
      grupo.visible = false;
    },
    atualizar,
    descartar: () => {
      geoSeta.dispose();
      setas.dispose();
      matSeta.dispose();
      anel.geometry.dispose();
      matAnel.dispose();
      setaAlta.geometry.dispose();
      matSetaAlta.dispose();
    },
  };
}
