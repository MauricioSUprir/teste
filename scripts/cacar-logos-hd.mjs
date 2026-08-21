/**
 * Caçada de logos v7 — QUALIDADE. Abre o site oficial de cada marca num
 * Chrome de verdade e captura a logo do cabeçalho em escala 3x (nítida).
 * Se o <img> original for grande (SVG/PNG de verdade, não favicon), baixa
 * o arquivo original também. Salva tudo em logos-hd/ para inspeção visual.
 *
 * Uso: node scripts/cacar-logos-hd.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const ALVOS = {
  batiste: ["https://www.batistehair.com/", "https://batistebrasil.com.br/"],
  issue: ["https://issueprofessional.com/", "https://www.issueprofessional.com.br/"],
  joico: ["https://joico.com/", "https://www.joico.com.br/"],
  latika: ["https://latika.com.br/", "https://www.latika.com.br/"],
  mawwal: ["https://mawwal.com.br/", "https://www.mawwal.com.br/"],
  nina: ["https://ninamakeup.com.br/", "https://www.ninamakeup.com.br/"],
  noue: ["https://nouecosmeticos.com.br/", "https://www.nouecosmeticos.com.br/"],
  sallve: ["https://sallve.com.br/", "https://www.sallve.com.br/"],
  reyou: ["https://reyou.com.br/", "https://www.reyou.com.br/"],
  oceane: ["https://oceane.com.br/", "https://www.oceane.com.br/"],
  "k-pro": ["https://kpro.com.br/", "https://lojakpro.com.br/", "https://www.kpro.com.br/"],
  "beleza-brasileira": ["https://belezabrasileira.com.br/", "https://www.belezabrasileira.com.br/"],
  soffie: ["https://soffie.com.br/", "https://www.soffie.com.br/"],
  arvensis: ["https://arvensis.com.br/", "https://www.arvensis.com.br/"],
  "papel-para-mechas": ["https://papelparamechas.com.br/"],
  "jacques-janine": ["https://jacquesjanine.com.br/", "https://www.jacquesjanine.com.br/"],
  hidratei: ["https://hidratei.com.br/", "https://www.hidratei.com.br/"],
  senscience: ["https://senscience.com/", "https://www.senscience.com.br/"],
  "widi-care": ["https://widicare.com.br/", "https://www.widicare.com.br/"],
  "d-vence": ["https://dvence.com.br/", "https://www.dvence.com.br/"],
  bioderma: ["https://www.bioderma.com.br/", "https://bioderma.com.br/"],
  byem: ["https://byem.com.br/", "https://www.byem.com.br/"],
  dentalclean: ["https://dentalclean.com.br/", "https://www.dentalclean.com.br/"],
  melu: ["https://melubyrubyrose.com.br/"],
};

const SELETORES = [
  "header img[src*='logo' i]",
  "header img[alt*='logo' i]",
  "header a[href='/'] img",
  "img[class*='logo' i]",
  "img[src*='logo' i]",
  "header svg[class*='logo' i]",
  "a[href='/'] svg",
  "header img",
];

mkdirSync("logos-hd", { recursive: true });
const relatorio = {};

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 3,
  locale: "pt-BR",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
});

for (const [slug, urls] of Object.entries(ALVOS)) {
  let feito = null;
  for (const url of urls) {
    const pagina = await contexto.newPage();
    try {
      await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 40_000 });
      await pagina.waitForTimeout(3_500);
      // fecha banners de cookie comuns (senão cobrem o cabeçalho)
      for (const txt of ["Aceitar", "Aceito", "OK", "Entendi", "Concordo"]) {
        const btn = pagina.locator(`button:has-text("${txt}")`).first();
        if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
          await btn.click().catch(() => undefined);
          await pagina.waitForTimeout(400);
          break;
        }
      }
      let alvo = null;
      for (const sel of SELETORES) {
        const el = pagina.locator(sel).first();
        if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
          const caixa = await el.boundingBox().catch(() => null);
          if (caixa && caixa.width >= 40 && caixa.height >= 14) {
            alvo = el;
            break;
          }
        }
      }
      if (!alvo) throw new Error("logo não encontrada");
      // arquivo original, se for imagem grande de verdade
      const src = await alvo.getAttribute("src").catch(() => null);
      if (src && !src.startsWith("data:")) {
        const absoluta = new URL(src, url).href;
        const resposta = await pagina.request.get(absoluta).catch(() => null);
        if (resposta?.ok()) {
          const tipo = (resposta.headers()["content-type"] ?? "").split(";")[0];
          const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" }[tipo];
          const corpo = await resposta.body();
          if (ext && (ext === "svg" ? corpo.length > 800 : corpo.length > 6_000)) {
            writeFileSync(`logos-hd/arquivo-${slug}.${ext}`, corpo);
            feito = { url, metodo: "arquivo", tipo, bytes: corpo.length };
          }
        }
      }
      // captura 3x do elemento (sempre, como comparação)
      const png = await alvo.screenshot({ omitBackground: true, timeout: 15_000 }).catch(() => null);
      if (png && png.length > 1_500) {
        writeFileSync(`logos-hd/shot-${slug}.png`, png);
        feito = feito ?? { url, metodo: "screenshot", bytes: png.length };
        feito.screenshot = true;
      }
    } catch (erro) {
      console.log(`[hd] ${slug} em ${url}: ${erro.message.split("\n")[0]}`);
    } finally {
      await pagina.close();
    }
    if (feito) break;
  }
  relatorio[slug] = feito ?? "FALHOU";
  console.log(`[hd] ${slug}: ${feito ? feito.metodo + " (" + feito.url + ")" : "FALHOU"}`);
}

await navegador.close();
writeFileSync("logos-hd/relatorio-hd.json", JSON.stringify(relatorio, null, 2));
console.log("v7 pronto");
