/**
 * Análise de vendas para o painel admin — agrega os pedidos registrados
 * em períodos (dia/semana/mês/ano), com comparativo contra o período
 * anterior equivalente. Hoje lê os pedidos do navegador; com o servidor
 * no ar, a mesma interface agrega os pedidos reais do Hub.
 */
import type { Pedido } from "./pedidos";

export type Periodo = "dia" | "semana" | "mes" | "ano";

export interface Faixa {
  rotulo: string;
  /** rótulo curto para o eixo (nem toda faixa mostra) */
  rotuloEixo: string;
  inicio: number; // epoch ms
  fim: number;
  totalCentavos: number;
  qtdPedidos: number;
}

export interface Resumo {
  totalCentavos: number;
  qtdPedidos: number;
  ticketMedioCentavos: number;
  pctPix: number;
  /** variação % vs. período anterior equivalente; null sem base de comparação */
  variacaoReceitaPct: number | null;
  variacaoPedidosPct: number | null;
}

const DIA_MS = 24 * 60 * 60_000;

const nomeMes = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

/** faixas do período: dia→24h, semana→7 dias, mês→30 dias, ano→12 meses */
export function faixasDoPeriodo(periodo: Periodo, agora = new Date()): Faixa[] {
  const faixas: Faixa[] = [];
  if (periodo === "dia") {
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    for (let h = 0; h < 24; h++) {
      faixas.push({
        rotulo: `${String(h).padStart(2, "0")}h–${String(h + 1).padStart(2, "0")}h`,
        rotuloEixo: `${String(h).padStart(2, "0")}h`,
        inicio: inicioDia + h * 3_600_000,
        fim: inicioDia + (h + 1) * 3_600_000,
        totalCentavos: 0,
        qtdPedidos: 0,
      });
    }
  } else if (periodo === "semana" || periodo === "mes") {
    const dias = periodo === "semana" ? 7 : 30;
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i);
      const rotuloDia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      faixas.push({
        rotulo:
          periodo === "semana"
            ? `${d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")} ${rotuloDia}`
            : rotuloDia,
        rotuloEixo: periodo === "semana" ? d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "") : rotuloDia.slice(0, 5),
        inicio: d.getTime(),
        fim: d.getTime() + DIA_MS,
        totalCentavos: 0,
        qtdPedidos: 0,
      });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      faixas.push({
        rotulo: `${nomeMes(d)}/${String(d.getFullYear()).slice(2)}`,
        rotuloEixo: nomeMes(d),
        inicio: d.getTime(),
        fim: fim.getTime(),
        totalCentavos: 0,
        qtdPedidos: 0,
      });
    }
  }
  return faixas;
}

// receita e KPIs contam SÓ pedido pago — aguardando pagamento aparece na
// aba Pedidos, mas não entra no saldo até o pagamento cair
function pedidosValidos(pedidos: Pedido[]): Pedido[] {
  return pedidos.filter((p) => p.status === "pago");
}

export function agregarPorFaixa(pedidos: Pedido[], periodo: Periodo, agora = new Date()): Faixa[] {
  const faixas = faixasDoPeriodo(periodo, agora);
  for (const p of pedidosValidos(pedidos)) {
    const t = new Date(p.data).getTime();
    const faixa = faixas.find((f) => t >= f.inicio && t < f.fim);
    if (faixa) {
      faixa.totalCentavos += p.totalCentavos;
      faixa.qtdPedidos += 1;
    }
  }
  return faixas;
}

export function resumoDoPeriodo(pedidos: Pedido[], periodo: Periodo, agora = new Date()): Resumo {
  const faixas = faixasDoPeriodo(periodo, agora);
  const inicio = faixas[0].inicio;
  const fim = faixas[faixas.length - 1].fim;
  const duracao = fim - inicio;

  const validos = pedidosValidos(pedidos);
  const noPeriodo = validos.filter((p) => {
    const t = new Date(p.data).getTime();
    return t >= inicio && t < fim;
  });
  const anterior = validos.filter((p) => {
    const t = new Date(p.data).getTime();
    return t >= inicio - duracao && t < inicio;
  });

  const total = noPeriodo.reduce((acc, p) => acc + p.totalCentavos, 0);
  const totalAnterior = anterior.reduce((acc, p) => acc + p.totalCentavos, 0);
  const pix = noPeriodo.filter((p) => p.meio === "pix").length;

  const variacao = (atual: number, base: number): number | null =>
    base > 0 ? Math.round(((atual - base) / base) * 100) : null;

  return {
    totalCentavos: total,
    qtdPedidos: noPeriodo.length,
    ticketMedioCentavos: noPeriodo.length ? Math.round(total / noPeriodo.length) : 0,
    pctPix: noPeriodo.length ? Math.round((pix / noPeriodo.length) * 100) : 0,
    variacaoReceitaPct: variacao(total, totalAnterior),
    variacaoPedidosPct: variacao(noPeriodo.length, anterior.length),
  };
}

export interface ItemRanking {
  rotulo: string;
  totalCentavos: number;
  qtd: number;
}

/** top produtos por receita dentro da janela do período */
export function topProdutos(pedidos: Pedido[], periodo: Periodo, limite = 5, agora = new Date()): ItemRanking[] {
  const faixas = faixasDoPeriodo(periodo, agora);
  const inicio = faixas[0].inicio;
  const fim = faixas[faixas.length - 1].fim;
  const mapa = new Map<string, ItemRanking>();
  for (const p of pedidosValidos(pedidos)) {
    const t = new Date(p.data).getTime();
    if (t < inicio || t >= fim) continue;
    for (const item of p.itens) {
      const atual = mapa.get(item.titulo) ?? { rotulo: item.titulo, totalCentavos: 0, qtd: 0 };
      atual.totalCentavos += item.precoCentavos * item.quantidade;
      atual.qtd += item.quantidade;
      mapa.set(item.titulo, atual);
    }
  }
  return [...mapa.values()].sort((a, b) => b.totalCentavos - a.totalCentavos).slice(0, limite);
}

/** receita por forma de pagamento dentro da janela do período */
export function porFormaPagamento(pedidos: Pedido[], periodo: Periodo, agora = new Date()): ItemRanking[] {
  const faixas = faixasDoPeriodo(periodo, agora);
  const inicio = faixas[0].inicio;
  const fim = faixas[faixas.length - 1].fim;
  const nomes: Record<Pedido["meio"], string> = { pix: "Pix", cartao: "Cartão", boleto: "Boleto" };
  const mapa = new Map<string, ItemRanking>();
  for (const p of pedidosValidos(pedidos)) {
    const t = new Date(p.data).getTime();
    if (t < inicio || t >= fim) continue;
    const rotulo = nomes[p.meio];
    const atual = mapa.get(rotulo) ?? { rotulo, totalCentavos: 0, qtd: 0 };
    atual.totalCentavos += p.totalCentavos;
    atual.qtd += 1;
    mapa.set(rotulo, atual);
  }
  return [...mapa.values()].sort((a, b) => b.totalCentavos - a.totalCentavos);
}
