/**
 * Caçada de logos v4 — navegador de verdade (Playwright/Chromium) no runner
 * do GitHub. Sites com anti-robô bloqueiam curl, mas carregam num Chrome
 * normal. Estratégia: abrir a home, achar o <img> de logo do cabeçalho e
 * (1º) baixar o arquivo original via o próprio navegador; se não der,
 * (2º) fotografar o elemento renderizado em alta resolução.
 *
 * Uso: node scripts/cacar-logos-navegador.mjs (exige playwright instalado)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const ALVOS = {
  arvensis: ["https://arvensis.com.br/", "https://www.arvensis.com.br/"],
  "bruna-tavares": ["https://lojabrunatavares.com.br/", "https://www.lojabrunatavares.com.br/"],
  evoly: ["https://evoly.com.br/", "https://www.evoly.com.br/", "https://evolyprofessional.com.br/"],
  melu: ["https://melubyrubyrose.com.br/", "https://www.rubyrose.com.br/"],
  rebeel: ["https://rebeel.com.br/", "https://www.rebeel.com.br/"],
};

const SELETORES = [
  "header img[src*='logo' i]",
  "header img[alt*='logo' i]",
  "img[class*='logo' i]",
  "img[src*='logo' i]",
  "header a[href='/'] img",
  "a[href='/'] img",
  "header img",
];

mkdirSync("logos-extra", { recursive: true });
const achados = {};
const falhas = [];

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 3,
  locale: "pt-BR",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
});

for (const [slug, urls] of Object.entries(ALVOS)) {
  let ok = false;
  for (const url of urls) {
    const pagina = await contexto.newPage();
    try {
      await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await pagina.waitForTimeout(4_000); // JS/anti-bot assentar
      let alvo = null;
      for (const sel of SELETORES) {
        const el = pagina.locator(sel).first();
        if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
          alvo = el;
          break;
        }
      }
      if (!alvo) throw new Error("logo não encontrada no cabeçalho");

      // 1º: tentar o arquivo original apontado pelo <img>
      const src = await alvo.getAttribute("src");
      if (src && !src.startsWith("data:")) {
        const absoluta = new URL(src, url).href;
        const resposta = await pagina.request.get(absoluta).catch(() => null);
        if (resposta?.ok()) {
          const tipo = (resposta.headers()["content-type"] ?? "").split(";")[0];
          const ext =
            { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif" }[tipo];
          const corpo = await resposta.body();
          if (ext && corpo.length > 500) {
            writeFileSync(`logos-extra/${slug}.${ext}`, corpo);
            achados[slug] = { url: absoluta, tipo, bytes: corpo.length, metodo: "arquivo" };
            ok = true;
          }
        }
      }
      // 2º: fotografar o elemento renderizado (3x de escala)
      if (!ok) {
        const png = await alvo.screenshot({ omitBackground: true, timeout: 15_000 });
        if (png.length > 1_000) {
          writeFileSync(`logos-extra/${slug}.png`, png);
          achados[slug] = { url, tipo: "image/png", bytes: png.length, metodo: "screenshot" };
          ok = true;
        }
      }
    } catch (erro) {
      console.log(`[v4] ${slug} em ${url}: ${erro.message.split("\n")[0]}`);
    } finally {
      await pagina.close();
    }
    if (ok) break;
  }
  if (!ok) falhas.push(slug);
  console.log(`[v4] ${slug}: ${ok ? "ok (" + achados[slug].metodo + ")" : "FALHOU"}`);
}

await navegador.close();
writeFileSync("logos-extra/relatorio-v4.json", JSON.stringify({ achados, falhas }, null, 2));
console.log("v4 total ok:", Object.keys(achados).length, "| falhas:", JSON.stringify(falhas));
