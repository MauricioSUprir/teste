// "Modo deitado" forçado: quando o iPhone está com a rotação travada em retrato, o navegador nunca
// entra em paisagem. Nesse caso giramos o <body> inteiro 90° via CSS e convertemos as coordenadas de toque.
// rot = 0 (normal), 1 (girado 90° horário), -1 (girado 90° anti-horário)
export const viewport = { rot: 0 as 0 | 1 | -1 };

function screenSize() {
  return { w: document.documentElement.clientWidth || innerWidth, h: document.documentElement.clientHeight || innerHeight };
}

/** tamanho da área de jogo (já considerando a rotação forçada) */
export function viewSize() {
  const s = screenSize();
  return viewport.rot ? { w: s.h, h: s.w } : s;
}

/** converte coordenadas de tela (clientX/Y) para coordenadas da área de jogo */
export function toView(x: number, y: number) {
  const s = screenSize();
  if (viewport.rot === 1) return { x: y, y: s.w - x };
  if (viewport.rot === -1) return { x: s.h - y, y: x };
  return { x, y };
}

/** aplica a rotação no <body> (tamanho em px + variáveis de área segura trocadas) */
export function applyViewport(rot: 0 | 1 | -1) {
  viewport.rot = rot;
  const b = document.body;
  b.classList.toggle('forceland', rot !== 0);
  b.classList.toggle('rot-cw', rot === 1);
  b.classList.toggle('rot-ccw', rot === -1);
  if (rot) {
    const s = screenSize();
    b.style.setProperty('--gw', `${s.h}px`);
    b.style.setProperty('--gh', `${s.w}px`);
  } else {
    b.style.removeProperty('--gw');
    b.style.removeProperty('--gh');
  }
}
