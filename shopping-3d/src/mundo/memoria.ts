/**
 * No celular a memória é curta (o Safari do iPhone fecha a página quando
 * passa do limite). O que já foi para a placa de vídeo não precisa ficar
 * também na memória do navegador: as texturas desenhadas em canvas e a
 * geometria das peças fixas do prédio soltam a cópia de cá logo depois do
 * primeiro envio.
 *
 * É seguro porque nada disso muda depois de pronto, e se o aparelho
 * desligar o 3D a página recarrega inteira (main.ts) — nada é reenviado.
 * Não vale para o que é redesenhado (telão, logos que chegam depois),
 * nem para o que o cursor/toque precisa tocar (produtos, pessoas).
 */
import * as THREE from "three";

let ativo = false;

export function aliviarMemoria(sim: boolean) {
  ativo = sim;
}

/** depois do envio, o canvas da textura vira 1 × 1 (o navegador devolve a memória na hora) */
export function soltarDepoisDeEnviar<T extends THREE.Texture>(t: T): T {
  if (!ativo) return t;
  t.onUpdate = () => {
    const img = t.image as HTMLCanvasElement | undefined;
    if (img && typeof (img as HTMLCanvasElement).getContext === "function") {
      img.width = 1;
      img.height = 1;
    }
    t.onUpdate = () => undefined;
  };
  return t;
}

/** depois do envio, os números da geometria (posições, normais, uv) saem da memória do navegador */
export function soltarGeometria(g: THREE.BufferGeometry) {
  if (!ativo) return;
  const atributos: (THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null)[] = [...Object.values(g.attributes), g.index];
  for (const a of atributos) {
    if (!(a instanceof THREE.BufferAttribute)) continue;
    a.onUpload(function (this: THREE.BufferAttribute) {
      // o three só lê o array de novo se alguém marcar needsUpdate (peça fixa: nunca)
      (this as unknown as { array: ArrayLike<number> | null }).array = null;
    });
  }
}
