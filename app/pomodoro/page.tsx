import { db } from "@/lib/db";
import { TimerPomodoro } from "@/components/TimerPomodoro";

export const dynamic = "force-dynamic";

export default async function Pomodoro() {
  const [materias, sessoesHoje] = await Promise.all([
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.pomodoroSession.findMany({
      where: { startedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      orderBy: { startedAt: "desc" },
      include: { subject: true },
    }),
  ]);

  const minutosHoje = sessoesHoje.reduce((soma, s) => soma + s.focusMin, 0);

  return (
    <>
      <h1>Pomodoro</h1>
      <p className="subtitulo">
        Ciclos de foco com pausas. Cada ciclo concluído é registrado na matéria escolhida e
        alimenta suas estatísticas e sua sequência de dias.
      </p>

      <div className="grade grade-2">
        <TimerPomodoro
          materias={materias.map((m) => ({ id: m.id, name: m.name }))}
        />

        <div className="cartao">
          <h2>Hoje</h2>
          <div className="numero-grande" style={{ marginBottom: 8 }}>
            {Math.floor(minutosHoje / 60)}h{String(minutosHoje % 60).padStart(2, "0")}
          </div>
          {sessoesHoje.length === 0 ? (
            <p className="texto-suave">Nenhuma sessão registrada hoje ainda.</p>
          ) : (
            <ul className="lista-limpa">
              {sessoesHoje.map((s) => (
                <li key={s.id} className="item-lista">
                  <span>
                    {s.startedAt.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="texto-suave">{s.subject?.name ?? "sem matéria"}</span>
                  <span className="pilula pilula-acento" style={{ marginLeft: "auto" }}>
                    {s.focusMin} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
