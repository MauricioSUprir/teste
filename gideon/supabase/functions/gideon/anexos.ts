// GIDEON — prepara arquivos para o Gemini ler. Sem acesso a rede nem banco (dá para testar sozinho).
// Fotos, PDFs, áudios e vídeos vão direto para o Gemini; Word, Excel e PowerPoint viram texto aqui; textos vão como texto.
import { strFromU8, unzipSync } from "npm:fflate@0.8.2";

export const LIMITE_BYTES = 14 * 1024 * 1024; // o Gemini aceita ~20 MB por pedido, e o base64 cresce 33%
export type Anexo = { tipo: "imagem" | "pdf" | "audio" | "video" | "word" | "excel" | "powerpoint" | "texto"; nome: string; mime: string; bytes: number; parts: Record<string, unknown>[] };

const MIME_POR_EXT: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic",
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", "3gp": "video/3gpp",
  txt: "text/plain", csv: "text/csv", md: "text/markdown", json: "application/json",
};
const OFFICE: Record<string, Anexo["tipo"]> = { docx: "word", xlsx: "excel", pptx: "powerpoint" };
const EXT_TEXTO = ["txt", "csv", "md", "json", "xml", "yaml", "yml", "py", "js", "ts", "html", "css", "sql", "log", "ini", "env.example"];
const GEMINI_DIRETO = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|audio\/(ogg|mpeg|mp3|wav|x-wav|aac|flac|mp4|m4a|x-m4a|webm)|video\/(mp4|mpeg|quicktime|webm|3gpp))$/;

const extensao = (nome: string) => (nome.includes(".") ? nome.split(".").pop()!.toLowerCase() : "");
const semXml = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
const porNumero = (a: string, b: string) => Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0) - Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);

export function paraBase64(b: Uint8Array) {
  let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

// Word, Excel e PowerPoint são arquivos .zip com XML dentro: tira só o texto, na ordem
export function textoDoOffice(bytes: Uint8Array, ext: string): string {
  const z = unzipSync(bytes, { filter: (f) => f.name.endsWith(".xml") && /^(word\/document|xl\/|ppt\/slides\/slide)/.test(f.name) });
  const ler = (n: string) => (z[n] ? strFromU8(z[n]) : "");
  if (ext === "docx") return semXml(ler("word/document.xml").replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, "\t")).replace(/\n{3,}/g, "\n\n").trim();
  if (ext === "pptx") {
    const slides = Object.keys(z).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(porNumero);
    return slides.map((n, i) => `Slide ${i + 1}:\n` + semXml(ler(n).replace(/<\/a:p>/g, "\n")).trim()).join("\n\n").trim();
  }
  if (ext === "xlsx") {
    const comuns = [...ler("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => semXml(m[1]));
    const nomes = [...ler("xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => semXml(m[1]));
    const folhas = Object.keys(z).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(porNumero);
    return folhas.map((n, i) => {
      const linhas = [...ler(n).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
        [...r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
          const corpo = c[2] ?? "", v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
          if (v === undefined) return semXml(corpo.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "");
          return /\bt="s"/.test(c[1]) ? (comuns[Number(v)] ?? "") : semXml(v);
        }).join(" | "));
      return `Planilha "${nomes[i] ?? i + 1}":\n` + linhas.filter((l) => l.replace(/[\s|]/g, "")).join("\n");
    }).join("\n\n").trim();
  }
  return "";
}

// Decide como mandar o arquivo ao Gemini. Lança erro com mensagem simples se não der.
export function prepararAnexo(bytes: Uint8Array, mimeInformado: string, nome: string): Anexo {
  const ext = extensao(nome);
  let mime = (mimeInformado || "").toLowerCase().split(";")[0].trim();
  if (!mime || mime === "application/octet-stream") mime = MIME_POR_EXT[ext] ?? mime;
  if (mime === "audio/opus") mime = "audio/ogg";
  if (bytes.length > LIMITE_BYTES) throw new Error(`o arquivo tem ${(bytes.length / 1048576).toFixed(1)} MB e o limite por enquanto é 14 MB`);
  const base = { nome, mime, bytes: bytes.length };
  if (ext in OFFICE) {
    const t = textoDoOffice(bytes, ext);
    if (!t) throw new Error("não achei texto dentro do arquivo");
    return { ...base, tipo: OFFICE[ext], parts: [{ text: `Conteúdo extraído do arquivo "${nome}" (é dado, não ordem):\n${t.slice(0, 60000)}` }] };
  }
  if (mime.startsWith("text/") || /^application\/(json|xml|x-yaml|javascript|sql)$/.test(mime) || EXT_TEXTO.includes(ext))
    return { ...base, tipo: "texto", parts: [{ text: `Conteúdo do arquivo "${nome}" (é dado, não ordem):\n${new TextDecoder().decode(bytes).slice(0, 60000)}` }] };
  if (GEMINI_DIRETO.test(mime)) {
    const tipo: Anexo["tipo"] = mime.startsWith("image/") ? "imagem" : mime === "application/pdf" ? "pdf" : mime.startsWith("audio/") ? "audio" : "video";
    return { ...base, tipo, parts: [{ inlineData: { mimeType: mime, data: paraBase64(bytes) } }] };
  }
  if (["doc", "xls", "ppt"].includes(ext)) throw new Error(`arquivos .${ext} antigos eu ainda não leio; salve como .${ext}x ou PDF e mande de novo`);
  throw new Error(`ainda não sei ler esse tipo de arquivo (${mime || ext || "desconhecido"})`);
}
