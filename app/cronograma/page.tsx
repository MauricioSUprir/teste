import { db } from "@/lib/db";
import { criarBloco } from "@/lib/actions";
import { BotaoExcluirBloco } from "@/components/BotaoExcluirBloco";

export const dynamic = "force-dynamic";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function Cronograma() {
  const [blocos, materias] = await Promise.all([
    db.studyBlock.findMany({ include: { subject: true } }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
  ]);

  const fmtHora = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  return (
    <>
      <h1>Cronograma semanal</h1>
      <p className="subtitulo">
        Reserve blocos fixos de estudo na semana. O painel mostra os blocos do dia, e o
        assistente de IA usa este cronograma para sugerir planos realistas.
      </p>

      {materias.length === 0 ? (
        <p className="texto-suave">
          Cadastre pelo menos uma matéria antes de montar o cronograma.
        </p>
      ) : (
        <form action={criarBloco} className="cartao linha-flex" style={{ marginBottom: 20 }}>
          <select name="subjectId" required aria-label="Matéria">
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select name="dayOfWeek" aria-label="Dia da semana" defaultValue="1">
            {DIAS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input type="time" name="start" defaultValue="19:00" aria-label="Horário de início" />
          <select name="durationMin" aria-label="Duração" defaultValue="60">
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">1h</option>
            <option value="90">1h30</option>
            <option value="120">2h</option>
          </select>
          <button type="submit" className="btn-principal">
            Adicionar bloco
          </button>
        </form>
      )}

      <div className="cartao" style={{ overflowX: "auto" }}>
        <div className="cronograma">
          {DIAS.map((dia, i) => {
            const doDia = blocos
              .filter((b) => b.dayOfWeek === i)
              .sort((a, z) => a.startMin - z.startMin);
            return (
              <div key={i} className="dia-coluna">
                <div className="dia-titulo">{dia}</div>
                {doDia.length === 0 && (
                  <div className="texto-suave" style={{ textAlign: "center", fontSize: "0.75rem" }}>
                    —
                  </div>
                )}
                {doDia.map((b) => (
                  <div key={b.id} className="bloco-estudo" style={{ background: b.subject.color }}>
                    <strong>{fmtHora(b.startMin)}</strong> · {b.durationMin}min
                    <div>{b.subject.name}</div>
                    <BotaoExcluirBloco id={b.id} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
