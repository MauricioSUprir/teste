import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Estatisticas() {
  const inicio30d = new Date(Date.now() - 30 * 86400_000);
  const inicio14d = new Date(Date.now() - 14 * 86400_000);

  const [sessoes30d, tarefasConcluidas30d, totalCards, cardsAprendidos, subjects] =
    await Promise.all([
      db.pomodoroSession.findMany({
        where: { startedAt: { gte: inicio30d } },
        include: { subject: true },
      }),
      db.task.count({ where: { status: "DONE", completedAt: { gte: inicio30d } } }),
      db.flashcard.count(),
      db.flashcard.count({ where: { repetitions: { gte: 3 } } }),
      db.subject.count(),
    ]);

  // Minutos por matéria (30 dias)
  const porMateria = new Map<string, { min: number; cor: string }>();
  for (const s of sessoes30d) {
    const nome = s.subject?.name ?? "Sem matéria";
    const cor = s.subject?.color ?? "#8a948f";
    const atual = porMateria.get(nome) ?? { min: 0, cor };
    atual.min += s.focusMin;
    porMateria.set(nome, atual);
  }
  const ranking = [...porMateria.entries()].sort((a, b) => b[1].min - a[1].min);
  const maxMin = ranking[0]?.[1].min ?? 1;

  // Minutos por dia (14 dias)
  const porDia: { rotulo: string; min: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dia = new Date();
    dia.setHours(0, 0, 0, 0);
    dia.setDate(dia.getDate() - i);
    const fim = new Date(dia.getTime() + 86400_000);
    const min = sessoes30d
      .filter((s) => s.startedAt >= dia && s.startedAt < fim)
      .reduce((soma, s) => soma + s.focusMin, 0);
    porDia.push({
      rotulo: dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      min,
    });
  }
  const maxDia = Math.max(1, ...porDia.map((d) => d.min));
  const totalMin30d = sessoes30d.reduce((soma, s) => soma + s.focusMin, 0);

  return (
    <>
      <h1>Estatísticas</h1>
      <p className="subtitulo">Seu esforço dos últimos 30 dias, em números.</p>

      <div className="grade grade-3" style={{ marginBottom: 20 }}>
        <div className="cartao">
          <div className="texto-suave">Horas de foco (30 dias)</div>
          <div className="numero-grande">
            {Math.floor(totalMin30d / 60)}h{String(totalMin30d % 60).padStart(2, "0")}
          </div>
        </div>
        <div className="cartao">
          <div className="texto-suave">Tarefas concluídas (30 dias)</div>
          <div className="numero-grande">{tarefasConcluidas30d}</div>
        </div>
        <div className="cartao">
          <div className="texto-suave">Flashcards dominados</div>
          <div className="numero-grande">
            {cardsAprendidos}
            <span className="texto-suave" style={{ fontSize: "1rem" }}> / {totalCards}</span>
          </div>
          <div className="texto-suave">3+ revisões corretas</div>
        </div>
      </div>

      <div className="grade grade-2">
        <div className="cartao">
          <h2>Tempo por matéria (30 dias)</h2>
          {ranking.length === 0 ? (
            <p className="texto-suave">
              Sem sessões registradas ainda. Use o Pomodoro para começar a medir.
            </p>
          ) : (
            <div className="pilha">
              {ranking.map(([nome, dados]) => (
                <div key={nome}>
                  <div className="linha-flex" style={{ marginBottom: 4 }}>
                    <span style={{ flex: 1 }}>{nome}</span>
                    <span className="texto-suave">
                      {Math.floor(dados.min / 60)}h{String(dados.min % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="barra">
                    <div
                      style={{
                        width: `${Math.round((dados.min / maxMin) * 100)}%`,
                        background: dados.cor,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cartao">
          <h2>Últimos 14 dias</h2>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 4,
              height: 140,
              marginBottom: 6,
            }}
          >
            {porDia.map((d) => (
              <div
                key={d.rotulo}
                title={`${d.rotulo}: ${d.min} min`}
                style={{
                  flex: 1,
                  height: `${Math.max(3, Math.round((d.min / maxDia) * 100))}%`,
                  background: d.min > 0 ? "var(--acento)" : "var(--superficie-2)",
                  borderRadius: 4,
                }}
              />
            ))}
          </div>
          <div className="linha-flex texto-suave" style={{ justifyContent: "space-between", fontSize: "0.75rem" }}>
            <span>{porDia[0].rotulo}</span>
            <span>hoje</span>
          </div>
          {subjects === 0 && (
            <p className="texto-suave" style={{ marginTop: 10 }}>
              Dica: cadastre matérias e estude com o Pomodoro para ver os gráficos ganharem vida.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
