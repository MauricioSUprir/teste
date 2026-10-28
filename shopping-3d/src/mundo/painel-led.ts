/**
 * Painel de LED na parede do fundo, atrás da atendente: passa o logo da loja e
 * os banners do site (os mesmos do carrossel da home, que o lojista troca no
 * painel admin), um de cada vez, com uma troca suave.
 *
 * A tela é um shader: mistura o slide atual com o próximo, encaixa cada arte
 * sem cortar (faixa preta onde sobra, como num telão de verdade) e desenha a
 * grade de pontos do LED só de perto — de longe a grade sumiria em pixels e
 * piscaria. O brilho fica abaixo do limite do brilho da cena (não vira névoa).
 */
import * as THREE from "three";

export interface PainelLed {
  grupo: THREE.Group;
  /** endereços dos banners (sem CORS liberado, o banner é pulado) */
  definirBanners: (urls: string[]) => void;
  atualizar: (dt: number) => void;
  descartar: () => void;
}

const SEGUNDOS_POR_SLIDE = 7;
const TROCA = 0.9; // segundos de transição

const vertice = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const fragmento = /* glsl */ `
uniform sampler2D tA;
uniform sampler2D tB;
uniform float uAspA;
uniform float uAspB;
uniform float uTela;
uniform float uMistura;
uniform float uColunas;
uniform float uBrilho;
varying vec2 vUv;
vec3 slide(sampler2D t, float asp) {
  vec2 p = vUv - 0.5;
  if (asp > uTela) p.y *= asp / uTela; else p.x *= uTela / asp;
  p += 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return vec3(0.0);
  return texture2D(t, p).rgb;
}
void main() {
  vec3 c = mix(slide(tA, uAspA), slide(tB, uAspB), uMistura);
  // grade de LED: some quando cada ponto fica menor que ~2 pixels na tela
  vec2 q = vUv * vec2(uColunas, uColunas / uTela);
  vec2 g = abs(fract(q) - 0.5);
  float ponto = 1.0 - smoothstep(0.36, 0.5, max(g.x, g.y));
  float nitidez = clamp(1.0 - max(fwidth(q.x), fwidth(q.y)) * 2.2, 0.0, 1.0);
  c *= mix(1.0, 0.72 + 0.28 * ponto, nitidez);
  gl_FragColor = vec4(c * uBrilho, 1.0);
}`;

/** carrega a arte e reduz para no máximo 1024 px de largura (memória da placa de vídeo) */
function carregar(url: string): Promise<{ tex: THREE.Texture; asp: number }> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      const w = Math.min(1024, img.width);
      const h = Math.round((w * img.height) / img.width);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")?.drawImage(img, 0, 0, w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      ok({ tex, asp: w / h });
    };
    img.onerror = () => falha(new Error("banner"));
    img.src = url;
  });
}

export function criarPainelLed(o: { largura: number; altura: number; primeiro: THREE.Texture; aspPrimeiro: number; moldura: THREE.Material }): PainelLed {
  const grupo = new THREE.Group();
  const slides: { tex: THREE.Texture; asp: number }[] = [{ tex: o.primeiro, asp: o.aspPrimeiro }];
  const material = new THREE.ShaderMaterial({
    vertexShader: vertice,
    fragmentShader: fragmento,
    uniforms: {
      tA: { value: o.primeiro },
      tB: { value: o.primeiro },
      uAspA: { value: o.aspPrimeiro },
      uAspB: { value: o.aspPrimeiro },
      uTela: { value: o.largura / o.altura },
      uMistura: { value: 0 },
      uColunas: { value: 360 },
      uBrilho: { value: 1.12 },
    },
  });
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(o.largura, o.altura), material);
  tela.position.z = 0.031;
  grupo.add(tela);
  // moldura fina e escura, como a de um telão
  const geoMoldura = new THREE.BoxGeometry(o.largura + 0.08, o.altura + 0.08, 0.06);
  const moldura = new THREE.Mesh(geoMoldura, o.moldura);
  moldura.castShadow = true;
  moldura.receiveShadow = true;
  grupo.add(moldura);

  let atual = 0;
  let tempo = 0;
  let trocando = -1; // índice do próximo durante a troca
  let carregando = false;
  const fila: string[] = [];
  const u = material.uniforms;

  function carregarProximo() {
    const url = fila.shift();
    if (!url) {
      carregando = false;
      return;
    }
    carregando = true;
    carregar(url)
      .then((s) => slides.push(s))
      .catch(() => {
        // banner sem CORS ou fora do ar: pula
      })
      .finally(carregarProximo);
  }

  return {
    grupo,
    definirBanners(urls) {
      fila.push(...urls);
      if (!carregando) carregarProximo();
    },
    atualizar(dt) {
      if (slides.length < 2) return;
      tempo += dt;
      if (trocando < 0 && tempo > SEGUNDOS_POR_SLIDE) {
        trocando = (atual + 1) % slides.length;
        u.tB.value = slides[trocando].tex;
        u.uAspB.value = slides[trocando].asp;
        tempo = 0;
      }
      if (trocando >= 0) {
        const k = Math.min(1, tempo / TROCA);
        u.uMistura.value = k * k * (3 - 2 * k);
        if (k >= 1) {
          atual = trocando;
          trocando = -1;
          u.tA.value = slides[atual].tex;
          u.uAspA.value = slides[atual].asp;
          u.uMistura.value = 0;
          tempo = 0;
        }
      }
    },
    descartar() {
      for (const s of slides.slice(1)) s.tex.dispose();
      material.dispose();
      tela.geometry.dispose();
      geoMoldura.dispose();
    },
  };
}
