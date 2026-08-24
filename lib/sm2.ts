// Algoritmo SM-2 de repetição espaçada (o mesmo princípio do Anki).
// A cada revisão o usuário dá uma nota de 0 a 5; o algoritmo decide
// quando o cartão deve aparecer de novo.

export type Sm2State = {
  easiness: number;
  intervalDays: number;
  repetitions: number;
};

export type Sm2Result = Sm2State & { dueDate: Date };

// quality: 0 = errei completamente … 5 = lembrei sem esforço
export function reviewCard(state: Sm2State, quality: number): Sm2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { easiness, intervalDays, repetitions } = state;

  if (q < 3) {
    // Errou: volta ao início, revisa de novo amanhã
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easiness);
    repetitions += 1;
  }

  easiness = Math.max(1.3, easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + intervalDays);
  dueDate.setHours(4, 0, 0, 0); // vence de madrugada para "contar como o dia"

  return { easiness, intervalDays, repetitions, dueDate };
}
