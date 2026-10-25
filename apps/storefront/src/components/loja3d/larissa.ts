/**
 * A Larissa no caixa: uma atendente 3D de verdade (modelo com esqueleto do
 * Microsoft Rocketbox, licença MIT), de blazer na cor da loja. Respira parada
 * e, quando a pessoa chega perto, conversa gesticulando (animações de captura
 * de movimento do mesmo pacote); o corpo e a cabeça viram para quem chega.
 * Se o modelo não baixar, fica a atendente em estilo de ilustração, que
 * respira, vira a cabeça e acena. Em cima, um balão chama para conversar.
 * Clicar nela (ou no balão) abre o card do WhatsApp — quem decide isso é a cena.
 *
 * Origem nos pés, de frente para +z.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export interface OpcoesLarissa {
  corRoupa: THREE.Color;
  fonte: string;
  nome: string;
  /** duas linhas do balão */
  balao: [string, string];
  /** modelo 3D (.glb) com as animações "respirar" e "falar" */
  modelo?: string;
}

export interface Larissa {
  grupo: THREE.Group;
  /** o que recebe o clique (corpo e balão) */
  alvos: THREE.Object3D[];
  /** `perto` = distância da pessoa até ela (m), `olhar` = posição da câmera */
  atualizar: (dt: number, olhar: THREE.Vector3, perto: number) => void;
  /** acabou de começar a acenar (para o som do balão) */
  acenou: () => boolean;
  /** clicaram nela: começa a conversar */
  conversar: () => void;
  descartar: () => void;
}

const PELE = "#c98f6c";
const CABELO = "#3a2a21";

/** rosto desenhado no mapa da esfera: em u = 0,25 fica a frente (+z) */
function texturaRosto() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = PELE;
    g.fillRect(0, 0, 512, 256);
    const cx = 128;
    // olhos fechados sorrindo, cílios e sobrancelhas
    g.strokeStyle = "#2a1c16";
    g.lineCap = "round";
    g.lineWidth = 5;
    for (const lado of [-1, 1]) {
      g.beginPath();
      g.arc(cx + lado * 21, 128, 9, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx + lado * 13, 106);
      g.quadraticCurveTo(cx + lado * 22, 100, cx + lado * 31, 105);
      g.stroke();
      g.lineWidth = 5;
      // blush
      g.fillStyle = "rgba(226, 112, 112, 0.35)";
      g.beginPath();
      g.ellipse(cx + lado * 30, 146, 11, 7, 0, 0, Math.PI * 2);
      g.fill();
    }
    // sorriso
    g.strokeStyle = "#9b3f45";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx, 150, 13, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaTexto(largura: number, altura: number, desenhar: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = largura;
  c.height = altura;
  const g = c.getContext("2d");
  if (g) desenhar(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function criarLarissa(o: OpcoesLarissa): Larissa {
  const lixo: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (lixo.push(x), x);
  const fisico = (cor: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
    guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, ...extra }));
  const pele = fisico(PELE, { roughness: 0.55 });
  const cabelo = fisico(CABELO, { roughness: 0.45 });
  const roupa = guardar(new THREE.MeshPhysicalMaterial({ color: o.corRoupa, roughness: 0.75, sheen: 0.6, sheenRoughness: 0.5, sheenColor: o.corRoupa.clone().lerp(new THREE.Color("#ffffff"), 0.5) }));
  const calca = fisico("#2b2b31", { roughness: 0.8 });

  const grupo = new THREE.Group();
  const boneco = new THREE.Group(); // a atendente desenhada (some quando a 3D chega)
  grupo.add(boneco);
  const corpo = new THREE.Group(); // tudo acima da cintura (respira)
  corpo.position.y = 0.95;
  boneco.add(corpo);
  const sombrear = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // pernas e quadril
  const geoPerna = guardar(new THREE.CapsuleGeometry(0.068, 0.78, 6, 16));
  for (const lado of [-1, 1]) {
    const perna = sombrear(new THREE.Mesh(geoPerna, calca));
    perna.position.set(lado * 0.085, 0.46, 0);
    boneco.add(perna);
  }
  // tronco: perfil girado (cintura fina, peito, ombros), achatado na frente
  const perfil = [
    [0.0, -0.12],
    [0.15, -0.12],
    [0.16, -0.04],
    [0.125, 0.1],
    [0.15, 0.26],
    [0.168, 0.38],
    [0.14, 0.45],
    [0.06, 0.49],
    [0.0, 0.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tronco = sombrear(new THREE.Mesh(guardar(new THREE.LatheGeometry(perfil, 40)), roupa));
  tronco.scale.set(1.18, 1, 0.72);
  corpo.add(tronco);
  // gola em V da pele e o crachá
  const decote = new THREE.Mesh(guardar(new THREE.CircleGeometry(0.05, 3)), pele);
  decote.position.set(0, 0.44, 0.105);
  decote.rotation.set(-0.35, 0, -Math.PI / 2);
  corpo.add(decote);
  const cracha = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(0.085, 0.028)),
    guardar(
      new THREE.MeshBasicMaterial({
        map: guardar(
          texturaTexto(256, 84, (g) => {
            g.fillStyle = "#ffffff";
            g.beginPath();
            g.roundRect(0, 0, 256, 84, 14);
            g.fill();
            g.fillStyle = "#26262c";
            g.font = `700 48px ${o.fonte}`;
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText(o.nome.toUpperCase(), 128, 46);
          })
        ),
        color: new THREE.Color(0.9, 0.9, 0.9),
      })
    )
  );
  cracha.position.set(0.075, 0.33, 0.125);
  cracha.rotation.set(-0.15, 0.32, 0);
  corpo.add(cracha);

  // pescoço, cabeça e cabelo (coque atrás)
  const pescoco = sombrear(new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.042, 0.048, 0.1, 16)), pele));
  pescoco.position.y = 0.53;
  corpo.add(pescoco);
  const cabeca = new THREE.Group();
  cabeca.position.y = 0.66;
  corpo.add(cabeca);
  const rosto = guardar(new THREE.MeshStandardMaterial({ map: guardar(texturaRosto()), roughness: 0.55 }));
  const geoCabeca = guardar(new THREE.SphereGeometry(0.095, 40, 28));
  const face = sombrear(new THREE.Mesh(geoCabeca, rosto));
  face.scale.set(0.9, 1.08, 0.95);
  cabeca.add(face);
  // cabelo: casca da esfera só em cima e atrás, deixando o rosto livre
  const geoCabelo = guardar(new THREE.SphereGeometry(0.103, 40, 24, Math.PI * 0.95, Math.PI * 1.6, 0, Math.PI * 0.62));
  const capa = sombrear(new THREE.Mesh(geoCabelo, cabelo));
  capa.scale.set(0.92, 1.08, 0.98);
  capa.position.set(0, 0.008, -0.004);
  cabeca.add(capa);
  const franja = sombrear(new THREE.Mesh(guardar(new THREE.SphereGeometry(0.1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.3)), cabelo));
  franja.scale.set(0.93, 1.05, 0.99);
  franja.position.y = 0.012;
  cabeca.add(franja);
  const coque = sombrear(new THREE.Mesh(guardar(new THREE.SphereGeometry(0.055, 24, 16)), cabelo));
  coque.position.set(0, 0.05, -0.1);
  cabeca.add(coque);

  // braços: ombro → cotovelo → mão, cada articulação um grupo
  const geoBraco = guardar(new THREE.CapsuleGeometry(0.038, 0.22, 6, 12));
  const geoAntebraco = guardar(new THREE.CapsuleGeometry(0.033, 0.2, 6, 12));
  const geoMao = guardar(new THREE.SphereGeometry(0.038, 16, 12));
  const bracos: { ombro: THREE.Group; cotovelo: THREE.Group }[] = [];
  for (const lado of [-1, 1]) {
    const ombro = new THREE.Group();
    ombro.position.set(lado * 0.19, 0.4, 0);
    corpo.add(ombro);
    const braco = sombrear(new THREE.Mesh(geoBraco, roupa));
    braco.position.y = -0.14;
    ombro.add(braco);
    const cotovelo = new THREE.Group();
    cotovelo.position.y = -0.28;
    ombro.add(cotovelo);
    const antebraco = sombrear(new THREE.Mesh(geoAntebraco, pele));
    antebraco.position.y = -0.13;
    cotovelo.add(antebraco);
    const mao = sombrear(new THREE.Mesh(geoMao, pele));
    mao.scale.set(0.9, 1.2, 0.7);
    mao.position.y = -0.27;
    cotovelo.add(mao);
    bracos.push({ ombro, cotovelo });
  }

  // balão de fala, sempre virado para a câmera
  const texBalao = guardar(
    texturaTexto(512, 220, (g) => {
      g.fillStyle = "#ffffff";
      g.shadowColor = "rgba(0,0,0,0.18)";
      g.shadowBlur = 12;
      g.beginPath();
      g.roundRect(14, 10, 484, 160, 40);
      g.fill();
      g.beginPath();
      g.moveTo(236, 166);
      g.lineTo(256, 206);
      g.lineTo(280, 166);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#26262c";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `700 50px ${o.fonte}`;
      g.fillText(o.balao[0], 256, 66);
      g.fillStyle = "#1f9d55";
      g.font = `600 36px ${o.fonte}`;
      g.fillText(o.balao[1], 256, 124);
    })
  );
  // plano (não Sprite: o passe de oclusão do três desenha Sprite como placa preta) que gira para a câmera
  const balao = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(0.9, 0.39)),
    guardar(new THREE.MeshBasicMaterial({ map: texBalao, transparent: true, depthWrite: false, color: new THREE.Color(0.95, 0.95, 0.95) }))
  );
  balao.position.y = 2.12;
  balao.renderOrder = 3;
  grupo.add(balao);

  // alvo de clique: uma caixa invisível no corpo
  const alvoCorpo = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.6, 0.95, 0.45)), guardar(new THREE.MeshBasicMaterial()));
  alvoCorpo.position.y = 1.3;
  alvoCorpo.visible = false;
  grupo.add(alvoCorpo);

  // a atendente 3D: esqueleto animado; a desenhada fica até ela chegar
  let mixer: THREE.AnimationMixer | null = null;
  let respirar: THREE.AnimationAction | null = null;
  let falar: THREE.AnimationAction | null = null;
  let avatar: THREE.Object3D | null = null;
  let ossoCabeca: THREE.Object3D | null = null;
  let falando = 0; // segundos de conversa que faltam
  if (o.modelo) {
    new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(o.modelo)
      .then((g) => {
        const av = g.scene;
        av.traverse((x) => {
          if (!(x instanceof THREE.Mesh)) return;
          x.castShadow = true;
          x.receiveShadow = true;
          x.frustumCulled = false; // a caixa de uma malha com esqueleto não acompanha a animação
          guardar(x.geometry);
          for (const m of ([] as THREE.Material[]).concat(x.material)) {
            guardar(m);
            if (m instanceof THREE.MeshStandardMaterial) {
              // atrás do balcão ela fica na sombra: reflexo do ambiente e um fio de luz própria, como nos produtos
              m.envMapIntensity = 1.8;
              if (m.map && m.name !== "cabelo") {
                m.emissive = new THREE.Color("#ffffff");
                m.emissiveMap = m.map;
                m.emissiveIntensity = 0.1;
              }
              for (const tex of [m.map, m.normalMap]) if (tex) guardar(tex);
            }
          }
        });
        grupo.add(av);
        avatar = av;
        boneco.visible = false;
        mixer = new THREE.AnimationMixer(av);
        const clipe = (nome: string) => g.animations.find((c) => c.name === nome);
        const cr = clipe("respirar");
        const cf = clipe("falar");
        if (cr) respirar = mixer.clipAction(cr).play();
        if (cf) {
          falar = mixer.clipAction(cf);
          falar.setEffectiveWeight(0).play();
        }
        ossoCabeca = av.getObjectByName("Bip01_Head") ?? null;
      })
      .catch(() => {
        // sem o modelo: fica a desenhada
      });
  }
  const auxQ = new THREE.Quaternion();
  const auxQPai = new THREE.Quaternion();
  const eixoY = new THREE.Vector3(0, 1, 0);
  let yawCorpo = 0;
  let yawCabeca = 0;

  let t = 0;
  let aceno = 0; // > 0 enquanto acena
  let estavaPerto = false;
  let comecouAgora = false;
  const auxV = new THREE.Vector3();
  function atualizar(dt: number, olhar: THREE.Vector3, perto: number) {
    t += dt;
    // respira
    corpo.scale.y = 1 + Math.sin(t * 1.6) * 0.006;
    corpo.position.y = 0.95 + Math.sin(t * 1.6) * 0.002;
    // vira a cabeça (e um pouco o corpo) para quem está perto
    grupo.updateMatrixWorld();
    auxV.copy(olhar);
    grupo.worldToLocal(auxV);
    const alvoYaw = perto < 9 ? THREE.MathUtils.clamp(Math.atan2(auxV.x, auxV.z), -0.7, 0.7) : 0;
    const alvoPitch = perto < 9 ? THREE.MathUtils.clamp(-Math.atan2(auxV.y - 1.6, Math.hypot(auxV.x, auxV.z)) * 0.5, -0.25, 0.25) : 0;
    const k = 1 - Math.exp(-dt * 4);
    cabeca.rotation.y += (alvoYaw - cabeca.rotation.y) * k;
    cabeca.rotation.x += (alvoPitch - cabeca.rotation.x) * k;
    corpo.rotation.y += (alvoYaw * 0.25 - corpo.rotation.y) * k;
    // chegou perto: acena com a mão direita
    const pertoAgora = perto < 4.5;
    comecouAgora = false;
    if (pertoAgora && !estavaPerto && aceno <= 0) {
      aceno = 2.4;
      comecouAgora = true;
    }
    estavaPerto = pertoAgora;
    aceno = Math.max(0, aceno - dt);
    if (mixer && avatar) {
      // conversa: entra devagar quando a pessoa chega, sai devagar quando acaba
      if (comecouAgora && falar && falando <= 0) {
        falar.reset().play();
        falando = falar.getClip().duration;
      }
      falando = Math.max(0, falando - dt);
      const peso = THREE.MathUtils.smoothstep(falando, 0, 0.8) * THREE.MathUtils.smoothstep(falar ? falar.getClip().duration - falando : 0, 0, 0.6);
      falar?.setEffectiveWeight(peso);
      respirar?.setEffectiveWeight(1 - peso);
      mixer.update(dt);
      // o corpo vira um pouco e a cabeça completa o olhar (depois da animação, que reescreve os ossos)
      const olharYaw = perto < 9 ? Math.atan2(auxV.x, auxV.z) : 0;
      yawCorpo += (THREE.MathUtils.clamp(olharYaw * 0.4, -0.35, 0.35) - yawCorpo) * k;
      yawCabeca += (THREE.MathUtils.clamp(olharYaw - yawCorpo, -0.55, 0.55) * (1 - peso * 0.6) - yawCabeca) * k;
      avatar.rotation.y = yawCorpo;
      if (ossoCabeca?.parent) {
        avatar.updateMatrixWorld(true);
        ossoCabeca.parent.getWorldQuaternion(auxQPai);
        auxQ.setFromAxisAngle(eixoY, yawCabeca);
        ossoCabeca.quaternion.premultiply(auxQPai.clone().invert().multiply(auxQ).multiply(auxQPai));
      }
    }
    const forca = THREE.MathUtils.smoothstep(aceno, 0, 0.4) * THREE.MathUtils.smoothstep(2.4 - aceno, 0, 0.4);
    // braços em repouso: mãos apoiadas no balcão, à frente
    for (const [i, b] of bracos.entries()) {
      const lado = i === 0 ? -1 : 1;
      const acenando = lado === 1 ? forca : 0;
      b.ombro.rotation.set(-0.35 * (1 - acenando), 0, lado * (0.12 + acenando * 2.3));
      b.cotovelo.rotation.set(-1.05 * (1 - acenando), 0, acenando * (-0.5 + Math.sin(t * 9) * 0.35) * lado);
    }
    // balão: só para quem está a menos de 10 m, boiando de leve
    balao.visible = perto < 10;
    balao.position.y = 2.12 + Math.sin(t * 2) * 0.025;
    // chegou perto: o balão "pula"
    const pulo = aceno > 1.9 ? Math.sin(((2.4 - aceno) / 0.5) * Math.PI) * 0.15 : 0;
    balao.scale.setScalar(1 + pulo);
    balao.rotation.y = Math.atan2(auxV.x, auxV.z);
  }

  return {
    grupo,
    alvos: [alvoCorpo, balao],
    atualizar,
    acenou: () => comecouAgora,
    conversar: () => {
      if (falar && falando <= 0) {
        falar.reset().play();
        falando = falar.getClip().duration;
      }
    },
    descartar: () => lixo.forEach((x) => x.dispose()),
  };
}
