// Cálculo do nível de urgência de uma tarefa.
// Combina: quanto falta para a entrega + dificuldade + se vale nota.

export type NivelUrgencia = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";

export type TarefaParaUrgencia = {
  dueDate: Date | string | null;
  difficulty: number; // 1 a 5
  kind: string; // CASA | AVALIATIVO
  status: string;
};

export function pontuacaoUrgencia(t: TarefaParaUrgencia): number {
  if (t.status === "DONE") return -1;

  let pontos = 0;

  if (t.dueDate) {
    const due = typeof t.dueDate === "string" ? new Date(t.dueDate) : t.dueDate;
    const diasRestantes = (due.getTime() - Date.now()) / 86400_000;
    if (diasRestantes < 0) pontos += 5; // atrasada
    else if (diasRestantes <= 1) pontos += 4;
    else if (diasRestantes <= 3) pontos += 3;
    else if (diasRestantes <= 7) pontos += 2;
    else pontos += 1;
  }

  if (t.difficulty >= 5) pontos += 3;
  else if (t.difficulty === 4) pontos += 2;
  else if (t.difficulty === 3) pontos += 1;

  if (t.kind === "AVALIATIVO") pontos += 2;

  return pontos;
}

export function nivelUrgencia(t: TarefaParaUrgencia): NivelUrgencia {
  const pontos = pontuacaoUrgencia(t);
  if (pontos >= 8) return "CRITICA";
  if (pontos >= 6) return "ALTA";
  if (pontos >= 4) return "MEDIA";
  return "BAIXA";
}

export const ROTULO_URGENCIA: Record<NivelUrgencia, string> = {
  CRITICA: "🔴 crítica",
  ALTA: "🟠 alta",
  MEDIA: "🟡 média",
  BAIXA: "🟢 baixa",
};
