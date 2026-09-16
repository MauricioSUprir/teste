// Clipes de filme / serie / desenho / musica que aparecem NA CORRECAO.
// Regra: todo clipe tem um "porque" didatico — ele existe para mostrar a
// estrutura que a pessoa acabou de errar, no meio de uma fala real.
//
// Nao usamos IDs fixos do YouTube de proposito: link quebrado e pior que
// link generico. Cada clipe abre uma BUSCA da cena (sempre funciona) e,
// para a frase em si, o YouGlish, que toca dezenas de videos reais com
// aquela expressao sendo falada no idioma estudado.

export type Clip = {
  lang: string
  kind: 'filme' | 'série' | 'desenho' | 'música'
  title: string
  /** a fala como ela aparece na cena */
  line: string
  /** traducao da fala */
  linePt: string
  /** o que observar — a parte didatica */
  note: string
  /** licoes onde esse clipe faz sentido */
  lessons?: string[]
  /** pedacos de frase que disparam o clipe */
  match?: string[]
  /** busca da cena no YouTube */
  search: string
}

export const CLIPS: Clip[] = [
  // ---------------- INGLES ----------------
  {
    lang: 'en', kind: 'filme', title: 'O Exterminador do Futuro', line: "I'll be back.", linePt: 'Eu volto.',
    note: "I'll = I will. Repare que ele decide na hora — por isso WILL, e não \"I'm going to\". E o 'll quase some na fala: soa como \"ail bi bék\".",
    lessons: ['u5l1', 'u5l3'], match: ["i'll", 'i will', 'be right there'],
    search: 'terminator ill be back scene',
  },
  {
    lang: 'en', kind: 'desenho', title: 'Frozen', line: 'Let it go.', linePt: 'Deixa pra lá / solta.',
    note: 'LET + objeto + verbo sem to. Mesma estrutura de "let me know" (me avisa) e "let’s go" (vamos). Nunca "let to go".',
    lessons: ['u5l2', 'u5l3'], match: ['let', 'let me know'],
    search: 'frozen let it go scene',
  },
  {
    lang: 'en', kind: 'série', title: 'Game of Thrones', line: 'Winter is coming.', linePt: 'O inverno está chegando.',
    note: 'Present continuous com sentido de FUTURO certo. Igual a "I’m coming" (já vou) e "We’re meeting at seven" (a gente se encontra às sete).',
    lessons: ['u2l4', 'u5l1'], match: ['is coming', 'are meeting', "i'm coming"],
    search: 'game of thrones winter is coming scene',
  },
  {
    lang: 'en', kind: 'desenho', title: 'Procurando Nemo', line: 'Just keep swimming.', linePt: 'Só continue nadando.',
    note: 'KEEP + verbo-ING = continuar fazendo. Por isso "keep swimming", nunca "keep to swim". Vale para keep going, keep trying, keep talking.',
    lessons: ['u6l3', 'u2l4'], match: ['keep', 'going'],
    search: 'finding nemo just keep swimming scene',
  },
  {
    lang: 'en', kind: 'filme', title: 'Forrest Gump', line: 'Life is like a box of chocolates.', linePt: 'A vida é como uma caixa de chocolates.',
    note: 'LIKE aqui é "como/parecido com", não o verbo gostar. Comparação: A is like B. Cuidado para não traduzir por "how".',
    lessons: ['u6l1', 'u2l2'], match: ['like', 'is like'],
    search: 'forrest gump box of chocolates scene',
  },
  {
    lang: 'en', kind: 'desenho', title: 'O Rei Leão', line: 'Hakuna Matata! It means no worries.', linePt: 'Hakuna Matata! Significa sem preocupações.',
    note: 'IT MEANS = significa. É exatamente a estrutura de "What does this word mean?" — na pergunta o verbo perde o -s, na resposta ele volta: it meanS.',
    lessons: ['u1l4'], match: ['mean', 'means'],
    search: 'lion king hakuna matata scene',
  },
  {
    lang: 'en', kind: 'filme', title: 'Tubarão', line: "You're gonna need a bigger boat.", linePt: 'Você vai precisar de um barco maior.',
    note: 'GONNA é "going to" falado — aparece em 90% dos filmes e em 0% das provas. Entenda ouvindo, escreva "going to".',
    lessons: ['u5l1'], match: ['going to', 'gonna'],
    search: 'jaws bigger boat scene',
  },
  {
    lang: 'en', kind: 'série', title: 'Friends', line: 'How you doin’?', linePt: 'E aí, tudo bem?',
    note: 'A forma completa é "How are you doing?". Na fala rápida o ARE some. Você não precisa falar assim — precisa ENTENDER quando falarem.',
    lessons: ['u1l1'], match: ['how are you', 'doing'],
    search: 'friends joey how you doin scene',
  },
  // ---------------- ESPANHOL ----------------
  {
    lang: 'es', kind: 'desenho', title: 'Encanto', line: 'No se habla de Bruno.', linePt: 'Não se fala do Bruno.',
    note: 'SE impessoal: "no se habla", "¿cómo se dice?", "se vende". Mesma lógica do português — aproveite que aqui você já sabe.',
    lessons: ['u1l3'], match: ['se dice', 'se habla'],
    search: 'encanto no se habla de bruno escena',
  },
  {
    lang: 'es', kind: 'desenho', title: 'Coco', line: 'Recuérdame.', linePt: 'Lembra de mim.',
    note: 'Imperativo com pronome grudado no fim: recuérda + me. Igual a "dime" (me diz) e "escúchame" (me escuta).',
    lessons: ['u1l3', 'u3l1'], match: ['dime', 'perdón'],
    search: 'coco recuerdame escena',
  },
  {
    lang: 'es', kind: 'série', title: 'La Casa de Papel', line: '¿Qué está pasando aquí?', linePt: 'O que está acontecendo aqui?',
    note: 'estar + gerúndio, igualzinho ao português. Mas cuidado: pasar = acontecer, não "passar".',
    lessons: ['u2l3'], match: ['pasa', 'pasando'],
    search: 'la casa de papel que esta pasando escena',
  },
  {
    lang: 'es', kind: 'música', title: 'Despacito', line: 'Quiero respirar tu cuello despacito.', linePt: 'Quero respirar seu pescoço devagar.',
    note: 'QUERER + infinitivo, sem preposição: quiero hablar, quiero comer. Nada de "quiero de hablar".',
    lessons: ['u2l2'], match: ['quisiera', 'quiero'],
    search: 'despacito letra',
  },
  // ---------------- FRANCES ----------------
  {
    lang: 'fr', kind: 'filme', title: 'O Fabuloso Destino de Amélie Poulain', line: "Je ne sais pas.", linePt: 'Eu não sei.',
    note: 'Negativa em duas partes: NE ... PAS em volta do verbo. Na fala rápida o "ne" some: "je sais pas". Escrevendo, mantenha.',
    lessons: ['u1l2', 'u2l3'], match: ['ne', 'pas'],
    search: 'amelie poulain scene francais',
  },
  {
    lang: 'fr', kind: 'desenho', title: 'Ratatouille', line: 'Bonjour, je voudrais commander.', linePt: 'Bom dia, eu queria fazer um pedido.',
    note: 'JE VOUDRAIS é o pedido educado. "Je veux" (eu quero) soa infantil e grosseiro num restaurante.',
    lessons: ['u2l2'], match: ['voudrais', 'plaît'],
    search: 'ratatouille restaurant scene francais',
  },
  {
    lang: 'fr', kind: 'música', title: 'La Vie en Rose — Édith Piaf', line: 'Quand il me prend dans ses bras.', linePt: 'Quando ele me toma nos braços.',
    note: 'Pronome objeto ANTES do verbo: "il ME prend". Em português a gente também faz isso ("ele me pega") — use isso a seu favor.',
    lessons: ['u1l1'], match: ['me', 'je m'],
    search: 'edith piaf la vie en rose',
  },
  // ---------------- ITALIANO ----------------
  {
    lang: 'it', kind: 'filme', title: 'A Vida é Bela', line: 'Buongiorno, principessa!', linePt: 'Bom dia, princesa!',
    note: 'BUONGIORNO é uma palavra só e serve até o começo da tarde. Depois disso: buonasera.',
    lessons: ['u1l1'], match: ['buongiorno', 'buonasera'],
    search: 'la vita e bella buongiorno principessa',
  },
  {
    lang: 'it', kind: 'desenho', title: 'Luca (Pixar)', line: 'Silenzio, Bruno!', linePt: 'Silêncio, Bruno!',
    note: 'Vocativo direto, sem artigo, como em português. E repare no som do "gn" e do "gl" italiano — é o que mais denuncia sotaque.',
    lessons: ['u1l1', 'u1l2'], match: ['scusa', 'ciao'],
    search: 'luca pixar silenzio bruno scena',
  },
  {
    lang: 'it', kind: 'música', title: 'Bella Ciao', line: 'Una mattina mi son svegliato.', linePt: 'Uma manhã eu acordei.',
    note: 'Verbo reflexivo no passado: mi sono svegliato. Igual ao "mi sveglio" da sua lição de rotina, só que ontem.',
    lessons: ['u2l3'], match: ['sveglio', 'mi'],
    search: 'bella ciao testo',
  },
  // ---------------- ALEMAO ----------------
  {
    lang: 'de', kind: 'série', title: 'Dark (Netflix)', line: 'Die Frage ist nicht wo, sondern wann.', linePt: 'A pergunta não é onde, e sim quando.',
    note: 'NICHT ... SONDERN = não ... mas sim. E repare: o verbo (ist) está na SEGUNDA posição, como sempre em alemão.',
    lessons: ['u1l2', 'u1l3'], match: ['nicht', 'ist'],
    search: 'dark netflix szene deutsch',
  },
  {
    lang: 'de', kind: 'desenho', title: 'Die Sendung mit der Maus', line: 'Guten Tag, wie geht es dir?', linePt: 'Bom dia, como você está?',
    note: 'Desenho alemão feito para explicar coisas devagar — é o material mais fácil de ouvir quando você está começando.',
    lessons: ['u1l1'], match: ['wie geht', 'guten'],
    search: 'die sendung mit der maus folge',
  },
  {
    lang: 'de', kind: 'filme', title: 'Good Bye, Lenin!', line: 'Ich habe keine Zeit.', linePt: 'Eu não tenho tempo.',
    note: 'KEIN nega substantivo (keine Zeit, kein Fleisch); NICHT nega verbo. Trocar os dois é o erro clássico de quem começa.',
    lessons: ['u2l2'], match: ['kein', 'nicht'],
    search: 'good bye lenin szene',
  },
  // ---------------- JAPONES ----------------
  {
    lang: 'ja', kind: 'desenho', title: 'A Viagem de Chihiro (Ghibli)', line: 'いただきます', linePt: 'Vou comer! (agradecimento antes da refeição)',
    note: 'Ninguém começa a comer sem dizer isso. No fim: ごちそうさまでした. Ghibli é o melhor material para ouvir japonês limpo e devagar.',
    lessons: ['u2l2'], match: ['ください', 'お願い'],
    search: 'spirited away itadakimasu scene',
  },
  {
    lang: 'ja', kind: 'desenho', title: 'Meu Amigo Totoro', line: 'おはようございます', linePt: 'Bom dia.',
    note: 'A versão curta おはよう é só para amigos. Com adultos e desconhecidos, sempre com ございます.',
    lessons: ['u1l1'], match: ['おはよう', 'こんにちは'],
    search: 'totoro ohayou scene',
  },
  {
    lang: 'ja', kind: 'série', title: 'Terrace House', line: 'よろしくお願いします', linePt: 'Conto com você / prazer.',
    note: 'A frase mais usada do Japão e a mais difícil de traduzir. Serve ao conhecer alguém, ao pedir um favor e ao começar qualquer coisa.',
    lessons: ['u1l1', 'u1l2'], match: ['お願い', 'はじめまして'],
    search: 'yoroshiku onegaishimasu meaning',
  },
  {
    lang: 'ja', kind: 'desenho', title: 'Naruto', line: 'がんばって！', linePt: 'Força! / Vai lá!',
    note: 'がんばって é a forma て usada como pedido/incentivo — a mesma do 話してください (fale, por favor).',
    lessons: ['u1l3'], match: ['ください', 'て'],
    search: 'naruto ganbatte scene',
  },
  // ---------------- COREANO ----------------
  {
    lang: 'ko', kind: 'série', title: 'Round 6 (Squid Game)', line: '무궁화 꽃이 피었습니다', linePt: 'A flor de hibisco floresceu.',
    note: 'Aquela frase da boneca. O ~습니다 é o registro MAIS formal — o mesmo de 감사합니다. Na rua você usa ~요.',
    lessons: ['u1l1'], match: ['습니다', '요'],
    search: 'squid game red light green light scene',
  },
  {
    lang: 'ko', kind: 'série', title: 'Pousando no Amor (K-drama)', line: '괜찮아요?', linePt: 'Você está bem?',
    note: '괜찮아요 é curinga: "tudo bem", "não precisa", "tá ok". A entonação muda o sentido — ouça em cena de verdade.',
    lessons: ['u1l3'], match: ['괜찮', 'gwaenchan'],
    search: 'crash landing on you gwaenchanayo scene',
  },
  {
    lang: 'ko', kind: 'música', title: 'BTS', line: '사랑해요', linePt: 'Eu te amo.',
    note: '사랑하다 + 요 = 사랑해요. Letra de K-pop é ótimo material: o hangul é fonético, então dá para cantar lendo.',
    lessons: ['u1l1'], match: ['해요', 'haeyo'],
    search: 'bts saranghaeyo lyrics hangul',
  },
  // ---------------- MANDARIM ----------------
  {
    lang: 'zh', kind: 'desenho', title: 'Kung Fu Panda (dublado em mandarim)', line: '你好！', linePt: 'Olá!',
    note: 'Ouça o tom: nǐ (3º tom) + hǎo (3º tom) vira ní hǎo na fala. Dois terceiros tons seguidos sempre mudam assim.',
    lessons: ['u1l1'], match: ['你好', 'ni hao'],
    search: 'kung fu panda chinese dub scene',
  },
  {
    lang: 'zh', kind: 'filme', title: 'Mulan (versão em mandarim)', line: '谢谢你。', linePt: 'Obrigada.',
    note: 'xièxie nǐ. O terceiro tom de nǐ cai bastante no fim da frase — normal.',
    lessons: ['u1l1', 'u2l2'], match: ['谢谢', 'xiexie'],
    search: 'mulan chinese version scene',
  },
  {
    lang: 'zh', kind: 'série', title: 'Peppa Pig em mandarim (小猪佩奇)', line: '我饿了。', linePt: 'Estou com fome.',
    note: 'Desenho infantil dublado é o atalho: frases curtas, tom claro e repetição. O 了 aqui marca mudança de estado.',
    lessons: ['u2l2'], match: ['了', 'le'],
    search: 'peppa pig chinese 小猪佩奇',
  },
  // ---------------- RUSSO ----------------
  {
    lang: 'ru', kind: 'desenho', title: 'Masha e o Urso', line: 'Привет!', linePt: 'Oi!',
    note: 'O melhor material para começar russo: fala devagar, repete e tem legenda em vários idiomas.',
    lessons: ['u1l1'], match: ['привет', 'privet'],
    search: 'masha i medved privet',
  },
  {
    lang: 'ru', kind: 'filme', title: 'Ironia do Destino', line: 'С Новым годом!', linePt: 'Feliz Ano Novo!',
    note: 'Preposição С + caso instrumental. Russo muda o FIM das palavras conforme a função — é o caso, não é erro de digitação.',
    lessons: ['u1l1'], match: ['с ', 'novym'],
    search: 'ирония судьбы сцена',
  },
  {
    lang: 'ru', kind: 'série', title: 'Кухня (Kitchen)', line: 'Что происходит?', linePt: 'O que está acontecendo?',
    note: 'Note que não existe verbo "estar": o russo resolve tudo com um verbo só, no presente.',
    lessons: ['u1l3'], match: ['что', 'chto'],
    search: 'сериал кухня сцена',
  },
  // ---------------- ARABE ----------------
  {
    lang: 'ar', kind: 'desenho', title: 'Iftah Ya Simsim (Vila Sésamo árabe)', line: 'السلام عليكم', linePt: 'A paz esteja com você.',
    note: 'Programa infantil em árabe padrão — exatamente o registro que você está aprendendo, falado bem devagar.',
    lessons: ['u1l1'], match: ['السلام', 'salam'],
    search: 'iftah ya simsim افتح يا سمسم',
  },
  {
    lang: 'ar', kind: 'filme', title: 'Capharnaüm (Cafarnaum)', line: 'من فضلك', linePt: 'Por favor.',
    note: 'Aqui o dialeto é libanês, diferente do árabe padrão do curso. Perceber essa diferença já é um nível a mais.',
    lessons: ['u1l3', 'u2l2'], match: ['فضلك', 'fadlik'],
    search: 'capharnaum film scene arabic',
  },
]

const YOUGLISH_LANG: Record<string, string> = {
  en: 'english', es: 'spanish', fr: 'french', it: 'italian', de: 'german',
  ja: 'japanese', ko: 'korean', zh: 'chinese', ru: 'russian', ar: 'arabic',
}

/** Link para ouvir a frase exata sendo falada em dezenas de videos reais. */
export function youglishUrl(phrase: string, lang: string) {
  const l = YOUGLISH_LANG[lang] ?? 'english'
  return `https://youglish.com/pronounce/${encodeURIComponent(phrase)}/${l}`
}

export function youtubeSearch(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

/** Acha um clipe que ajude com a frase que a pessoa acabou de errar. */
export function findClip(lang: string, lessonId: string, phrase: string): Clip | null {
  const p = phrase.toLowerCase()
  const pool = CLIPS.filter((c) => c.lang === lang)
  const byMatch = pool.filter((c) => c.match?.some((m) => p.includes(m.toLowerCase())))
  if (byMatch.length) return byMatch[Math.floor(Math.random() * byMatch.length)]
  const byLesson = pool.filter((c) => c.lessons?.includes(lessonId))
  if (byLesson.length) return byLesson[Math.floor(Math.random() * byLesson.length)]
  return null
}
