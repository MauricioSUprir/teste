/**
 * Junta tudo: o prédio, as 8 lojas da galeria, as duas lojas âncora (a loja
 * 3D dos sites, no fundo da praça), as plantas, a luz do sol pela claraboia,
 * o reflexo no piso e os caminhos (para os visitantes andarem sozinhos e para
 * o "me levar até lá": mapa de nós na galeria e A* na grade das âncoras).
 */
import * as THREE from "three";
import { ANCORAS, ocupacao, PLANTA, UNIDADES, type Ancora, type Inquilino } from "../dados/lojas";
import { registrarMarcas, type Produto } from "../dados/catalogo";
import { textos } from "../copy/textos";
import { Colisao } from "./colisao";
import { criarEstrutura, type PontoInteracao } from "./estrutura";
import { criarLoja, type LojaMontada } from "./loja";
import { ALTURA as ALTURA_ANCORA, FUNDO as FUNDO_ANCORA, LARGURA as LARGURA_ANCORA, PAREDE as PAREDE_ANCORA, montarLojaDoSite, type LojaSite, type SetorCena } from "./loja-site";
import { AtendenteSite } from "./atendente-site";
import { criarMateriais, type Qualidade } from "./materiais";
import { carregarPlantas } from "./plantas";
import { ajustesSuperficie, criarReflexo, prepararSuperficie, type Reflexo } from "./superficie";
import { FONTE } from "./letreiros";

export interface No {
  x: number;
  z: number;
  viz: number[];
}

export interface Lugar {
  tipo: "loja" | "praca" | "entrada" | "corredor";
  nome?: string;
  inquilino?: Inquilino;
}

interface AncoraMontada {
  config: Ancora;
  loja: LojaSite | null;
  atendente: AtendenteSite | null;
  /** nós de caminho da porta (fora e dentro) */
  fora: number;
  dentro: number;
  produtoDe: Map<string, Produto>;
  ativa: boolean;
}

interface VitrineSite {
  baseImagem: string;
  setores: { slug: string; nome: string; logo: string | null; categoria: string; produtos: Produto[] }[];
  categorias: string[];
}

const MEIA_ANCORA = LARGURA_ANCORA / 2 + PAREDE_ANCORA;
const FRENTE_ANCORA = FUNDO_ANCORA / 2 + PAREDE_ANCORA + 0.06;

export class Shopping {
  readonly cena = new THREE.Scene();
  readonly colisao = new Colisao();
  readonly lojas: LojaMontada[] = [];
  pontos: PontoInteracao[] = [];
  readonly nos: No[] = [];
  readonly sol: THREE.DirectionalLight;
  /** termina quando as lojas âncora (que baixam a vitrine dos sites) estão montadas */
  readonly pronto: Promise<void>;
  private estrutura!: ReturnType<typeof criarEstrutura>;
  private mat: ReturnType<typeof criarMateriais>;
  private reflexo: Reflexo | null = null;
  private pisos: THREE.Object3D[] = [];
  private fixos: Colisao;
  /** colisão de cada loja (refeita junto com ela) */
  private colisaoLoja = new Map<string, Colisao>();
  /** nós de caminho da porta de cada loja */
  private portas = new Map<string, { fora: number; dentro: number }>();
  readonly ancoras: AncoraMontada[];
  ocupadas: Map<string, Inquilino>;

  constructor(
    private renderer: THREE.WebGLRenderer,
    ambiente: THREE.Texture,
    private qualidade: Qualidade,
    private celular: boolean
  ) {
    this.cena.environment = ambiente;
    this.cena.environmentIntensity = 0.42;
    this.cena.fog = new THREE.Fog("#e6e1dc", 90, 240);
    this.mat = criarMateriais(qualidade);
    this.ocupadas = ocupacao();
    this.ancoras = ANCORAS.map((config) => ({ config, loja: null, atendente: null, fora: -1, dentro: -1, produtoDe: new Map(), ativa: false }));

    const hemi = new THREE.HemisphereLight("#fbf8ff", "#b9ab9c", 0.75);
    this.cena.add(hemi);
    this.sol = new THREE.DirectionalLight("#ffeedd", 2.4);
    this.sol.position.set(-14, 46, 4);
    this.sol.target.position.set(0, 0, -14);
    this.sol.castShadow = true;
    // a sombra cobre da entrada até o fundo das âncoras
    const sc = this.sol.shadow.camera;
    sc.left = -36;
    sc.right = 36;
    sc.top = 58;
    sc.bottom = -58;
    sc.near = 10;
    sc.far = 120;
    const lado = celular ? 2048 : 4096;
    this.sol.shadow.mapSize.set(lado, lado);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.035;
    this.cena.add(this.sol, this.sol.target);

    // só o que não muda (prédio); as lojas entram por cima e podem ser refeitas
    this.fixos = new Colisao();
    this.paredesDasAncoras();
    this.montarEstrutura();
    UNIDADES.forEach((u) => this.montarLoja(u.numero));
    this.prepararPisos();
    this.montarCaminhos();
    void carregarPlantas("./modelos/", this.estrutura.plantas, [0]).then((p) => this.cena.add(p.grupo));
    this.pronto = this.montarAncoras();
  }

  private montarEstrutura() {
    const ocupadas = [...this.ocupadas.values()].sort((a, b) => a.unidade.localeCompare(b.unidade));
    this.estrutura = criarEstrutura({
      mat: this.mat,
      colisao: this.fixos,
      ocupadas: ocupadas.map((q) => ({ numero: q.unidade, nome: q.nome, cor: q.estilo.letreiro === "pulse" ? "#3a2b22" : q.estilo.primaria, slogan: q.slogan })),
      vagas: UNIDADES.filter((u) => !this.ocupadas.has(u.numero)).map((u) => u.numero),
      ancoras: ANCORAS.map((a) => ({ cx: a.cx, largura: MEIA_ANCORA * 2, altura: ALTURA_ANCORA, inquilino: a.inquilino })),
    });
    this.cena.add(this.estrutura.grupo);
    this.juntarColisao();
  }

  /** paredes de fora das âncoras (para a câmera e para "dá para ir reto?"); os móveis ficam na grade de cada uma */
  private paredesDasAncoras() {
    for (const a of ANCORAS) {
      const x0 = a.cx - MEIA_ANCORA;
      const x1 = a.cx + MEIA_ANCORA;
      const z0 = a.cz - FRENTE_ANCORA;
      const zf = a.cz + FRENTE_ANCORA - 0.26;
      // 4,6 m: mais alta que o limite da vitrine (4,2 m) — produto da outra âncora não aparece através dela
      this.fixos.parede(x0, z0, x0, zf, 4.6);
      this.fixos.parede(x1, z0, x1, zf, 4.6);
      this.fixos.parede(x0, z0, x1, z0, 4.6);
      // fachada: vidro dos dois lados da porta (3 m no meio)
      this.fixos.parede(x0, zf, a.cx - 1.5, zf, 3.6);
      this.fixos.parede(a.cx + 1.5, zf, x1, zf, 3.6);
      // os dois vasos na calçada da frente
      for (const s of [-1, 1]) this.fixos.circulo(a.cx + s * 2.4, a.cz + FUNDO_ANCORA / 2 + PAREDE_ANCORA + 0.85, 0.32, 1);
    }
  }

  /** baixa a vitrine dos sites e monta a loja 3D de cada âncora */
  private async montarAncoras() {
    let vitrine: VitrineSite;
    try {
      vitrine = await (await fetch("./dados/vitrine-site.json")).json();
    } catch {
      return;
    }
    registrarMarcas(vitrine.setores.map((s) => [s.slug, s.nome]));
    const todos = vitrine.setores.flatMap((s) => s.produtos);
    const urlFoto = (p: Produto) => (/^\d+$/.test(p.foto) ? `${vitrine.baseImagem}${p.foto}` : p.foto.startsWith("/") ? `.${p.foto}` : p.foto);
    const setores: SetorCena[] = vitrine.setores.map((s) => ({
      slug: s.slug,
      nome: s.nome,
      logo: s.logo ?? undefined,
      categoria: s.categoria,
      produtos: s.produtos.map((p) => ({ slug: p.id, foto: urlFoto(p), titulo: p.titulo, preco: p.preco, desconto: p.precoDe && p.precoDe > p.preco ? Math.round((1 - p.preco / p.precoDe) * 100) : null })),
    }));
    for (const a of this.ancoras) {
      // deixa um quadro passar entre uma loja e outra (montar uma loja leva alguns décimos)
      await new Promise((r) => setTimeout(r, 30));
      const c = a.config;
      a.config.inquilino.produtos = todos;
      for (const p of todos) a.produtoDe.set(p.id, p);
      const loja = montarLojaDoSite({
        setores,
        categorias: vitrine.categorias,
        estilo: c.site.estilo,
        logo: c.site.logo,
        fraseVitrine: c.site.fraseVitrine,
        tituloDestaques: textos.ancora.destaques,
        corPrimaria: c.site.corPrimaria,
        corEscura: c.site.corEscura,
        fonte: FONTE,
        celular: this.celular,
        urlModelos: "./modelos/",
        reflexo: this.reflexo ?? undefined,
      });
      loja.grupo.position.set(c.cx, 0, c.cz);
      loja.grupo.updateMatrixWorld(true);
      for (const m of loja.malhas) {
        const produto = a.produtoDe.get(m.userData.slug as string);
        m.userData = { ...m.userData, produto, loja: c.inquilino };
      }
      this.cena.add(loja.grupo);
      a.loja = loja;
      const atendente = new AtendenteSite(`./modelos/${c.site.modeloAtendente}`);
      atendente.grupo.position.set(c.cx + loja.atendente.x, 0, c.cz + loja.atendente.z);
      atendente.grupo.rotation.y = loja.atendente.rumo;
      this.cena.add(atendente.grupo);
      a.atendente = atendente;
    }
    this.ocupadas = ocupacao();
    this.prepararPisos();
    this.montarCaminhos();
    this.juntarColisao();
  }

  private juntarColisao() {
    const daLojas = [...this.colisaoLoja.values()];
    this.colisao.segmentos = [...this.fixos.segmentos, ...daLojas.flatMap((c) => c.segmentos)];
    this.colisao.circulos = [...this.fixos.circulos, ...daLojas.flatMap((c) => c.circulos)];
    const pontosAncoras: PontoInteracao[] = this.ancoras.flatMap((a) =>
      a.loja ? [{ tipo: "caixa" as const, x: a.config.cx + a.loja.caixa.x, z: a.config.cz + a.loja.caixa.z, raio: 1.9, rotulo: textos.dicas.caixa, unidade: a.config.inquilino.unidade }] : []
    );
    this.pontos = [...this.estrutura.pontos, ...this.lojas.flatMap((l) => l.pontos), ...pontosAncoras];
  }

  private montarLoja(numero: string) {
    const u = UNIDADES.find((x) => x.numero === numero)!;
    const col = new Colisao();
    const loja = criarLoja(u, this.ocupadas.get(numero), this.mat, col, this.celular);
    this.colisaoLoja.set(numero, col);
    const i = this.lojas.findIndex((l) => l.unidade.numero === numero);
    if (i >= 0) {
      this.lojas[i].descartar();
      this.lojas[i] = loja;
    } else this.lojas.push(loja);
    this.cena.add(loja.grupo);
    this.juntarColisao();
    return loja;
  }

  /** refaz uma unidade (o visitante montou ou desmontou a loja dele na prévia) */
  refazerLoja(numero: string) {
    this.ocupadas = ocupacao();
    const loja = this.montarLoja(numero);
    this.prepararPisos();
    this.montarCaminhos();
    return loja;
  }

  private prepararPisos() {
    this.pisos = [...this.estrutura.pisos, ...this.lojas.flatMap((l) => l.pisos), ...this.ancoras.flatMap((a) => a.loja?.foraDoReflexo ?? [])];
    if (this.qualidade !== "alta") return;
    if (!this.reflexo) {
      this.reflexo = criarReflexo(this.renderer, 0);
      const alvos = new Set<THREE.MeshStandardMaterial>([this.mat.pisoGaleria, this.mat.pisos.porcelanato, this.mat.pisos.madeira, this.mat.pisos.cimento]);
      alvos.forEach((m) => prepararSuperficie(m, { reflexo: this.reflexo! }));
    }
    this.ajustarReflexo(this.qualidade);
  }

  ajustarReflexo(q: Qualidade) {
    this.qualidade = q;
    ajustesSuperficie.forcaReflexo.value = q === "alta" && this.reflexo ? 0.85 : 0;
    ajustesSuperficie.lodReflexo.value = 1.4;
    const l = this.renderer.domElement.width;
    const a = this.renderer.domElement.height;
    this.reflexo?.redimensionar(l / 2, a / 2);
  }

  redimensionar() {
    const l = this.renderer.domElement.width;
    const a = this.renderer.domElement.height;
    this.reflexo?.redimensionar(l / 2, a / 2);
  }

  /** antes de desenhar o quadro */
  preparar(camera: THREE.PerspectiveCamera, esconderNoReflexo: THREE.Object3D[]) {
    if (this.reflexo && ajustesSuperficie.forcaReflexo.value > 0) this.reflexo.atualizar(this.cena, camera, [...this.pisos, ...esconderNoReflexo]);
  }

  private aux = new THREE.Vector3();
  atualizar(t: number, dt: number, pos: THREE.Vector3) {
    this.estrutura.atualizar(t, dt);
    // produtos de uma loja aparecem quando a pessoa chega perto
    for (const l of this.lojas) {
      if (!l.inquilino || l.produtosProntos) continue;
      const cx = l.unidade.lado * 14;
      if (Math.hypot(pos.x - cx, pos.z - l.unidade.zc) < 30) void l.montarProdutos();
    }
    for (const a of this.ancoras) {
      if (!a.loja) continue;
      const lx = pos.x - a.config.cx;
      const lz = pos.z - a.config.cz;
      // dentro da âncora ou na praça olhando a vitrine dela
      a.ativa = this.dentroDaAncora(a, pos.x, pos.z) || (Math.abs(lx) < MEIA_ANCORA + 2 && lz > 0 && lz < FRENTE_ANCORA + 12);
      a.loja.atualizar(dt, this.aux.set(lx, pos.y, lz), a.ativa);
      a.atendente?.atualizar(dt, pos);
    }
  }

  private dentroDaAncora(a: AncoraMontada, x: number, z: number) {
    return Math.abs(x - a.config.cx) < MEIA_ANCORA && z > a.config.cz - FRENTE_ANCORA && z < a.config.cz + FRENTE_ANCORA;
  }

  private ancoraEm(x: number, z: number) {
    return this.ancoras.find((a) => a.loja && this.dentroDaAncora(a, x, z)) ?? null;
  }

  /** móvel ou parede de uma âncora nesse ponto? (a galeria usa a colisão de segmentos) */
  bloqueado(x: number, z: number) {
    for (const a of this.ancoras) if (a.loja && a.loja.bloqueado(x - a.config.cx, z - a.config.cz)) return true;
    return false;
  }

  /** altura máxima da câmera nesse ponto (não atravessa teto) */
  tetoEm(x: number, z: number) {
    if (this.ancoraEm(x, z)) return ALTURA_ANCORA - 0.35;
    const ax = Math.abs(x);
    if (ax > PLANTA.meioCorredor && z < PLANTA.zLojasSul && z > PLANTA.zLojasNorte) return PLANTA.tetoLoja - 0.3;
    if (ax > PLANTA.varanda - 0.2 && ax < PLANTA.meioCorredor + 0.5 && z > PLANTA.zLojasNorte) return PLANTA.piso2 - 0.3;
    return PLANTA.tetoGaleria - 0.6;
  }

  /** onde a pessoa está: loja (da galeria ou âncora), praça, entrada ou corredor */
  ondeEsta(x: number, z: number): Lugar {
    const a = this.ancoraEm(x, z);
    if (a) return { tipo: "loja", nome: a.config.inquilino.nome, inquilino: a.config.inquilino };
    if (Math.abs(x) > PLANTA.meioCorredor && z < PLANTA.zLojasSul && z > PLANTA.zLojasNorte) {
      const loja = this.lojas.find((l) => Math.sign(x) === l.unidade.lado && z >= l.unidade.z0 && z < l.unidade.z1);
      return { tipo: "loja", nome: loja?.inquilino?.nome ?? textos.aluguel.unidade(loja?.unidade.numero ?? ""), inquilino: loja?.inquilino };
    }
    if (z < PLANTA.zLojasNorte) return { tipo: "praca" };
    if (z > PLANTA.zLojasSul) return { tipo: "entrada" };
    return { tipo: "corredor" };
  }

  alvosProdutos(pos: THREE.Vector3): THREE.Object3D[] {
    const daGaleria = this.lojas.filter((l) => l.alvos.length && Math.hypot(pos.x - l.unidade.lado * 14, pos.z - l.unidade.zc) < 22).flatMap((l) => l.alvos);
    const dasAncoras = this.ancoras.filter((a) => a.ativa && a.loja).flatMap((a) => a.loja!.malhas);
    return [...daGaleria, ...dasAncoras];
  }

  // ---- caminhos

  private montarCaminhos() {
    this.nos.length = 0;
    const add = (x: number, z: number) => this.nos.push({ x, z, viz: [] }) - 1;
    const liga = (a: number, b: number) => {
      if (!this.nos[a].viz.includes(b)) this.nos[a].viz.push(b);
      if (!this.nos[b].viz.includes(a)) this.nos[b].viz.push(a);
    };
    const faixas = [32, 27, 21, 15, 9, 3, -3, -9, -15, -21];
    const lado: Record<number, number[]> = { [-1]: [], [1]: [] };
    for (const s of [-1, 1]) {
      faixas.forEach((z, i) => {
        const n = add(s * 3.4, z);
        lado[s].push(n);
        if (i) liga(n, lado[s][i - 1]);
      });
    }
    faixas.forEach((_, i) => {
      // atravessa o corredor onde não há ilha de vaso
      if (![15, 9, -9, -15].includes(faixas[i])) liga(lado[-1][i], lado[1][i]);
    });
    // praça: anel em volta da fonte, mais a frente das âncoras
    const pe = add(-3.4, -25.6);
    const pd = add(3.4, -25.6);
    liga(pe, lado[-1][faixas.length - 1]);
    liga(pd, lado[1][faixas.length - 1]);
    liga(pe, pd);
    const anel = [add(-7, -27), add(-11, -31), add(-11, -36.5), add(-6.5, -40.5), add(0, -41), add(6.5, -40.5), add(11, -36.5), add(11, -31), add(7, -27)];
    anel.forEach((n, i) => i && liga(n, anel[i - 1]));
    liga(pe, anel[0]);
    liga(pd, anel[anel.length - 1]);
    const alas = [add(-24, -30), add(-24, -40), add(24, -30), add(24, -40)];
    liga(alas[0], anel[1]);
    liga(alas[0], alas[1]);
    liga(alas[1], anel[2]);
    liga(alas[2], anel[7]);
    liga(alas[2], alas[3]);
    liga(alas[3], anel[6]);
    for (const a of this.ancoras) {
      if (!a.loja) continue;
      a.fora = add(a.config.cx + a.loja.porta.x, a.config.cz + a.loja.porta.zFora);
      a.dentro = add(a.config.cx + a.loja.porta.x, a.config.cz + a.loja.porta.zDentro);
      liga(a.fora, a.dentro);
      const fora = this.nos[a.fora];
      [...anel, ...alas]
        .map((n) => ({ n, d: Math.hypot(this.nos[n].x - fora.x, this.nos[n].z - fora.z) }))
        .sort((p, q) => p.d - q.d)
        .slice(0, 2)
        .forEach((p) => liga(a.fora, p.n));
    }
    // lojas da galeria: porta de fora, porta de dentro e os pontos de passeio
    for (const l of this.lojas) {
      const s = l.unidade.lado;
      const zc = l.unidade.zc;
      const fora = add(s * 6.6, zc);
      const dentro = add(s * 9.4, zc);
      liga(fora, dentro);
      // as duas faixas mais perto da porta
      const perto = lado[s]
        .map((n) => ({ n, d: Math.abs(this.nos[n].z - zc) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      perto.forEach((p) => liga(fora, p.n));
      for (const [x, z] of l.passeio) liga(dentro, add(x, z));
      this.portas.set(l.unidade.numero, { fora, dentro });
    }
  }

  noMaisPerto(x: number, z: number) {
    let melhor = 0;
    let dm = Infinity;
    this.nos.forEach((n, i) => {
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      // só vale nó que dá para ver de onde a pessoa está (sem parede no meio)
      if (d < dm && this.colisao.raio(x, z, n.x, n.z, 1) >= 1) {
        dm = d;
        melhor = i;
      }
    });
    return melhor;
  }

  /** caminho mais curto entre nós (Dijkstra simples: são poucos nós) */
  caminho(de: number, para: number): [number, number][] {
    const dist = new Array(this.nos.length).fill(Infinity);
    const veio = new Array(this.nos.length).fill(-1);
    const feito = new Array(this.nos.length).fill(false);
    dist[de] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < dist.length; i++) if (!feito[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === para) break;
      feito[u] = true;
      for (const v of this.nos[u].viz) {
        const d = dist[u] + Math.hypot(this.nos[u].x - this.nos[v].x, this.nos[u].z - this.nos[v].z);
        if (d < dist[v]) {
          dist[v] = d;
          veio[v] = u;
        }
      }
    }
    const lista: [number, number][] = [];
    for (let n = para; n >= 0; n = veio[n]) lista.unshift([this.nos[n].x, this.nos[n].z]);
    return lista[0] && dist[para] < Infinity ? lista : [];
  }

  /**
   * Caminho de um ponto a outro do shopping, em pontos do mundo: dentro de uma
   * âncora pela grade dela (A*), entre lugares pelos nós da galeria e da praça.
   */
  rotaAte(ox: number, oz: number, dx: number, dz: number): [number, number][] {
    const ao = this.ancoraEm(ox, oz);
    const ad = this.ancoraEm(dx, dz);
    const naGrade = (a: AncoraMontada, x0: number, z0: number, x1: number, z1: number) =>
      a.loja!.caminho(x0 - a.config.cx, z0 - a.config.cz, x1 - a.config.cx, z1 - a.config.cz).map(([x, z]) => [x + a.config.cx, z + a.config.cz] as [number, number]);
    if (ao && ao === ad) return naGrade(ao, ox, oz, dx, dz);
    const rota: [number, number][] = [];
    let x = ox;
    let z = oz;
    if (ao) {
      const d = this.nos[ao.dentro];
      rota.push(...naGrade(ao, x, z, d.x, d.z), [this.nos[ao.fora].x, this.nos[ao.fora].z]);
      x = this.nos[ao.fora].x;
      z = this.nos[ao.fora].z;
    }
    if (ad) {
      const de = ao ? ao.fora : this.noMaisPerto(x, z);
      const meio = this.caminho(de, ad.fora);
      if (!meio.length && de !== ad.fora) return [];
      const d = this.nos[ad.dentro];
      rota.push(...meio, [d.x, d.z], ...naGrade(ad, d.x, d.z, dx, dz));
      return rota;
    }
    if (!ao && this.colisao.raio(x, z, dx, dz, 1) >= 1) return [[dx, dz]];
    const de = ao ? ao.fora : this.noMaisPerto(x, z);
    const meio = this.caminho(de, this.noMaisPerto(dx, dz));
    if (!meio.length) return rota.length ? [...rota, [dx, dz]] : [];
    return [...rota, ...meio, [dx, dz]];
  }

  /** lugares para os visitantes passearem: dentro das lojas abertas */
  destinosPasseio(): [number, number][] {
    const daGaleria = this.lojas.filter((l) => l.inquilino).flatMap((l) => l.passeio);
    const dasAncoras = this.ancoras.flatMap((a) => (a.loja ? a.loja.passeio.map(([x, z]) => [x + a.config.cx, z + a.config.cz] as [number, number]) : []));
    return [...daGaleria, ...dasAncoras];
  }

  nosDaLoja(numero: string) {
    return this.portas.get(numero);
  }

  /** onde parar no caixa de uma loja (galeria ou âncora) */
  caixaDa(numero: string): { x: number; z: number } | null {
    const a = this.ancoras.find((x) => x.config.inquilino.unidade === numero);
    if (a?.loja) return { x: a.config.cx + a.loja.caixa.x, z: a.config.cz + a.loja.caixa.z };
    const l = this.lojas.find((x) => x.unidade.numero === numero);
    const p = l?.pontos.find((x) => x.tipo === "caixa" || x.tipo === "aluguel");
    return p ? { x: p.x, z: p.z } : null;
  }

  /** a entrada de uma loja (para "ir até lá") */
  entradaDa(numero: string): { x: number; z: number } | null {
    const a = this.ancoras.find((x) => x.config.inquilino.unidade === numero);
    if (a?.loja) return { x: this.nos[a.dentro].x, z: this.nos[a.dentro].z };
    const p = this.portas.get(numero);
    return p ? { x: this.nos[p.dentro].x, z: this.nos[p.dentro].z } : null;
  }

  descartar() {
    this.estrutura.descartar();
    this.lojas.forEach((l) => l.descartar());
    this.ancoras.forEach((a) => {
      a.loja?.descartar();
      a.atendente?.descartar();
    });
    this.reflexo?.descartar();
  }
}
