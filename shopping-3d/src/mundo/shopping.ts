/**
 * Junta tudo: o lado de fora (fachada, praça da frente, estacionamento e a
 * cidade), o térreo, o átrio de três andares, as 8 lojas da galeria, as duas
 * lojas âncora (a loja 3D dos sites, no fundo da praça), as plantas, a luz de
 * fim de tarde (o sol entra pela fachada de vidro e pela claraboia), o
 * reflexo no piso e os caminhos (para os visitantes andarem sozinhos e para o
 * "me levar até lá": mapa de nós e A* na grade das âncoras).
 */
import * as THREE from "three";
import { ANCORAS, ocupacao, PLANTA, UNIDADES, zFachadaEm, type Ancora, type Inquilino } from "../dados/lojas";
import { registrarMarcas, type Produto } from "../dados/catalogo";
import { textos } from "../copy/textos";
import { Colisao } from "./colisao";
import { criarEstrutura, type PontoInteracao } from "./estrutura";
import { caminhoVaranda, criarAtrio, noVazio, type Atrio } from "./atrio";
import { criarExterior, type Exterior } from "./exterior";
import { criarLoja, type LojaMontada } from "./loja";
import { ALTURA as ALTURA_ANCORA, FUNDO as FUNDO_ANCORA, LARGURA as LARGURA_ANCORA, PAREDE as PAREDE_ANCORA, montarLojaDoSite, type LojaSite, type SetorCena } from "./loja-site";
import { AtendenteSite } from "./atendente-site";
import { criarMateriais, type Qualidade } from "./materiais";
import { carregarPlantas } from "./plantas";
import { ajustesSuperficie, criarReflexo, prepararSuperficie, type Reflexo } from "./superficie";
import { FONTE, usarTexturasLeves } from "./letreiros";
import { aliviarMemoria } from "./memoria";

export interface No {
  x: number;
  z: number;
  viz: number[];
}

export interface Lugar {
  tipo: "loja" | "praca" | "entrada" | "corredor" | "fora";
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
/** de onde vem o sol (fim de tarde, da frente e da esquerda de quem olha a fachada) */
const DIRECAO_SOL = new THREE.Vector3(-0.42, 0.66, 0.62).normalize();
/** as portas abrem quando alguém chega a esta distância delas */
const PERTO_DA_PORTA = 4.2;

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
  private atrio!: Atrio;
  private exterior!: Exterior;
  private aberturaPorta = 0;
  private alcanceSombra: number;
  private mat: ReturnType<typeof criarMateriais>;
  private reflexo: Reflexo | null = null;
  private pisos: THREE.Object3D[] = [];
  private fixos: Colisao;
  /** colisão de cada loja (refeita junto com ela) */
  private colisaoLoja = new Map<string, Colisao>();
  /** nós de caminho da porta de cada loja */
  private portas = new Map<string, { fora: number; dentro: number }>();
  readonly ancoras: AncoraMontada[];
  /** os laços das varandas dos pisos 2 e 3 (para a gente de enfeite andar lá em cima) */
  readonly varandas = [
    { pontos: caminhoVaranda(), y: PLANTA.piso2 },
    { pontos: caminhoVaranda(), y: PLANTA.piso3 },
  ];
  ocupadas: Map<string, Inquilino>;

  constructor(
    private renderer: THREE.WebGLRenderer,
    ambiente: THREE.Texture,
    private qualidade: Qualidade,
    private celular: boolean,
    /** o aparelho já ficou sem memória antes (começa mais leve) */
    economia = false
  ) {
    usarTexturasLeves(celular);
    // no celular, o que vai para a placa de vídeo sai da memória do navegador
    aliviarMemoria(celular);
    this.cena.environment = ambiente;
    this.cena.environmentIntensity = 0.42;
    // névoa morna de fim de tarde: só a cidade lá longe sente
    this.cena.fog = new THREE.Fog("#eadbd6", 260, 900);
    this.mat = criarMateriais(qualidade);
    this.ocupadas = ocupacao();
    this.ancoras = ANCORAS.map((config) => ({ config, loja: null, atendente: null, fora: -1, dentro: -1, produtoDe: new Map(), ativa: false }));

    const hemi = new THREE.HemisphereLight("#fff1e6", "#b9a698", 0.62);
    this.cena.add(hemi);
    // luz de cima, sem sombra: o shopping é claro até embaixo das varandas
    const preenche = new THREE.DirectionalLight("#f6efff", 0.38);
    preenche.position.set(0.15, 1, 0.25);
    this.cena.add(preenche);
    // sol dourado do fim de tarde; a sombra acompanha quem está olhando (um quadrado em volta)
    this.sol = new THREE.DirectionalLight("#ffd6aa", 2.7);
    // aparelho lento (ou que já ficou sem memória): sem a sombra do sol desde o começo
    this.sol.castShadow = qualidade === "alta" || qualidade === "media";
    this.alcanceSombra = celular ? 40 : 55;
    const sc = this.sol.shadow.camera;
    sc.left = -this.alcanceSombra;
    sc.right = this.alcanceSombra;
    sc.top = this.alcanceSombra;
    sc.bottom = -this.alcanceSombra;
    sc.near = 1;
    sc.far = 280;
    const lado = celular ? 2048 : 4096;
    this.sol.shadow.mapSize.set(lado, lado);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.035;
    this.cena.add(this.sol, this.sol.target);
    this.seguirSol(new THREE.Vector3(0, 0, 30));

    // só o que não muda (prédio); as lojas entram por cima e podem ser refeitas
    this.fixos = new Colisao();
    this.paredesDasAncoras();
    this.montarEstrutura();
    this.cena.background = this.exterior.cidade.ceu;
    UNIDADES.forEach((u) => this.montarLoja(u.numero));
    this.prepararPisos();
    this.montarCaminhos();
    void carregarPlantas("./modelos/", [...this.estrutura.plantas, ...this.atrio.plantas, ...this.exterior.plantas], [0]).then((p) => {
      // no celular as plantas não fazem sombra (são milhares de folhas)
      if (this.celular) p.grupo.traverse((o) => (o.castShadow = false));
      this.cena.add(p.grupo);
    });
    // a cidade ganha as texturas boas depois que as lojas âncora estão de pé
    // no celular a cidade fica com as cores lisas (as texturas boas pesam na memória)
    // no celular (e depois de uma queda) as lojas âncora só montam quando a pessoa entra no prédio:
    // a entrada pela praça da frente fica leve
    const entrou = celular || economia ? new Promise<void>((ok) => (this.aoEntrar = ok)) : Promise.resolve();
    this.pronto = entrou.then(() => this.montarAncoras()).then(() => (celular ? undefined : this.exterior.cidade.detalhar()));
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
    this.atrio = criarAtrio({ mat: this.mat, colisao: this.fixos, celular: this.celular, ocupadas: ocupadas.map((q) => ({ nome: q.nome, cor: q.estilo.letreiro === "pulse" ? "#3a2b22" : q.estilo.primaria, slogan: q.slogan })) });
    this.cena.add(this.atrio.grupo);
    this.exterior = criarExterior({ mat: this.mat, colisao: this.fixos, renderer: this.renderer, celular: this.celular });
    this.cena.add(this.exterior.grupo);
    this.juntarColisao();
  }

  /** a sombra do sol cobre um quadrado em volta de `centro`, preso à grade dos pixels dela (não "treme" ao andar) */
  private seguirSol(centro: THREE.Vector3) {
    const d = DIRECAO_SOL;
    const direita = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
    const cima = new THREE.Vector3().crossVectors(d, direita);
    const pixel = (this.alcanceSombra * 2) / this.sol.shadow.mapSize.x;
    const a = centro.dot(direita);
    const b = centro.dot(cima);
    const c = centro.clone().addScaledVector(direita, Math.round(a / pixel) * pixel - a).addScaledVector(cima, Math.round(b / pixel) * pixel - b);
    this.sol.target.position.copy(c);
    this.sol.position.copy(c).addScaledVector(d, 140);
    this.sol.target.updateMatrixWorld();
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
    this.pisos = [...this.estrutura.pisos, ...this.lojas.flatMap((l) => l.pisos), ...this.ancoras.flatMap((a) => a.loja?.foraDoReflexo ?? []), ...this.exterior.foraDoReflexo];
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
    // aparelho lento: sem a sombra do sol (é o que mais pesa depois do reflexo)
    this.sol.castShadow = q === "alta" || q === "media";
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
    // a sombra fica em volta do que a câmera vê: um pouco à frente dela, no chão
    camera.getWorldDirection(this.aux);
    this.aux.y = 0;
    this.aux.normalize().multiplyScalar(this.alcanceSombra * 0.45).add(camera.position);
    this.aux.y = 0;
    this.seguirSol(this.aux);
    if (this.reflexo && ajustesSuperficie.forcaReflexo.value > 0) this.reflexo.atualizar(this.cena, camera, [...this.pisos, ...esconderNoReflexo]);
  }

  private aux = new THREE.Vector3();
  /** `pessoas`: onde estão os outros (visitantes e gente online), para abrir a porta */
  private aoEntrar: (() => void) | null = null;
  atualizar(t: number, dt: number, pos: THREE.Vector3, pessoas: { x: number; z: number }[] = []) {
    if (this.aoEntrar && pos.z < PLANTA.zLojasSul + 6) {
      this.aoEntrar();
      this.aoEntrar = null;
    }
    this.estrutura.atualizar(t, dt);
    this.atrio.atualizar(t, dt);
    this.exterior.atualizar(t, dt);
    const zPorta = PLANTA.zEntrada;
    const perto = Math.hypot(pos.x, pos.z - zPorta) < PERTO_DA_PORTA || pessoas.some((p) => Math.hypot(p.x, p.z - zPorta) < PERTO_DA_PORTA);
    this.aberturaPorta = THREE.MathUtils.clamp(this.aberturaPorta + (perto ? dt : -dt) * 1.4, 0, 1);
    this.exterior.portas(this.aberturaPorta);
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
    if (z > zFachadaEm(x) + 0.3) return 60;
    const ax = Math.abs(x);
    if (ax > PLANTA.meioCorredor && z < PLANTA.zLojasSul && z > PLANTA.zLojasNorte) return PLANTA.tetoLoja - 0.3;
    // no vazio do átrio, até perto da claraboia; embaixo das varandas, o teto do térreo
    if (noVazio(x, z)) return PLANTA.cobertura - 0.8;
    return PLANTA.piso2 - PLANTA.espLaje - 0.3;
  }

  /** onde a pessoa está: loja (da galeria ou âncora), praça, entrada, corredor ou a praça da frente */
  ondeEsta(x: number, z: number): Lugar {
    if (z > zFachadaEm(x) - 0.05) return { tipo: "fora" };
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
    // galeria e saguão: duas faixas (x = ±3,4) de nós
    const faixas = [36.5, 32, 27, 21, 15, 9, 3, -3, -9, -15, -21];
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
    // saguão: os cantos, o provador e a porta (dentro e fora)
    for (const s of [-1, 1]) {
      const a = add(s * 13.5, 35);
      const b = add(s * 13.5, 28.5);
      liga(a, b);
      liga(a, lado[s][1]);
      liga(b, lado[s][2]);
      if (s > 0) {
        const p = add(15, 31.5);
        liga(p, a);
        liga(p, b);
      }
    }
    const dentro = add(0, 41.2);
    const fora = add(0, 47.6);
    liga(dentro, fora);
    liga(dentro, lado[-1][0]);
    liga(dentro, lado[1][0]);
    // praça da frente: em volta dos canteiros, até a calçada
    const f: Record<string, number> = {};
    for (const s of [-1, 1]) {
      f[`a${s}`] = add(s * 10, 47.2);
      f[`b${s}`] = add(s * 24, 46.5);
      f[`c${s}`] = add(s * 23, 56.8);
      f[`d${s}`] = add(s * 15, 64.2);
      f[`e${s}`] = add(s * 4.5, 58);
      liga(fora, f[`a${s}`]);
      liga(f[`a${s}`], f[`b${s}`]);
      liga(f[`b${s}`], f[`c${s}`]);
      liga(f[`c${s}`], f[`d${s}`]);
      liga(fora, f[`e${s}`]);
    }
    const calcada = add(0, 63.5);
    // o meio da praça da frente (onde se chega)
    const meio = add(0, 56.5);
    liga(meio, fora);
    liga(meio, calcada);
    for (const s of [-1, 1]) {
      liga(calcada, f[`d${s}`]);
      liga(calcada, f[`e${s}`]);
      liga(meio, f[`e${s}`]);
    }
    // Praça da Beleza: anel em volta do lounge e do quiosque, as alas e a frente das âncoras
    const ult = faixas.length - 1;
    const pe = add(-3.4, -25.6);
    const pd = add(3.4, -25.6);
    liga(pe, lado[-1][ult]);
    liga(pd, lado[1][ult]);
    liga(pe, pd);
    const anel: number[] = [];
    const alas: number[] = [];
    for (const s of [-1, 1]) {
      const r1 = add(s * 4.6, -27.2);
      const r2 = add(s * 5.3, -32.5);
      const r3 = add(s * 3.6, -38.6);
      liga(r1, r2);
      liga(r2, r3);
      liga(r1, s < 0 ? pe : pd);
      const w1 = add(s * 11, -30.5);
      const w2 = add(s * 11, s > 0 ? -37.5 : -38.5);
      const w3 = add(s * 24, -30);
      const w4 = add(s * 24, s > 0 ? -37.5 : -39);
      liga(w1, w2);
      liga(w2, w4);
      liga(w3, w4);
      // do lado direito a escada rolante fica entre w1 e w3: passa por baixo dela, em w2–w4
      if (s < 0) liga(w1, w3);
      liga(r1, w1);
      liga(r2, w1);
      liga(r3, w2);
      anel.push(r1, r2, r3);
      alas.push(w1, w2, w3, w4);
    }
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
    this.atrio.descartar();
    this.exterior.descartar();
    this.lojas.forEach((l) => l.descartar());
    this.ancoras.forEach((a) => {
      a.loja?.descartar();
      a.atendente?.descartar();
    });
    this.reflexo?.descartar();
  }
}
