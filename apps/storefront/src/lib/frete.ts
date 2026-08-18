/**
 * Cálculo de frete de demonstração.
 * Na integração real: Melhor Envio + tabela própria de motoboy RJ (docs/05).
 * A interface retorna opções com data prevista, como a UI exige (docs/03 §6:
 * "Chega até 22/08 por R$ 18,90", nunca "Frete: R$ 18,90").
 */
import { FRETE_GRATIS_MINIMO_CENTAVOS } from "./preco";

export interface OpcaoFrete {
  id: string;
  nome: string;
  valorCentavos: number;
  diasUteis: number;
  dataPrevista: string; // já formatada dd/mm
}

function dataMaisDias(dias: number): string {
  const d = new Date();
  let uteis = 0;
  while (uteis < dias) {
    d.setDate(d.getDate() + 1);
    const diaSemana = d.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) uteis++;
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function validarCep(cep: string): boolean {
  return /^\d{5}-?\d{3}$/.test(cep.trim());
}

export function calcularFrete(cep: string, subtotalCentavos: number): OpcaoFrete[] {
  const prefixo = parseInt(cep.replace(/\D/g, "").slice(0, 2), 10);
  // RJ (20–28) tem motoboy próprio; demais regiões, transportadora
  const ehRJ = prefixo >= 20 && prefixo <= 28;
  const freteGratis = subtotalCentavos >= FRETE_GRATIS_MINIMO_CENTAVOS;

  const opcoes: OpcaoFrete[] = [];
  if (ehRJ) {
    opcoes.push({
      id: "motoboy",
      nome: "Entrega expressa (motoboy)",
      valorCentavos: 1490,
      diasUteis: 1,
      dataPrevista: dataMaisDias(1),
    });
  }
  opcoes.push({
    id: "padrao",
    nome: "Entrega padrão",
    valorCentavos: freteGratis ? 0 : ehRJ ? 1290 : 1890,
    diasUteis: ehRJ ? 3 : 7,
    dataPrevista: dataMaisDias(ehRJ ? 3 : 7),
  });
  opcoes.push({
    id: "economica",
    nome: "Entrega econômica",
    valorCentavos: freteGratis ? 0 : ehRJ ? 890 : 1290,
    diasUteis: ehRJ ? 5 : 10,
    dataPrevista: dataMaisDias(ehRJ ? 5 : 10),
  });
  return opcoes;
}
