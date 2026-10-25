/**
 * Piso e paredes da loja 3D: reflexo de verdade no porcelanato e luz assada.
 *
 * Reflexo — a cena é desenhada de novo, espelhada no plano do chão, numa
 * imagem menor (meia tela); o piso mistura essa imagem com a própria cor pelo
 * ângulo de visão (Fresnel: quanto mais rasante o olhar, mais o piso espelha),
 * entortada pelo relevo do rejunte e um pouco desfocada. É o mesmo truque dos
 * espelhos d'água dos jogos.
 *
 * Luz assada — o piso e as paredes leem a textura de luz-assada.ts (sombra
 * suave embaixo dos móveis e as poças de luz dos spots do teto) pela posição
 * no mundo; até ela ficar pronta, o shader usa luz neutra.
 */
import * as THREE from "three";

export interface Reflexo {
  textura: THREE.Texture;
  /** posição no mundo → coordenada na imagem do reflexo */
  matriz: THREE.Matrix4;
  /** desenha a cena espelhada no chão (y = altura); some com `esconder` enquanto isso */
  atualizar: (cena: THREE.Scene, camera: THREE.PerspectiveCamera, esconder: THREE.Object3D[]) => void;
  redimensionar: (largura: number, altura: number) => void;
  descartar: () => void;
}

export function criarReflexo(renderer: THREE.WebGLRenderer, altura = 0): Reflexo {
  const alvo = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const virtual = new THREE.PerspectiveCamera();
  const matriz = new THREE.Matrix4();
  const normal = new THREE.Vector3(0, 1, 0);
  const noPlano = new THREE.Vector3(0, altura, 0);
  const plano = new THREE.Plane();
  const posCamera = new THREE.Vector3();
  const rotacao = new THREE.Matrix4();
  const vista = new THREE.Vector3();
  const olhar = new THREE.Vector3();
  const alvoOlhar = new THREE.Vector3();
  const corte = new THREE.Vector4();
  const q = new THREE.Vector4();

  function atualizar(cena: THREE.Scene, camera: THREE.PerspectiveCamera, esconder: THREE.Object3D[]) {
    posCamera.setFromMatrixPosition(camera.matrixWorld);
    vista.subVectors(noPlano, posCamera);
    if (vista.dot(normal) > 0) return; // câmera abaixo do chão: nada a refletir
    vista.reflect(normal).negate().add(noPlano);
    rotacao.extractRotation(camera.matrixWorld);
    olhar.set(0, 0, -1).applyMatrix4(rotacao).add(posCamera);
    alvoOlhar.subVectors(noPlano, olhar).reflect(normal).negate().add(noPlano);
    virtual.position.copy(vista);
    virtual.up.set(0, 1, 0).applyMatrix4(rotacao).reflect(normal);
    virtual.lookAt(alvoOlhar);
    virtual.far = camera.far;
    virtual.updateMatrixWorld();
    virtual.projectionMatrix.copy(camera.projectionMatrix);
    matriz.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    matriz.multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);

    // plano de corte oblíquo: nada abaixo do chão entra no reflexo
    plano.setFromNormalAndCoplanarPoint(normal, noPlano).applyMatrix4(virtual.matrixWorldInverse);
    corte.set(plano.normal.x, plano.normal.y, plano.normal.z, plano.constant);
    const p = virtual.projectionMatrix.elements;
    q.set((Math.sign(corte.x) + p[8]) / p[0], (Math.sign(corte.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
    corte.multiplyScalar(2 / corte.dot(q));
    p[2] = corte.x;
    p[6] = corte.y;
    p[10] = corte.z + 1 - 0.003;
    p[14] = corte.w;
    virtual.projectionMatrixInverse.copy(virtual.projectionMatrix).invert();

    const visiveis = esconder.map((o) => o.visible);
    esconder.forEach((o) => (o.visible = false));
    const antes = renderer.getRenderTarget();
    renderer.setRenderTarget(alvo);
    renderer.clear();
    renderer.render(cena, virtual);
    renderer.setRenderTarget(antes);
    esconder.forEach((o, i) => (o.visible = visiveis[i]));
  }

  return {
    textura: alvo.texture,
    matriz,
    atualizar,
    redimensionar: (l, a) => alvo.setSize(Math.max(1, Math.round(l)), Math.max(1, Math.round(a))),
    descartar: () => alvo.dispose(),
  };
}

/** retângulo do mundo que recebe luz assada: p = origem + eixoU·u + eixoV·v, com u e v de 0 a 1 */
export interface Receptor {
  origem: THREE.Vector3;
  eixoU: THREE.Vector3;
  eixoV: THREE.Vector3;
  /** para onde a face olha (para dentro da loja) */
  normal: THREE.Vector3;
}

export interface OpcoesSuperficie {
  reflexo?: Reflexo;
  /** um a três receptores; o shader escolhe pelo lado para onde a face olha */
  receptores?: Receptor[];
}

/** valores que a cena mexe a cada mudança de qualidade (os mesmos objetos em todos os materiais) */
export const ajustesSuperficie = {
  forcaReflexo: { value: 0 },
  lodReflexo: { value: 1.2 },
  /** 0 = luz assada ainda não chegou; 1 = em uso */
  assadaPronta: { value: 0 },
  forcaSombra: { value: 0.75 },
  forcaSpots: { value: 0.12 },
  corSpots: { value: new THREE.Color("#fff1dd") },
};

/** liga reflexo e/ou luz assada num material físico do three (sem trocar o resto do shader) */
export function prepararSuperficie(material: THREE.MeshStandardMaterial, o: OpcoesSuperficie, texturasAssada: THREE.Texture[] = []) {
  const n = o.receptores?.length ?? 0;
  const uniforms: Record<string, THREE.IUniform> = {
    uForcaReflexo: ajustesSuperficie.forcaReflexo,
    uLodReflexo: ajustesSuperficie.lodReflexo,
    uAssadaPronta: ajustesSuperficie.assadaPronta,
    uForcaSombra: ajustesSuperficie.forcaSombra,
    uForcaSpots: ajustesSuperficie.forcaSpots,
    uCorSpots: ajustesSuperficie.corSpots,
  };
  if (o.reflexo) {
    uniforms.uReflexo = { value: o.reflexo.textura };
    uniforms.uMatrizReflexo = { value: o.reflexo.matriz };
  }
  for (let i = 0; i < n; i++) {
    const r = o.receptores![i];
    uniforms[`uAssada${i}`] = { value: texturasAssada[i] ?? null };
    uniforms[`uOrigem${i}`] = { value: r.origem };
    uniforms[`uEixoU${i}`] = { value: r.eixoU.clone().divideScalar(r.eixoU.lengthSq()) };
    uniforms[`uEixoV${i}`] = { value: r.eixoV.clone().divideScalar(r.eixoV.lengthSq()) };
    uniforms[`uNormal${i}`] = { value: r.normal };
  }

  let declaracoes = "varying vec3 vPosMundo;\nuniform float uForcaReflexo;\nuniform float uLodReflexo;\nuniform float uAssadaPronta;\nuniform float uForcaSombra;\nuniform float uForcaSpots;\nuniform vec3 uCorSpots;\n";
  if (o.reflexo) declaracoes += "uniform sampler2D uReflexo;\nuniform mat4 uMatrizReflexo;\n";
  for (let i = 0; i < n; i++) declaracoes += `uniform sampler2D uAssada${i};\nuniform vec3 uOrigem${i};\nuniform vec3 uEixoU${i};\nuniform vec3 uEixoV${i};\nuniform vec3 uNormal${i};\n`;

  // luz assada: r = quanto do céu a superfície enxerga (1 = livre), g = luz dos spots
  let assada = "";
  if (n) {
    assada = "vec2 luzAssada = vec2(1.0, 0.0);\nvec3 nGeo = normalize(cross(dFdx(vPosMundo), dFdy(vPosMundo)));\n";
    for (let i = 0; i < n; i++) {
      assada += `{
        vec3 d = vPosMundo - uOrigem${i};
        vec2 uvA = vec2(dot(d, uEixoU${i}), dot(d, uEixoV${i}));
        if (abs(dot(nGeo, uNormal${i})) > 0.7 && abs(dot(d, uNormal${i})) < 0.06 && uvA.x > 0.0 && uvA.x < 1.0 && uvA.y > 0.0 && uvA.y < 1.0) luzAssada = texture2D(uAssada${i}, uvA).rg;
      }\n`;
    }
    assada += `luzAssada = mix(vec2(1.0, 0.0), luzAssada, uAssadaPronta);
      float sombraAssada = mix(1.0, luzAssada.r, uForcaSombra);
      reflectedLight.directDiffuse *= mix(1.0, sombraAssada, 0.65);
      reflectedLight.indirectDiffuse *= sombraAssada;
      reflectedLight.indirectSpecular *= mix(1.0, sombraAssada, 0.6);
      reflectedLight.directDiffuse += diffuseColor.rgb * uCorSpots * luzAssada.g * uForcaSpots * mix(1.0, luzAssada.r, 0.4);\n`;
  }

  // reflexo: Fresnel de porcelanato (f0 ≈ 0,05), entortado pelo relevo e só onde o piso é liso
  const reflexo = o.reflexo
    ? `if (uForcaReflexo > 0.0) {
        vec4 pr = uMatrizReflexo * vec4(vPosMundo, 1.0);
        vec3 nMundo = inverseTransformDirection(normal, viewMatrix);
        vec2 uvR = pr.xy / pr.w + nMundo.xz * 0.035;
        vec3 corR = textureLod(uReflexo, uvR, uLodReflexo + roughnessFactor * 5.0).rgb;
        float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        float fresnel = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
        // limitado: de longe o piso vira espelho e o teto claro estouraria a imagem
        float k = uForcaReflexo * min(fresnel, 0.32) * (1.0 - smoothstep(0.2, 0.55, roughnessFactor));
        ${n ? "k *= mix(1.0, luzAssada.r, 0.5);" : ""}
        outgoingLight = outgoingLight * (1.0 - k * 0.8) + corR * k;
      }\n`
    : "";

  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosMundo;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${declaracoes}`)
      .replace("#include <aomap_fragment>", `#include <aomap_fragment>\n${assada}`)
      .replace("#include <opaque_fragment>", `${reflexo}#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `superficie-${o.reflexo ? 1 : 0}-${n}`;
  /** troca as texturas assadas quando ficam prontas */
  return (texturas: THREE.Texture[]) => texturas.forEach((t, i) => uniforms[`uAssada${i}`] && (uniforms[`uAssada${i}`].value = t));
}
