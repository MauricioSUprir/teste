/**
 * Padroniza as logos das marcas: mesma cor, fundo transparente, margens
 * cortadas e o mesmo tamanho de tela — pedido do Mauricio (13/10): "tem que
 * padronizar tanto em tamanho quanto em cor".
 *
 * Entrada: apps/storefront/public/logos-marcas/{slug}.{png,svg,webp}
 * Saída:   apps/storefront/public/logos-marcas/padrao/{slug}.png
 *
 * Como: a "tinta" de cada pixel é o quanto ele é escuro em relação ao fundo
 * (claro). Ela vira a transparência de um único tom grafite. Logos claras
 * (dourado, rosa) são realçadas até a tinta mais forte virar grafite cheio;
 * fundos quase brancos (cinza-claro) somem. Depois corta as bordas vazias e
 * encaixa numa tela fixa de 320×128, centralizada.
 *
 * Uso: node scripts/padronizar-logos.mjs
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

const RAIZ = new URL("..", import.meta.url).pathname;
const ORIGEM = join(RAIZ, "apps/storefront/public/logos-marcas");
const DESTINO = join(ORIGEM, "padrao");
const COR = { r: 0x2b, g: 0x2b, b: 0x2b }; // grafite — mais suave que o preto puro
const TELA = { w: 320, h: 128 };
const CAIXA = { w: 280, h: 88 }; // área útil: logos larguinhas e altinhas ficam com peso parecido

mkdirSync(DESTINO, { recursive: true });

for (const arquivo of readdirSync(ORIGEM)) {
  if (!/\.(png|svg|webp|jpe?g)$/i.test(arquivo)) continue;
  const slug = parse(arquivo).name;
  const entrada = sharp(join(ORIGEM, arquivo), { density: 300 })
    .resize({ width: 1200, height: 600, fit: "inside", withoutEnlargement: false })
    .flatten({ background: "#ffffff" })
    .removeAlpha();
  const { data, info } = await entrada.raw().toBuffer({ resolveWithObject: true });

  // tinta = 1 - luminância (0 = branco, 1 = preto)
  const n = info.width * info.height;
  const tinta = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    tinta[i] = 1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  // fundo = tinta típica da borda da imagem (branco, ou o cinza-claro de
  // algumas logos); só o que passa disso conta como desenho
  const borda = [];
  for (let x = 0; x < info.width; x++) borda.push(tinta[x], tinta[(info.height - 1) * info.width + x]);
  for (let y = 0; y < info.height; y++) borda.push(tinta[y * info.width], tinta[y * info.width + info.width - 1]);
  borda.sort((a, b) => a - b);
  const LIMIAR = Math.min(0.2, borda[Math.floor(borda.length / 2)] + 0.04);
  // realce: o 99º percentil da tinta do desenho vira tinta cheia
  const fortes = Array.from(tinta).filter((v) => v > LIMIAR + 0.02).sort((a, b) => a - b);
  const topo = fortes.length ? fortes[Math.floor(fortes.length * 0.99)] : 1;

  const rgba = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const linear = Math.max(0, Math.min(1, (tinta[i] - LIMIAR) / Math.max(0.05, topo - LIMIAR)));
    const a = Math.pow(linear, 0.6); // traços claros (dourado, rosa) ganham corpo
    rgba[i * 4] = COR.r;
    rgba[i * 4 + 1] = COR.g;
    rgba[i * 4 + 2] = COR.b;
    rgba[i * 4 + 3] = Math.round(a * 255);
  }

  const cortada = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 10 })
    .png()
    .toBuffer();
  const encaixada = await sharp(cortada)
    .resize({ width: CAIXA.w, height: CAIXA.h, fit: "inside" })
    .toBuffer();
  await sharp({ create: { width: TELA.w, height: TELA.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: encaixada, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(join(DESTINO, `${slug}.png`));
  console.log(`ok ${slug}`);
}
