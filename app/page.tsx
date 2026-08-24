import Link from "next/link";
import { db } from "@/lib/db";
import { salvarMetaSemanal } from "@/lib/actions";

export const dynamic = "force-dynamic";

function inicioDaSemana(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // domingo
  return d;
}

function calcularStreak(dias: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // O dia de hoje conta se já houve estudo; senão começa de ontem
  if (!dias.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (dias.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default async function Painel() {
  const hoje = new Date();
  const fimDeHoje = new Date(hoje);
  fimDeHoje.setHours(23, 59, 59, 999);
  const emTresDias = new Date(hoje.getTime() + 3 * 86400_000);

  const [tarefasProximas, cardsVencidos, sessoesSemana, sessoes90d, blocosHoje, metaSetting, tarefasAbertas] =
    await Promise.all([
      db.task.findMany({
        where: { status: { not: "DONE" }, dueDate: { lte: emTresDias } },
        orderBy: { dueDate: "asc" },
        take: 8,
        include: { subject: true },
      }),
      db.flashcard.count({ where: { dueDate: { lte: new Date() } } }),
      db.pomodoroSession.findMany({ where: { startedAt: { gte: inicioDaSemana() } } }),
      db.pomodoroSession.findMany({
        where: { startedAt: { gte: new Date(Date.now() - 90 * 86400_000) } },
        select: { startedAt: true },
      }),
      db.studyBlock.findMany({
        where: { dayOfWeek: hoje.getDay() },
        orderBy: { startMin: "asc" },
        include: { subject: true },
      }),
      db.setting.findUnique({ where: { key: "metaSemanalMin" } }),
      db.task.count({ where: { status: { not: "DONE" } } }),
    ]);

  const minutosSemana = sessoesSemana.reduce((soma, s) => soma + s.focusMin, 0);
  const metaMin = Number(metaSetting?.value ?? 600);
  const progresso = metaMin > 0 ? Math.min(100, Math.round((minutosSemana / metaMin) * 100)) : 0;
  const diasComEstudo = new Set(sessoes90d.map((s) => new Date(s.startedAt).toDateString()));
  const streak = calcularStreak(diasComEstudo);
  const fmtHora = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  return (
    <>
      <h1>Painel</h1>
      <p className="subtitulo">
        {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div className="grade grade-3" style={{ marginBottom: 24 }}>
        <div className="cartao">
          <div className="texto-suave">Foco nesta semana</div>
          <div className="numero-grande">
            {Math.floor(minutosSemana / 60)}h{String(minutosSemana % 60).padStart(2, "0")}
          </div>
          <div className="barra" style={{ marginTop: 8 }}>
            <div style={{ width: `${progresso}%` }} />
          </div>
          <div className="texto-suave" style={{ marginTop: 6 }}>
            {progresso}% da meta de {Math.floor(metaMin / 60)}h — ajuste abaixo
          </div>
          <form action={salvarMetaSemanal} className="linha-flex" style={{ marginTop: 10 }}>
            <input
              type="number"
              name="minutos"
              defaultValue={metaMin}
              min={30}
              step={30}
              style={{ width: 90 }}
              aria-label="Meta semanal em minutos"
            />
            <span className="texto-suave">min/semana</span>
            <button type="submit">Salvar</button>
          </form>
        </div>

        <div className="cartao">
          <div className="texto-suave">Sequência de estudo</div>
          <div className="numero-grande">
            {streak} {streak === 1 ? "dia" : "dias"}
          </div>
          <div className="texto-suave" style={{ marginTop: 6 }}>
            {streak > 0
              ? "Continue assim — estude hoje para manter a sequência."
              : "Registre uma sessão de Pomodoro para começar uma sequência."}
          </div>
          {streak >= 3 && (
            <span className="pilula pilula-ambar" style={{ marginTop: 8 }}>
              🔥 em ritmo
            </span>
          )}
        </div>

        <div className="cartao">
          <div className="texto-suave">Revisões pendentes</div>
          <div className="numero-grande">{cardsVencidos}</div>
          <div className="texto-suave" style={{ marginTop: 6 }}>
            {cardsVencidos > 0 ? (
              <Link href="/flashcards" style={{ color: "var(--acento)", fontWeight: 700 }}>
                Revisar flashcards agora →
              </Link>
            ) : (
              "Nenhum flashcard vencido. Tudo em dia!"
            )}
          </div>
          <div className="texto-suave" style={{ marginTop: 4 }}>
            {tarefasAbertas} {tarefasAbertas === 1 ? "tarefa aberta" : "tarefas abertas"}
          </div>
        </div>
      </div>

      <div className="grade grade-2">
        <div className="cartao">
          <h2>Hoje no cronograma</h2>
          {blocosHoje.length === 0 ? (
            <p className="texto-suave">
              Nenhum bloco de estudo para hoje.{" "}
              <Link href="/cronograma" style={{ color: "var(--acento)" }}>
                Montar cronograma →
              </Link>
            </p>
          ) : (
            <ul className="lista-limpa">
              {blocosHoje.map((b) => (
                <li key={b.id} className="item-lista">
                  <span className="ponto-cor" style={{ background: b.subject.color }} />
                  <strong>{fmtHora(b.startMin)}</strong>
                  <span>{b.subject.name}</span>
                  <span className="texto-suave" style={{ marginLeft: "auto" }}>
                    {b.durationMin} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cartao">
          <h2>Prazos próximos (3 dias)</h2>
          {tarefasProximas.length === 0 ? (
            <p className="texto-suave">
              Nada vencendo nos próximos dias.{" "}
              <Link href="/tarefas" style={{ color: "var(--acento)" }}>
                Ver todas as tarefas →
              </Link>
            </p>
          ) : (
            <ul className="lista-limpa">
              {tarefasProximas.map((t) => {
                const atrasada = t.dueDate && t.dueDate < hoje;
                return (
                  <li key={t.id} className="item-lista">
                    {t.subject && (
                      <span className="ponto-cor" style={{ background: t.subject.color }} />
                    )}
                    <span>{t.title}</span>
                    <span
                      className={`pilula ${atrasada ? "pilula-perigo" : ""}`}
                      style={{ marginLeft: "auto" }}
                    >
                      {atrasada ? "atrasada" : t.dueDate?.toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
