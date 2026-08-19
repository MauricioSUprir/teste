/**
 * Registro de pedidos da demonstração — armazenados no navegador.
 * Quando o servidor estiver no ar, o checkout também envia o pedido ao
 * Hub Suprir via POST /pedidos (a chave da API fica só no servidor);
 * este registro local passa a ser um espelho para o painel.
 */

export type StatusPedido = "aguardando_pagamento" | "pago" | "cancelado";

export interface ItemPedido {
  sku: string;
  titulo: string;
  quantidade: number;
  precoCentavos: number;
}

export interface Pedido {
  numero: string;
  data: string; // ISO
  clienteNome: string;
  clienteEmail: string;
  itens: ItemPedido[];
  totalCentavos: number;
  meio: "pix" | "cartao" | "boleto";
  freteNome: string;
  status: StatusPedido;
}

const CHAVE = "beautynow:pedidos:v1";

export function lerPedidos(): Pedido[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Pedido[]) : [];
  } catch {
    return [];
  }
}

export function gravarPedido(pedido: Pedido) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify([pedido, ...lerPedidos()]));
  } catch {
    // storage indisponível — pedido segue só na confirmação
  }
}

export function atualizarStatus(numero: string, status: StatusPedido) {
  try {
    const pedidos = lerPedidos().map((p) => (p.numero === numero ? { ...p, status } : p));
    localStorage.setItem(CHAVE, JSON.stringify(pedidos));
  } catch {
    // sem persistência
  }
}
