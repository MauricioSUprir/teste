// Tipos centrais do app. Tudo que e salvo no localStorage passa por aqui.

/** Uma frase do curriculo: a unidade minima de conteudo e tambem de revisao (SRS). */
export type Phrase = {
  /** Texto no idioma-alvo, no script nativo (resposta canonica) */
  t: string
  /** Portugues */
  pt: string
  /** Romanizacao (romaji, pinyin, hangul romanizado, translit.) — aceita como resposta */
  rom?: string
  /** Outras respostas aceitas */
  alt?: string[]
  /** Dica curta mostrada ao errar */
  tip?: string
}

export type Lesson = {
  id: string
  title: string
  icon: string
  /** Frase-conceito da licao, mostrada no briefing */
  focus: string
  grammar?: { title: string; body: string }
  phrases: Phrase[]
}

export type Unit = {
  id: string
  title: string
  subtitle: string
  cefr: 'A1' | 'A2' | 'B1' | 'B2'
  color: string
  lessons: Lesson[]
}

export type ExerciseKind =
  | 'translate-pt-en'
  | 'translate-en-pt'
  | 'bank'
  | 'choice'
  | 'listen'
  | 'fill'
  | 'match'
  | 'speak'

export type Exercise =
  | { kind: 'translate-pt-en' | 'translate-en-pt'; id: string; phrase: Phrase; prompt: string; answers: string[] }
  | { kind: 'bank'; id: string; phrase: Phrase; prompt: string; answers: string[]; bank: string[] }
  | { kind: 'choice'; id: string; phrase: Phrase; prompt: string; sub?: string; options: string[]; correct: number }
  | { kind: 'listen'; id: string; phrase: Phrase; answers: string[] }
  | { kind: 'fill'; id: string; phrase: Phrase; before: string; after: string; answers: string[]; options: string[] }
  | { kind: 'match'; id: string; pairs: { t: string; pt: string }[] }
  | { kind: 'speak'; id: string; phrase: Phrase }

/** Cartao de repeticao espacada (SM-2 simplificado). */
export type SrsCard = {
  id: string
  /** idioma do cartao */
  lang: string
  t: string
  pt: string
  rom?: string
  tip?: string
  /** de onde veio: licao ou erro cometido na conversa */
  source: 'lesson' | 'conversa'
  ease: number
  interval: number // em dias
  due: number // timestamp
  reps: number
  lapses: number
}

export type LessonProgress = {
  completed: boolean
  stars: number // 0..3
  bestAccuracy: number
  times: number
  lastAt: number
}

export type DayLog = { day: string; xp: number; minutes: number }

export type Difficulty = 'facil' | 'medio' | 'dificil'
export type Cefr = 'A1' | 'A2' | 'B1' | 'B2'

export type Profile = {
  name: string
  /** quanto o app pega no seu pe */
  difficulty: Difficulty
  /** nivel medido pelo teste de nivelamento, por idioma */
  levels: Record<string, Cefr>
  /** idiomas em que ela ja fez o teste de nivelamento */
  placed: string[]
  /** humor atual do Voca (ver content/moods.ts) */
  mood: string
  /** idioma sendo estudado agora */
  lang: string
  /** idiomas que ela ja abriu alguma vez */
  langs: string[]
  dailyGoal: number // xp por dia
  voiceRate: number
  voiceName: string | null
  /** o Voca fala tambem em portugues (a bronca, a traducao) */
  ptVoice: boolean
  ptVoiceName: string | null
  sound: boolean
  /** conversa continua: volta a escutar sozinho depois que o Voca fala */
  autoListen: boolean
  /** mostra a traducao das falas do Voca na conversa */
  showPt: boolean
  onboarded: boolean
}

export type Stats = {
  answers: number
  correct: number
  lessonsDone: number
  conversationTurns: number
  conversationSeconds: number
  wordsSpoken: number
}

export type SaveData = {
  version: number
  profile: Profile
  xp: number
  hearts: number
  heartsAt: number
  streak: number
  bestStreak: number
  freezes: number
  lastStudyDay: string | null
  lessons: Record<string, LessonProgress>
  srs: Record<string, SrsCard>
  achievements: string[]
  history: DayLog[]
  stats: Stats
  /** erros recorrentes detectados na conversa, para o Voca cobrar depois */
  weakSpots: Record<string, number>
  /** conta conectada (quando ela entra com e-mail) */
  account: { id: string; email: string } | null
  /** plano: o acesso as funcoes de IA sera cobrado no futuro */
  plan: 'free' | 'pro'
  proUntil: number | null
  /** ultima sincronizacao com a nuvem */
  syncedAt: number | null
}

export type Correction = { wrong: string; right: string; why: string }

export type ChatTurn = {
  role: 'user' | 'grimm'
  text: string
  pt?: string
  roast?: string
  corrections?: Correction[]
  suggestion?: string
  score?: number
  at: number
}
