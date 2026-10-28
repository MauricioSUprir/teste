/**
 * Shopping da Beleza 3D — começa no provador (monta o avatar) e segue no
 * shopping: andar, entrar nas lojas, ver a ficha dos produtos, encher a
 * sacola e fechar no caixa de cada loja, tudo dentro do 3D.
 */
import "./ui/estilo.css";
import * as THREE from "three";
import { textos } from "./copy/textos";
import { gravarPrevia, lerPrevias, unidade as acharUnidade, type Inquilino } from "./dados/lojas";
import { sacola } from "./dados/sacola";
import { infoAvatar } from "./dados/avatares";
import { criarModelo, preCarregar } from "./avatar/avatares";
import { Personagem, placaDeNome } from "./avatar/personagem";
import { Provador } from "./avatar/provador";
import { Visitantes } from "./avatar/visitantes";
import { CameraTerceira } from "./motor/camera";
import { Entrada } from "./motor/entrada";
import { Motor } from "./motor/motor";
import { criarSom } from "./motor/som";
import { Shopping } from "./mundo/shopping";
import type { PontoInteracao } from "./mundo/estrutura";
import { Interface } from "./ui/interface";
import { painelAjuda, painelAluguel, painelCaixa, painelEditor, painelMapa, painelProduto, painelSacola } from "./ui/paineis";
import { lerEscolha, montarProvadorUi, type Escolha } from "./ui/provador-ui";
import type { Produto } from "./dados/catalogo";

const app = document.getElementById("app")!;

async function fontesProntas() {
  const pedidos = ["600 40px Poppins", "800 40px Poppins", "500 40px Poppins", "italic 700 40px 'Playfair Display'", "italic 600 40px 'Playfair Display'"].map((f) => document.fonts.load(f));
  await Promise.race([Promise.all(pedidos), new Promise((r) => setTimeout(r, 3000))]);
}

function iniciar() {
  let motor: Motor;
  try {
    motor = new Motor(app);
  } catch {
    app.innerHTML = `<p style="color:#fff;padding:32px;font-family:sans-serif;max-width:520px">${textos.carregando.erro3d}</p>`;
    return;
  }
  const entrada = new Entrada(motor.renderer.domElement);
  const som = criarSom();
  const celular = motor.celular;
  const ladoTextura = celular ? 512 : 1024;

  let modo: "provador" | "shopping" = "provador";
  let escolha: Escolha = lerEscolha();
  let shopping: Shopping | null = null;
  let jogador: Personagem | null = null;
  let placa: THREE.Sprite | null = null;
  let camera3: CameraTerceira | null = null;
  let visitantes: Visitantes | null = null;
  const atendentes = new Map<string, Personagem>();
  let provadorUi: ReturnType<typeof montarProvadorUi> | null = null;
  let rota: [number, number][] = [];
  let destinoRota: string | null = null;
  let ultimoGiro = -10;
  let lugarAnterior = "";
  let pontoAtual: PontoInteracao | null = null;
  let distanciaPassos = 0;
  let tempoNoShopping = 0;

  const ui = new Interface(app, entrada, celular, {
    mapa: () => abrirMapa(),
    sacola: () => painelSacola(ui, (u) => (ui.fecharPainel(), levarAte(u, true))),
    visual: () => abrirProvador(),
    musica: (sim) => som.ligar(sim),
    telaCheia: () => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.().catch(() => undefined)),
    ajuda: () => painelAjuda(ui),
    acao: () => agir(),
  });
  sacola.ouvir(() => ui.definirSacola(sacola.quantidade()));
  entrada.aoAcao = () => agir();

  // ---- provador
  const provador = new Provador(motor.ambiente);
  provador.aoCarregar = (sim) => ui.definirCarregando(sim && !provador.visualAtual() ? textos.carregando.avatares : null);

  function painelDoLado() {
    return innerWidth > 760 || innerHeight < 520;
  }

  function abrirProvador() {
    modo = "provador";
    ui.fecharPainel();
    ui.mostrarHud(false);
    motor.usar(provador.cena);
    provador.enquadrar(motor.camera, innerWidth, innerHeight, painelDoLado());
    void provador.vestir(escolha, ladoTextura);
    provadorUi?.remover();
    provadorUi = montarProvadorUi(ui.raiz, escolha, {
      emShopping: !!jogador,
      aoMudar: (e) => {
        escolha = e;
        preCarregar(e.avatar);
        void provador.vestir(e, ladoTextura);
      },
      aoEntrar: (e) => {
        escolha = e;
        // tela cheia precisa ser pedida aqui, no clique
        if (celular && document.fullscreenEnabled && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
        som.destravar();
        void entrarNoShopping();
      },
    });
  }

  function construirShopping() {
    if (shopping) return shopping;
    shopping = new Shopping(motor.renderer, motor.ambiente, motor.qualidade, celular);
    camera3 = new CameraTerceira(motor.camera, shopping.colisao);
    motor.aoMudarQualidade = (q) => shopping?.ajustarReflexo(q);
    return shopping;
  }

  async function criarAtendente(q: Inquilino) {
    const s = shopping!;
    const loja = s.lojas.find((l) => l.unidade.numero === q.unidade);
    if (!loja?.atendente) return;
    atendentes.get(q.unidade)?.descartar();
    atendentes.delete(q.unidade);
    try {
      const m = await criarModelo({ avatar: q.atendente.avatar, cabelo: null, cima: q.atendente.cor, baixo: null }, { lado: 512 });
      const p = new Personagem(m, { variarParado: true });
      p.posicao.set(loja.atendente.x, 0, loja.atendente.z);
      p.virarJa(loja.atendente.rumo);
      s.cena.add(p.objeto);
      atendentes.set(q.unidade, p);
    } catch {
      /* loja sem atendente */
    }
  }

  async function entrarNoShopping() {
    ui.definirCarregando(textos.carregando.shopping);
    // deixa o aviso aparecer antes do trabalho pesado
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    const s = construirShopping();
    const novo = !jogador;
    const modelo = await criarModelo(escolha, { lado: ladoTextura });
    const pos = jogador ? jogador.posicao.clone() : new THREE.Vector3(0, 0, 31);
    const rumo = jogador ? jogador.rumo : Math.PI;
    jogador?.descartar();
    jogador = new Personagem(modelo);
    jogador.posicao.copy(pos);
    jogador.virarJa(rumo);
    if (placa) {
      placa.material.map?.dispose();
      placa.material.dispose();
    }
    placa = escolha.nome ? placaDeNome(escolha.nome, "#e8467c") : null;
    if (placa) {
      placa.position.y = infoAvatar(escolha.avatar).altura + 0.28;
      jogador.objeto.add(placa);
    }
    s.cena.add(jogador.objeto);
    provadorUi?.remover();
    provadorUi = null;
    provador.descartar();
    motor.camera.clearViewOffset();
    motor.camera.fov = celular && innerHeight > innerWidth ? 62 : 55;
    motor.camera.updateProjectionMatrix();
    camera3!.giro = rumo + Math.PI;
    camera3!.reiniciar();
    motor.usar(s.cena);
    modo = "shopping";
    tempoNoShopping = 0;
    ui.definirCarregando(null);
    ui.mostrarHud(true);
    som.ligar(true);
    if (novo) {
      ui.avisar(textos.avisos.bemVindo(escolha.nome));
      for (const q of s.ocupadas.values()) void criarAtendente(q);
      visitantes = new Visitantes(s);
      s.cena.add(visitantes.grupo);
      void visitantes.criar(celular ? 5 : 10, escolha.avatar, 512);
      let viu = false;
      try {
        viu = localStorage.getItem("shopping3d.ajuda") === "1";
        localStorage.setItem("shopping3d.ajuda", "1");
      } catch {
        /* sem armazenamento */
      }
      if (!viu) setTimeout(() => modo === "shopping" && !ui.painelAberto && painelAjuda(ui), 1200);
    }
  }

  // ---- ações

  function caminhoAte(x: number, z: number): [number, number][] {
    const s = shopping!;
    const p = jogador!.posicao;
    if (s.colisao.raio(p.x, p.z, x, z, 1) >= 1) return [[x, z]];
    const de = s.noMaisPerto(p.x, p.z);
    const para = s.noMaisPerto(x, z);
    const c = s.caminho(de, para);
    return c.length ? [...c, [x, z]] : [];
  }

  function levarAte(numero: string, aoCaixa = false) {
    const s = shopping!;
    const loja = s.lojas.find((l) => l.unidade.numero === numero);
    const portas = s.nosDaLoja(numero);
    if (!loja || !portas) return;
    const p = jogador!.posicao;
    const fim = aoCaixa ? loja.pontos.find((x) => x.tipo === "caixa") : loja.pontos.find((x) => x.tipo === "aluguel");
    const c = s.caminho(s.noMaisPerto(p.x, p.z), portas.dentro);
    if (!c.length) {
      ui.avisar(textos.avisos.semCaminho);
      return;
    }
    rota = fim ? [...c, [fim.x, fim.z]] : c;
    destinoRota = loja.inquilino?.nome ?? textos.aluguel.unidade(numero);
    ui.avisar(textos.avisos.levando(destinoRota));
  }

  function abrirMapa() {
    if (!shopping || !jogador) return;
    painelMapa(ui, shopping.ocupadas, () => ({ x: jogador!.posicao.x, z: jogador!.posicao.z }), (u) => {
      ui.fecharPainel();
      levarAte(u);
    });
  }

  function abrirEditor(numero: string) {
    const s = shopping!;
    const u = acharUnidade(numero);
    const atual = lerPrevias()[numero] ?? null;
    painelEditor(
      ui,
      u,
      atual,
      (l) => {
        gravarPrevia(numero, l);
        s.refazerLoja(numero);
        const q = s.ocupadas.get(numero);
        if (q) void criarAtendente(q);
        ui.fecharPainel();
        ui.avisar(textos.editor.aberta(q?.nome ?? l.nome));
      },
      atual
        ? () => {
            gravarPrevia(numero, null);
            s.refazerLoja(numero);
            atendentes.get(numero)?.descartar();
            atendentes.delete(numero);
            ui.fecharPainel();
            ui.avisar(textos.editor.desmontada);
          }
        : null
    );
  }

  function agir() {
    if (modo !== "shopping" || !shopping || !pontoAtual) return;
    const pt = pontoAtual;
    som.balao();
    if (pt.tipo === "mapa") abrirMapa();
    else if (pt.tipo === "provador") abrirProvador();
    else if (pt.tipo === "caixa" && pt.unidade) {
      const q = shopping.ocupadas.get(pt.unidade);
      if (q) painelCaixa(ui, q);
    } else if (pt.tipo === "aluguel" && pt.unidade) {
      const numero = pt.unidade;
      painelAluguel(ui, acharUnidade(numero), () => abrirEditor(numero));
    }
  }

  function abrirProduto(m: THREE.Mesh) {
    const { produto, loja, nitida } = m.userData as { produto: Produto; loja: Inquilino; nitida: (l: number) => Promise<THREE.Texture> };
    som.balao();
    painelProduto(ui, produto, loja, () => som.cesta());
    // de perto: a foto do produto em resolução maior
    if (!m.userData.nitidaFeita) {
      m.userData.nitidaFeita = true;
      void nitida(512)
        .then((t) => {
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.map?.dispose();
          mat.map = t;
          mat.emissiveMap = t;
          mat.needsUpdate = true;
        })
        .catch(() => undefined);
    }
  }

  // ---- cursor e toque
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const marcador = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.9, 1.4), transparent: true, depthWrite: false }));
  marcador.visible = false;
  let marcadorVida = 0;

  function produtoEm(x: number, y: number): THREE.Mesh | null {
    if (!shopping || !jogador) return null;
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, motor.camera);
    raycaster.far = 14;
    const alvos = shopping.alvosProdutos(jogador.posicao);
    const hit = raycaster.intersectObjects(alvos, false)[0];
    if (!hit) return null;
    // parede no meio esconde o produto; vitrine (mais baixa que 4,2 m) deixa ver
    const c = motor.camera.position;
    if (shopping.colisao.raio(c.x, c.z, hit.point.x, hit.point.z, 4.2) < 0.98) return null;
    return hit.object as THREE.Mesh;
  }

  entrada.aoApertar = (a) => {
    if (modo !== "shopping" || !shopping || !jogador) return;
    if (ui.painelCobre()) return;
    const m = produtoEm(a.x, a.y);
    if (m) {
      abrirProduto(m);
      return;
    }
    ndc.set((a.x / innerWidth) * 2 - 1, -(a.y / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, motor.camera);
    raycaster.far = 60;
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(chao, p) || p.distanceTo(jogador.posicao) > 45) return;
    rota = caminhoAte(p.x, p.z);
    destinoRota = null;
    if (rota.length) {
      marcador.position.set(p.x, 0.02, p.z);
      marcador.visible = true;
      marcadorVida = 1.6;
      if (!marcador.parent) shopping.cena.add(marcador);
    }
  };

  // ---- quadro a quadro
  const relogio = new THREE.Clock();
  let tempo = 0;

  function quadro() {
    // aparelho lento: até 0,1 s por quadro (senão a pessoa anda em câmera lenta)
    const dt = Math.min(0.1, relogio.getDelta());
    tempo += dt;
    const giro = entrada.consumirGiro();
    if (modo === "provador") {
      provador.girar(giro.x);
      provador.atualizar(dt);
      motor.desenhar();
      return;
    }
    if (!shopping || !jogador || !camera3) return;
    tempoNoShopping += dt;
    if (tempoNoShopping > 6) motor.medir(dt);
    const s = shopping;
    if (giro.x || giro.y || giro.zoom) {
      camera3.girar(giro.x, giro.y, giro.zoom);
      if (giro.x || giro.y) ultimoGiro = tempo;
    }

    // movimento: teclado/joystick relativo à câmera; senão, a rota do clique
    const dir = ui.painelCobre() ? { x: 0, y: 0, rapido: false } : entrada.direcao();
    const [fx, fz] = camera3.frente();
    let mx = fx * dir.y - fz * dir.x;
    let mz = fz * dir.y + fx * dir.x;
    let vel = 0;
    const p = jogador.posicao;
    if (Math.hypot(mx, mz) > 0.05) {
      rota = [];
      destinoRota = null;
      vel = jogador.passo * (dir.rapido ? 1.9 : 1.3) * Math.min(1, Math.hypot(mx, mz));
    } else if (rota.length) {
      const [tx, tz] = rota[0];
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) {
        rota.shift();
        if (!rota.length && destinoRota) {
          ui.avisar(textos.avisos.chegou, 1500);
          destinoRota = null;
        }
      } else {
        mx = dx / d;
        mz = dz / d;
        vel = jogador.passo * (destinoRota ? 1.7 : 1.35);
      }
    }
    if (vel > 0) {
      const l = Math.hypot(mx, mz) || 1;
      const passo = vel * dt;
      const [nx, nz] = s.colisao.resolver(p.x + (mx / l) * passo, p.z + (mz / l) * passo, 0.32);
      const andou = Math.hypot(nx - p.x, nz - p.z);
      // bateu e não anda: desiste da rota
      if (rota.length && andou < passo * 0.15) rota.shift();
      p.x = nx;
      p.z = nz;
      jogador.olharPara(Math.atan2(mx, mz));
      distanciaPassos += andou;
      if (distanciaPassos > 0.78) {
        distanciaPassos = 0;
        som.passo();
      }
      // câmera volta para trás da pessoa quando ela anda para a frente (e ninguém mexe na câmera)
      if (tempo - ultimoGiro > 2.5 && (dir.y > 0.4 || rota.length)) camera3.seguirRumo(jogador.rumo, dt, rota.length ? 1.6 : 0.9);
      vel = andou / dt;
    }
    jogador.atualizar(dt, vel);
    camera3.atualizar(dt, p, infoAvatar(escolha.avatar).altura);

    // onde está
    const onde = s.ondeEsta(p.x, p.z);
    const lugar =
      onde.tipo === "loja" ? (onde.loja?.inquilino?.nome ?? textos.aluguel.unidade(onde.loja?.unidade.numero ?? "")) : onde.tipo === "praca" ? textos.hud.praca : onde.tipo === "entrada" ? textos.hud.entrada : textos.hud.corredor;
    ui.definirLocal(lugar);
    if (lugar !== lugarAnterior) {
      if (onde.tipo === "loja" && onde.loja?.inquilino) {
        ui.avisar(textos.dicas.entrou(onde.loja.inquilino.nome));
        som.porta();
      }
      lugarAnterior = lugar;
    }

    // ponto de ação mais perto
    let melhor: PontoInteracao | null = null;
    let dm = Infinity;
    for (const pt of s.pontos) {
      const d = Math.hypot(pt.x - p.x, pt.z - p.z);
      if (d < pt.raio && d < dm) {
        dm = d;
        melhor = pt;
      }
    }
    pontoAtual = melhor;
    ui.definirDica(melhor && !ui.painelAberto ? melhor.rotulo : null);

    // cursor em cima de produto (computador)
    if (!celular && entrada.mouse && !ui.painelAberto) {
      if (entrada.mouseMexeu || vel > 0) {
        entrada.mouseMexeu = false;
        const m = produtoEm(entrada.mouse.x, entrada.mouse.y);
        motor.renderer.domElement.classList.toggle("apontando", !!m);
        if (m) ui.mostrarBalao(m.userData.produto as Produto, (m.userData.loja as Inquilino).nome, entrada.mouse.x, entrada.mouse.y);
        else ui.esconderBalao();
      }
    } else ui.esconderBalao();

    if (marcador.visible) {
      marcadorVida -= dt;
      (marcador.material as THREE.MeshBasicMaterial).opacity = Math.max(0, Math.min(1, marcadorVida));
      marcador.scale.setScalar(1 + (1.6 - marcadorVida) * 0.25);
      if (marcadorVida <= 0 || !rota.length) marcador.visible = false;
    }

    visitantes?.atualizar(dt, p);
    for (const a of atendentes.values()) {
      // olha para o cliente que chega no balcão
      const d = Math.hypot(a.posicao.x - p.x, a.posicao.z - p.z);
      if (d < 4.5) a.olharPara(Math.atan2(p.x - a.posicao.x, p.z - a.posicao.z));
      a.atualizar(dt, 0);
    }
    s.atualizar(tempo, dt, p);
    s.preparar(motor.camera, placa ? [placa] : []);
    motor.desenhar();
  }

  motor.renderer.setAnimationLoop(quadro);

  // ganchos para os testes automáticos (só com #teste no endereço)
  if (location.hash === "#teste") {
    Object.assign(window, {
      __teste: {
        ir: (x: number, z: number, rumo: number, giro?: number) => {
          if (!jogador || !camera3) return;
          rota = [];
          jogador.posicao.set(x, 0, z);
          jogador.virarJa(rumo);
          camera3.giro = giro ?? rumo + Math.PI;
          camera3.reiniciar();
        },
        estado: () => ({
          modo,
          qualidade: motor.qualidade,
          lojasProntas: shopping?.lojas.filter((l) => l.produtosProntos).length ?? 0,
          produtos: shopping?.lojas.reduce((n, l) => n + l.alvos.length, 0) ?? 0,
          visitantes: visitantes ? visitantes.grupo.children.length : 0,
          atendentes: atendentes.size,
          pos: jogador ? [jogador.posicao.x, jogador.posicao.z] : null,
          painel: ui.painelAberto,
          rota: rota.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]),
          chamadas: motor.renderer.info.render.calls,
          triangulos: motor.renderer.info.render.triangles,
        }),
        agir,
        levarAte,
      },
    });
  }
  addEventListener("resize", () => {
    shopping?.redimensionar();
    if (modo === "provador") provador.enquadrar(motor.camera, innerWidth, innerHeight, painelDoLado());
    else {
      motor.camera.fov = celular && innerHeight > innerWidth ? 62 : 55;
      motor.camera.updateProjectionMatrix();
    }
  });
  document.addEventListener("visibilitychange", () => relogio.getDelta());

  // ---- começo: fontes → provador → shopping montado por trás
  void (async () => {
    await fontesProntas();
    ui.definirCarregando(textos.carregando.avatares);
    abrirProvador();
    // o shopping é montado enquanto a pessoa escolhe o visual
    setTimeout(() => {
      construirShopping();
      // compila os materiais fora da vista para a entrada não engasgar
      void motor.renderer.compileAsync(shopping!.cena, motor.camera).catch(() => undefined);
    }, 600);
  })();
}

iniciar();
