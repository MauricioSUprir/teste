/**
 * O que a conta guarda e como volta: visual (com o nome), sacola, lojas
 * montadas e a música. Tudo continua também neste aparelho (localStorage),
 * do jeito de sempre; a conta é uma cópia que acompanha a pessoa.
 *
 * Ao entrar na conta num aparelho que já tinha coisas, junta: a sacola soma
 * os itens dos dois lados, as lojas também; o visual e a música ficam os da
 * conta. Ao abrir já conectado, vale o que está na conta.
 */
import { todosProdutos, type Produto } from "./catalogo";
import { conta, type DadosConta } from "./conta";
import { gravarPrevias, lerPrevias, previasValidas, type LojaPrevia } from "./lojas";
import { itensValidos, sacola, type ItemSacola } from "./sacola";
import { escolhaValida, gravarEscolha, lerEscolha, type Escolha } from "../ui/provador-ui";

const CHAVE_MUSICA = "shopping3d.musica";

export function lerMusica(): boolean {
  try {
    return localStorage.getItem(CHAVE_MUSICA) !== "0";
  } catch {
    return true;
  }
}

export function gravarMusica(sim: boolean) {
  try {
    localStorage.setItem(CHAVE_MUSICA, sim ? "1" : "0");
  } catch {
    /* sem armazenamento */
  }
}

export interface AplicarNoShopping {
  /** o visual mudou (veio da conta): vestir de novo o avatar */
  visual: (e: Escolha) => void;
  /** estas unidades ganharam, perderam ou mudaram de loja */
  lojas: (unidades: string[]) => void;
  musica: (sim: boolean) => void;
}

/** na conta vai só o que a sacola e o caixa mostram (a ficha completa volta do catálogo) */
const enxuto = (p: Produto) => ({ id: p.id, titulo: p.titulo, marca: p.marca, categorias: p.categorias, preco: p.preco, precoDe: p.precoDe, foto: p.foto });

let porId: Map<string, Produto> | null = null;
/** o produto do catálogo (preço de hoje); sem ele, a cópia que estava na conta */
function produtoDe(salvo: Produto): Produto {
  porId ??= new Map(todosProdutos().map((p) => [p.id, p]));
  return porId.get(salvo.id) ?? { ...salvo, descricao: salvo.descricao ?? "", atributos: salvo.atributos ?? {}, especificacoes: salvo.especificacoes ?? {} };
}

function juntarSacolas(daConta: ItemSacola[], daqui: ItemSacola[]) {
  const r = daConta.map((i) => ({ ...i }));
  for (const i of daqui) {
    const igual = r.find((x) => x.produto.id === i.produto.id && x.lojaId === i.lojaId);
    if (igual) igual.qtd = Math.max(igual.qtd, i.qtd);
    else r.push({ ...i });
  }
  return r;
}

export function ligarSincronia(aplicar: AplicarNoShopping) {
  conta.coletar = (): DadosConta => ({
    visual: lerEscolha(),
    sacola: sacola.lista().map((i) => ({ ...i, produto: enxuto(i.produto) })),
    lojas: lerPrevias(),
    preferencias: { musica: lerMusica() },
  });

  conta.aplicar = (d, juntar) => {
    const visual = escolhaValida(d.visual);
    if (visual && JSON.stringify(visual) !== JSON.stringify(lerEscolha())) {
      gravarEscolha(visual);
      aplicar.visual(visual);
    }

    if (d.sacola !== undefined) {
      const daConta = itensValidos(d.sacola).map((i) => ({ ...i, produto: produtoDe(i.produto) }));
      const nova = juntar ? juntarSacolas(daConta, sacola.lista()) : daConta;
      if (JSON.stringify(nova) !== JSON.stringify(sacola.lista())) sacola.substituir(nova);
    }

    if (d.lojas !== undefined) {
      const antes = lerPrevias();
      const daConta = previasValidas(d.lojas);
      const novas: Record<string, LojaPrevia> = juntar ? { ...antes, ...daConta } : daConta;
      const mudaram = [...new Set([...Object.keys(antes), ...Object.keys(novas)])].filter((u) => JSON.stringify(antes[u]) !== JSON.stringify(novas[u]));
      if (mudaram.length) {
        gravarPrevias(novas);
        aplicar.lojas(mudaram);
      }
    }

    const musica = d.preferencias?.musica;
    if (typeof musica === "boolean" && musica !== lerMusica()) {
      gravarMusica(musica);
      aplicar.musica(musica);
    }
  };

  // cada mudança daqui sobe para a conta (a sacola avisa sozinha; o resto quem muda chama conta.mudou)
  let primeira = true;
  sacola.ouvir(() => (primeira ? (primeira = false) : conta.mudou()));
  // indo para o fundo (trocou de app, fechou a aba): sobe o que faltava
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && conta.enviarJa());
}
