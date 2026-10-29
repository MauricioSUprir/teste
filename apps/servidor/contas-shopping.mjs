/**
 * Contas do Beauty Shopping (o shopping 3D).
 *
 * A conta é o e-mail — o mesmo login por código de 6 dígitos da loja
 * BeautyNow, sem senha. Ao entrar, o shopping recebe um token de sessão
 * (vale 180 dias) e passa a guardar aqui o que a pessoa fez lá dentro: o
 * visual do avatar e o nome, a sacola, as lojas que ela montou e a música
 * ligada ou não. Abrindo o shopping em outro aparelho, tudo volta.
 *
 *   POST /shopping/conta/codigo   { email }            → manda o código por e-mail
 *   POST /shopping/conta/entrar   { email, codigo }    → { token, email, dados, atualizadaEm }
 *   GET  /shopping/conta                               → { email, dados, atualizadaEm }
 *   PUT  /shopping/conta          { dados }            → { ok, atualizadaEm }
 *   POST /shopping/conta/sair                          → encerra esta sessão
 *   POST /shopping/conta/apagar                        → apaga a conta e tudo o que ela guardou
 *   GET  /shopping/contas/exportar                     → backup cifrado para o robô
 *
 * O token vai em "Authorization: Bearer …"; o servidor guarda só o hash dele.
 *
 * Onde mora: /tmp (some a cada publicação), o banco permanente (uma chave
 * por conta) e o backup cifrado que o robô versiona no GitHub a cada 10
 * minutos. No boot vale o /tmp; sem ele, junta banco e backup (a versão mais
 * nova de cada conta) e respeita as contas apagadas.
 */
import crypto from "node:crypto";
import fs from "node:fs";

const ARQ = "/tmp/contas-shopping.json";
const BACKUP_URL =
  "https://raw.githubusercontent.com/MauricioSUprir/teste/claude/beauty-now-ecommerce-fbfxh2/contas-shopping-backup.json";
const PREFIXO = "shopping-conta:";
const SESSAO_MS = 180 * 24 * 3600_000;
const MAX_SESSOES = 10;
const MAX_DADOS = 64 * 1024;
/** freio geral de e-mails de código vindos do shopping (protege a cota do Brevo) */
const MAX_CODIGOS_POR_HORA = 300;

const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
const idDe = (email) => hash(`shopping:${email}`).slice(0, 32);

/**
 * Só o que o shopping usa, com limite de tamanho. O shopping confere de
 * novo cada campo ao ler (é a própria pessoa quem vê esses dados).
 */
function limparDados(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const objeto = (v) => v && typeof v === "object" && !Array.isArray(v);
  const limpo = {};
  if (objeto(d.visual)) limpo.visual = d.visual;
  if (Array.isArray(d.sacola)) limpo.sacola = d.sacola.slice(0, 200);
  if (objeto(d.lojas)) limpo.lojas = Object.fromEntries(Object.entries(d.lojas).slice(0, 40));
  if (objeto(d.preferencias)) limpo.preferencias = d.preferencias;
  const texto = JSON.stringify(limpo);
  return texto.length <= MAX_DADOS ? JSON.parse(texto) : null;
}

/**
 * @param {import("express").Express} aplicacao
 * @param {object} dep funções do servidor principal (banco, backup, código por e-mail)
 */
export async function montarContasShopping(aplicacao, dep) {
  const { doBancoComPrefixo, gravarNoBanco, APAGADO, cifrarBackup, decifrarBackup, marcarFalhaRestauracao, restauracaoOk, tokenDoCabecalho, emailValido, pedirCodigo, conferirCodigo } = dep;

  /** id → { id, email, criadaEm, atualizadaEm, dados, sessoes: [{ h, expira }] } */
  const contas = new Map();
  /** id → quando foi apagada (para o backup antigo não ressuscitar a conta) */
  const apagadas = new Map();
  /** hash do token → id da conta */
  const sessoes = new Map();

  const indexar = (c) => c.sessoes.forEach((s) => sessoes.set(s.h, c.id));
  /** a conta foi mexida depois de apagada? (apagou e criou de novo) */
  const depoisDeApagada = (id, quando) => !apagadas.has(id) || String(quando) > String(apagadas.get(id));
  const apagar = (id, em) => {
    const c = contas.get(id);
    if (c && String(c.atualizadaEm) > String(em)) return;
    contas.delete(id);
    if (String(em) > String(apagadas.get(id) ?? "")) apagadas.set(id, em);
  };
  const juntar = (lista) => {
    for (const c of lista ?? []) {
      if (!c?.id || !emailValido(c.email) || !depoisDeApagada(c.id, c.atualizadaEm)) continue;
      const atual = contas.get(c.id);
      if (!atual || String(c.atualizadaEm) > String(atual.atualizadaEm)) {
        contas.set(c.id, { ...c, sessoes: Array.isArray(c.sessoes) ? c.sessoes : [] });
        apagadas.delete(c.id);
      }
    }
  };

  // ---- volta no boot
  try {
    if (fs.existsSync(ARQ)) {
      const salvo = JSON.parse(fs.readFileSync(ARQ, "utf8"));
      for (const [id, em] of salvo.apagadas ?? []) apagar(id, em);
      juntar(salvo.contas);
    } else {
      for (const [chave, valor] of doBancoComPrefixo(PREFIXO, true)) {
        const id = chave.slice(PREFIXO.length);
        if (valor?.__apagado) apagar(id, valor.em ?? "");
      }
      juntar(doBancoComPrefixo(PREFIXO).map(([, valor]) => valor));
      const r = await fetch(BACKUP_URL, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
      if (r?.ok) {
        const backup = decifrarBackup(await r.json());
        for (const [id, em] of backup?.apagadas ?? []) apagar(id, em);
        juntar(backup?.contas);
      } else if (r?.status !== 404) {
        marcarFalhaRestauracao("contas do Beauty Shopping");
      }
    }
  } catch (erro) {
    console.error(`[contas-shopping] não consegui recuperar: ${erro.message}`);
    marcarFalhaRestauracao("contas do Beauty Shopping");
  }
  for (const c of contas.values()) indexar(c);
  console.log(`[contas-shopping] ${contas.size} conta(s) no boot`);

  let gravando = null;
  function gravarArquivo() {
    clearTimeout(gravando);
    gravando = setTimeout(() => {
      try {
        fs.writeFileSync(ARQ, JSON.stringify({ contas: [...contas.values()], apagadas: [...apagadas] }));
      } catch {
        /* segue em memória */
      }
    }, 1000);
  }
  function salvar(c) {
    gravarArquivo();
    void gravarNoBanco(PREFIXO + c.id, c);
  }

  /** a conta dona do token do cabeçalho (ou null) */
  function contaDoPedido(req) {
    const token = tokenDoCabecalho(req);
    if (!token || token.length > 100) return null;
    const h = hash(token);
    const c = contas.get(sessoes.get(h) ?? "");
    const s = c?.sessoes.find((x) => x.h === h);
    if (!c || !s) return null;
    if (Date.now() > s.expira) {
      c.sessoes = c.sessoes.filter((x) => x !== s);
      sessoes.delete(h);
      salvar(c);
      return null;
    }
    return { c, h };
  }
  const exigirConta = (req, res) => {
    const achou = contaDoPedido(req);
    if (!achou) res.status(401).json({ erro: "Sua sessão terminou. Entre de novo com seu e-mail." });
    return achou;
  };

  let codigosNaHora = { inicio: Date.now(), n: 0 };
  aplicacao.post("/shopping/conta/codigo", async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!emailValido(email)) return res.status(400).json({ erro: "Confira o e-mail." });
    if (Date.now() - codigosNaHora.inicio > 3600_000) codigosNaHora = { inicio: Date.now(), n: 0 };
    if (++codigosNaHora.n > MAX_CODIGOS_POR_HORA) return res.status(429).json({ erro: "Muita gente entrando agora. Tente de novo em alguns minutos." });
    const r = await pedirCodigo(email, "shopping");
    res.status(r.status ?? 200).json(r.erro ? { erro: r.erro } : { ok: true });
  });

  aplicacao.post("/shopping/conta/entrar", (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const r = conferirCodigo(email, String(req.body?.codigo ?? "").trim());
    if (r.erro) return res.status(r.status).json({ erro: r.erro });
    const id = idDe(email);
    const agora = new Date().toISOString();
    let c = contas.get(id);
    const nova = !c;
    if (!c) {
      c = { id, email, criadaEm: agora, atualizadaEm: agora, dados: {}, sessoes: [] };
      contas.set(id, c);
      apagadas.delete(id);
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const s = { h: hash(token), expira: Date.now() + SESSAO_MS };
    const ficam = [...c.sessoes.filter((x) => x.expira > Date.now()), s].slice(-MAX_SESSOES);
    for (const x of c.sessoes) if (!ficam.includes(x)) sessoes.delete(x.h);
    c.sessoes = ficam;
    sessoes.set(s.h, id);
    salvar(c);
    res.json({ token, email, nova, dados: c.dados, atualizadaEm: c.atualizadaEm });
  });

  aplicacao.get("/shopping/conta", (req, res) => {
    const achou = exigirConta(req, res);
    if (!achou) return;
    res.set("Cache-Control", "no-store").json({ email: achou.c.email, dados: achou.c.dados, atualizadaEm: achou.c.atualizadaEm });
  });

  aplicacao.put("/shopping/conta", (req, res) => {
    const achou = exigirConta(req, res);
    if (!achou) return;
    const dados = limparDados(req.body?.dados);
    if (!dados) return res.status(400).json({ erro: "Não deu para salvar (dados grandes demais)." });
    achou.c.dados = dados;
    achou.c.atualizadaEm = new Date().toISOString();
    salvar(achou.c);
    res.json({ ok: true, atualizadaEm: achou.c.atualizadaEm });
  });

  aplicacao.post("/shopping/conta/sair", (req, res) => {
    const achou = contaDoPedido(req);
    if (achou) {
      achou.c.sessoes = achou.c.sessoes.filter((x) => x.h !== achou.h);
      sessoes.delete(achou.h);
      salvar(achou.c);
    }
    res.json({ ok: true });
  });

  aplicacao.post("/shopping/conta/apagar", (req, res) => {
    const achou = exigirConta(req, res);
    if (!achou) return;
    const { c } = achou;
    for (const s of c.sessoes) sessoes.delete(s.h);
    contas.delete(c.id);
    const em = new Date().toISOString();
    apagadas.set(c.id, em);
    gravarArquivo();
    void gravarNoBanco(PREFIXO + c.id, { ...APAGADO, em });
    console.log("[contas-shopping] conta apagada a pedido da pessoa");
    res.json({ ok: true });
  });

  // sai sempre cifrado (o mesmo que fica no repositório público): o robô baixa sem chave
  aplicacao.get("/shopping/contas/exportar", (req, res) => {
    const lista = [...contas.values()].sort((a, b) => a.id.localeCompare(b.id));
    const backup = cifrarBackup({ geradoEm: new Date().toISOString(), restauracaoOk: restauracaoOk(), contas: lista, apagadas: [...apagadas].sort() }, lista.length);
    // o repositório do backup é público: e-mail nunca sai em texto aberto
    if (!backup.cifrado) return res.status(503).json({ erro: "BACKUP_CHAVE não configurada." });
    res.json(backup);
  });
}
