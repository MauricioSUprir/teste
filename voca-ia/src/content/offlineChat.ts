// Conversa SEM IA. Nao e um chat de verdade, e e honesto quanto a isso:
// o Voca vira um entrevistador que puxa perguntas do proprio curso, cobra
// resposta e corrige os erros classicos de brasileiro por regra fixa.
import type { ChatTurn, Correction } from '../state/types'
import type { LangDef } from './languages'
import { getMood, type MoodId } from './moods'
import { one, norm } from '../lib/util'
import type { ChatReply } from '../lib/api'

type Rule = { re: RegExp; right: string; why: string }

const PT_WORDS = [
  'eu', 'voce', 'nao', 'sim', 'muito', 'gente', 'cara', 'obrigado', 'obrigada',
  'entao', 'porque', 'tudo', 'bem', 'legal', 'coisa', 'agora', 'mas', 'tambem',
]

const RULES: Record<string, Rule[]> = {
  en: [
    { re: /\bi have \w+ years?\b/i, right: 'I am ... years old', why: 'Idade em inglês usa TO BE, não TO HAVE.' },
    { re: /\bi am agree\b/i, right: 'I agree', why: 'Agree já é verbo: não leva "am".' },
    { re: /\bpeople is\b/i, right: 'people are', why: '"People" é plural.' },
    { re: /\b(he|she|it) don't\b/i, right: "he / she / it doesn't", why: 'Terceira pessoa usa doesn’t.' },
    { re: /\bdidn't \w+ed\b/i, right: "didn't + verbo no infinitivo", why: 'Depois de didn’t o verbo volta ao normal: "didn’t go", não "didn’t went".' },
    { re: /\bdidn't went\b/i, right: "didn't go", why: 'Depois de didn’t o verbo fica no infinitivo.' },
    { re: /\bmore better\b/i, right: 'better', why: 'Better já é comparativo: não leva "more".' },
    { re: /\bexplain me\b/i, right: 'explain to me', why: 'Explain pede TO antes da pessoa.' },
    { re: /\bi have cold\b/i, right: "I'm cold", why: 'Frio, fome, sede e medo usam TO BE em inglês.' },
    { re: /\bi have hungry\b/i, right: "I'm hungry", why: 'Fome usa TO BE: I am hungry.' },
    { re: /\bmake a party\b/i, right: 'throw a party / have a party', why: 'Festa não se "make" em inglês.' },
    { re: /^is raining/i, right: "It's raining", why: 'Inglês nunca omite o sujeito: sempre IT.' },
    { re: /\bi pretend to\b/i, right: 'I intend to', why: 'Falso amigo: pretend = fingir. Pretender = intend.' },
    { re: /\bi have \d+\b/i, right: 'I am ... years old', why: 'Se for idade: I am, não I have.' },
    { re: /^(you|he|she|they|we) (like|want|have|know|live|speak|work)\b/i, right: 'Do you / Does he ...?', why: 'Pergunta no presente começa com DO ou DOES.' },
  ],
  es: [
    { re: /\bestoy estudiante\b/i, right: 'soy estudiante', why: 'Profissão é permanente: SER, não ESTAR.' },
    { re: /\bmuy mucho\b/i, right: 'muchísimo', why: '"Muy mucho" não existe.' },
    { re: /\bnecesito de\b/i, right: 'necesito', why: 'Necesitar não leva "de".' },
    { re: /\bembarazad[ao]\b/i, right: 'avergonzado/a', why: 'Falso amigo perigoso: embarazada = grávida.' },
    { re: /\bme gusto\b/i, right: 'me gusta', why: 'Gustar concorda com a COISA, não com você.' },
  ],
  fr: [
    { re: /\bje suis \d+ ans\b/i, right: "j'ai ... ans", why: 'Idade em francês usa AVOIR.' },
    { re: /\bje suis d'accord avec\b/i, right: "je suis d'accord avec", why: 'Essa está certa — só cuidado para não usar "j’accorde".' },
    { re: /\bvisiter (mon|ma|mes) \w+/i, right: 'rendre visite à', why: 'Visitar PESSOA é "rendre visite à"; visiter é para lugares.' },
  ],
  it: [
    { re: /\bio sono \d+ anni\b/i, right: 'ho ... anni', why: 'Idade em italiano usa AVERE.' },
    { re: /\bmi piaccio\b/i, right: 'mi piace', why: 'Piacere concorda com a coisa que agrada.' },
  ],
  de: [
    { re: /\bich bin \d+ jahre\b/i, right: 'Ich bin ... Jahre alt', why: 'Quase: falta o "alt" no fim.' },
    { re: /\bich habe \d+ jahre\b/i, right: 'Ich bin ... Jahre alt', why: 'Idade em alemão usa SEIN.' },
  ],
  ru: [{ re: /\bя есть\b/i, right: 'я ...', why: 'No presente o verbo "ser" não existe em russo.' }],
  ja: [], ko: [], zh: [], ar: [],
}

function detectPortuguese(text: string) {
  const t = norm(text)
  const hits = PT_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(t)).length
  return hits >= 2
}

/** Perguntas do proprio curso, usadas como turnos do Voca offline. */
function questionBank(lang: LangDef) {
  const qs: { t: string; pt: string; rom?: string }[] = []
  for (const u of lang.units)
    for (const l of u.lessons)
      for (const p of l.phrases)
        if (/[?？]\s*$/.test(p.t) || /か。?\s*$/.test(p.t) || /吗？?\s*$/.test(p.t))
          qs.push({ t: p.t, pt: p.pt, rom: p.rom })
  return qs
}

export type OfflineCtx = {
  lang: LangDef
  mood: MoodId
  history: ChatTurn[]
}

export function offlineReply(input: string, ctx: OfflineCtx): ChatReply {
  const mood = getMood(ctx.mood)
  const corrections: Correction[] = []
  const text = input.trim()
  const wordCount = text.split(/\s+/).filter(Boolean).length

  if (detectPortuguese(text) && ctx.lang.id !== 'pt') {
    corrections.push({
      wrong: text,
      right: `(em ${ctx.lang.name})`,
      why: `Você respondeu em português. O combinado é responder em ${ctx.lang.name} — erre à vontade, mas erre no idioma certo.`,
    })
  }
  for (const rule of RULES[ctx.lang.id] ?? []) {
    if (!rule.re.test(text)) continue
    // uma regra mais especifica ja pode ter pego o mesmo erro
    if (corrections.some((c) => c.right === rule.right)) continue
    const m = text.match(rule.re)
    corrections.push({ wrong: m?.[0] ?? text, right: rule.right, why: rule.why })
  }
  if (wordCount === 1 && !/^(yes|no|ok|sí|si|oui|ja|да|نعم|はい|네|是)$/i.test(text)) {
    corrections.push({
      wrong: text,
      right: `${text} + o resto da frase`,
      why: 'Responder com uma palavra só não conta como conversa. Frase inteira.',
    })
  }

  const bank = questionBank(ctx.lang)
  const used = new Set(ctx.history.filter((t) => t.role === 'grimm').map((t) => t.text))
  const fresh = bank.filter((q) => !used.has(q.t))
  const q = (fresh.length ? one(fresh) : one(bank)) ?? { t: '...', pt: '...' }

  const good = corrections.length === 0 && wordCount >= 3
  const roast = good ? one(mood.praise) : one(mood.wrong)

  return {
    reply: q.t,
    replyPt: q.pt,
    corrections,
    roast: `${roast}${good ? '' : ' '}${corrections.length ? '' : ''}`.trim(),
    suggestion: q.rom ? `Responda em ${ctx.lang.name} — dica de leitura: ${q.rom}` : undefined,
    score: good ? 80 : Math.max(20, 70 - corrections.length * 20),
    offline: true,
  }
}

export function offlineGreeting(ctx: OfflineCtx) {
  const mood = getMood(ctx.mood)
  const bank = questionBank(ctx.lang)
  const q = bank.length ? one(bank) : { t: 'Hello!', pt: 'Olá!', rom: undefined }
  return {
    reply: q.t,
    replyPt: q.pt,
    corrections: [],
    roast: one(mood.hello),
    suggestion: q.rom,
    offline: true,
  } as ChatReply
}
