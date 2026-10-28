/**
 * Junta tudo: o prédio, as 8 lojas, as plantas, a luz do sol pela claraboia,
 * o reflexo no piso e o mapa de caminhos (para os visitantes andarem sozinhos
 * e para o "me levar até lá").
 */
import * as THREE from "three";
import { ocupacao, PLANTA, UNIDADES, type Inquilino } from "../dados/lojas";
import { Colisao } from "./colisao";
import { criarEstrutura, type PontoInteracao } from "./estrutura";
import { criarLoja, type LojaMontada } from "./loja";
import { criarMateriais, type Qualidade } from "./materiais";
import { carregarPlantas } from "./plantas";
import { ajustesSuperficie, criarReflexo, prepararSuperficie, type Reflexo } from "./superficie";

export interface No {
  x: number;
  z: number;
  viz: number[];
}

export class Shopping {
  readonly cena = new THREE.Scene();
  readonly colisao = new Colisao();
  readonly lojas: LojaMontada[] = [];
  pontos: PontoInteracao[] = [];
  readonly nos: No[] = [];
  readonly sol: THREE.DirectionalLight;
  private estrutura!: ReturnType<typeof criarEstrutura>;
  private mat: ReturnType<typeof criarMateriais>;
  private reflexo: Reflexo | null = null;
  private pisos: THREE.Mesh[] = [];
  private fixos: Colisao;
  /** colisão de cada loja (refeita junto com ela) */
  private colisaoLoja = new Map<string, Colisao>();
  /** nós de caminho da porta de cada loja */
  private portas = new Map<string, { fora: number; dentro: number }>();
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

    const hemi = new THREE.HemisphereLight("#fbf8ff", "#b9ab9c", 0.75);
    this.cena.add(hemi);
    this.sol = new THREE.DirectionalLight("#ffeedd", 2.4);
    this.sol.position.set(-14, 46, 10);
    this.sol.target.position.set(0, 0, -4);
    this.sol.castShadow = true;
    const sc = this.sol.shadow.camera;
    sc.left = -26;
    sc.right = 26;
    sc.top = 46;
    sc.bottom = -46;
    sc.near = 10;
    sc.far = 110;
    this.sol.shadow.mapSize.set(celular ? 1024 : 2048, celular ? 1024 : 2048);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.035;
    this.cena.add(this.sol, this.sol.target);

    // só o que não muda (prédio); as lojas entram por cima e podem ser refeitas
    this.fixos = new Colisao();
    this.montarEstrutura();
    UNIDADES.forEach((u) => this.montarLoja(u.numero));
    this.prepararPisos();
    this.montarCaminhos();
    void carregarPlantas("./modelos/", this.estrutura.plantas, [0]).then((p) => this.cena.add(p.grupo));
  }

  private montarEstrutura() {
    const ocupadas = [...this.ocupadas.values()].sort((a, b) => a.unidade.localeCompare(b.unidade));
    this.estrutura = criarEstrutura({
      mat: this.mat,
      colisao: this.fixos,
      ocupadas: ocupadas.map((q) => ({ numero: q.unidade, nome: q.nome, cor: q.estilo.letreiro === "pulse" ? "#3a2b22" : q.estilo.primaria, slogan: q.slogan })),
      vagas: UNIDADES.filter((u) => !this.ocupadas.has(u.numero)).map((u) => u.numero),
    });
    this.cena.add(this.estrutura.grupo);
    this.juntarColisao();
  }

  private juntarColisao() {
    const daLojas = [...this.colisaoLoja.values()];
    this.colisao.segmentos = [...this.fixos.segmentos, ...daLojas.flatMap((c) => c.segmentos)];
    this.colisao.circulos = [...this.fixos.circulos, ...daLojas.flatMap((c) => c.circulos)];
    this.pontos = [...this.estrutura.pontos, ...this.lojas.flatMap((l) => l.pontos)];
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
    this.pisos = [...this.estrutura.pisos, ...this.lojas.flatMap((l) => l.pisos)];
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

  atualizar(t: number, dt: number, pos: THREE.Vector3) {
    this.estrutura.atualizar(t, dt);
    // produtos de uma loja aparecem quando a pessoa chega perto
    for (const l of this.lojas) {
      if (!l.inquilino || l.produtosProntos) continue;
      const cx = l.unidade.lado * 14;
      if (Math.hypot(pos.x - cx, pos.z - l.unidade.zc) < 30) void l.montarProdutos();
    }
  }

  /** onde a pessoa está: loja, praça, entrada ou corredor */
  ondeEsta(x: number, z: number): { tipo: "loja" | "praca" | "entrada" | "corredor"; loja?: LojaMontada } {
    if (Math.abs(x) > PLANTA.meioCorredor && z < PLANTA.zLojasSul && z > PLANTA.zLojasNorte) {
      const loja = this.lojas.find((l) => Math.sign(x) === l.unidade.lado && z >= l.unidade.z0 && z < l.unidade.z1);
      return { tipo: "loja", loja };
    }
    if (z < PLANTA.zLojasNorte) return { tipo: "praca" };
    if (z > PLANTA.zLojasSul) return { tipo: "entrada" };
    return { tipo: "corredor" };
  }

  alvosProdutos(pos: THREE.Vector3): THREE.Mesh[] {
    return this.lojas.filter((l) => l.alvos.length && Math.hypot(pos.x - l.unidade.lado * 14, pos.z - l.unidade.zc) < 22).flatMap((l) => l.alvos);
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
    // praça
    const pe = add(-3.4, -25.6);
    const pd = add(3.4, -25.6);
    liga(pe, lado[-1][faixas.length - 1]);
    liga(pd, lado[1][faixas.length - 1]);
    liga(pe, pd);
    const anel = [add(-7, -26.6), add(-11.5, -30), add(-11.5, -36), add(-6, -39.6), add(0, -40), add(6, -39.6), add(11.5, -36), add(11.5, -30), add(7, -26.6)];
    anel.forEach((n, i) => i && liga(n, anel[i - 1]));
    liga(pe, anel[0]);
    liga(pd, anel[anel.length - 1]);
    // lojas: porta de fora, porta de dentro e os pontos de passeio
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

  /** caminho mais curto (Dijkstra simples: são poucos nós) */
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

  nosDaLoja(numero: string) {
    return this.portas.get(numero);
  }

  descartar() {
    this.estrutura.descartar();
    this.lojas.forEach((l) => l.descartar());
    this.reflexo?.descartar();
  }
}
