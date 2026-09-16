// Cliente do servidor. Se o servidor nao estiver de pe (ou sem chave),
// tudo cai no modo offline — o app inteiro continua funcionando.
import type { ChatTurn, Correction } from '../state/types'

export type ChatReply = {
  reply: string
  replyPt?: string
  corrections: Correction[]
  roast?: string
  suggestion?: string
  score?: number
  offline?: boolean
}

const AI_STORE = 'voca-ia:ai'

/** Provedores de IA aceitos, com o que importa na hora de escolher. */
export type ProviderInfo = {
  id: string
  label: string
  free: string
  quality: string
  speed: string
  model: string
  signup: string
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    free: 'Tem plano gratuito (com limite por minuto/dia).',
    quality: 'A melhor opção grátis para este app: entende e responde bem nos 10 idiomas, inclusive japonês, coreano, árabe e russo.',
    speed: 'Rápido',
    model: 'gemini-2.5-flash',
    signup: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'groq',
    label: 'Groq',
    free: 'Tem plano gratuito (com limite de uso).',
    quality: 'Bom em inglês e nas línguas latinas; erra mais nuance de japonês, coreano e árabe.',
    speed: 'Absurdamente rápido — é o que deixa a conversa por voz mais natural.',
    model: 'llama-3.3-70b-versatile',
    signup: 'https://console.groq.com/keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    free: 'Tem modelos marcados como :free.',
    quality: 'Varia conforme o modelo escolhido; os gratuitos costumam ser medianos e às vezes ficam ocupados.',
    speed: 'Médio',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    signup: 'https://openrouter.ai/keys',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    free: 'Tem plano gratuito (com limite diário).',
    quality: 'Parecida com a do Groq.',
    speed: 'Muito rápido',
    model: 'llama-3.3-70b',
    signup: 'https://cloud.cerebras.ai',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    free: 'Tem camada gratuita para testes.',
    quality: 'Boa em francês, espanhol, italiano e inglês; fraca nos alfabetos não latinos.',
    speed: 'Rápido',
    model: 'mistral-small-latest',
    signup: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'ollama',
    label: 'Ollama (no seu computador)',
    free: 'Grátis de verdade e sem limite — mas só funciona rodando o app no mesmo computador.',
    quality: 'Depende do modelo e da máquina; abaixo dos de nuvem, mas resolve para treinar.',
    speed: 'Depende do seu computador',
    model: 'qwen3:8b',
    signup: 'https://ollama.com',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (pago)',
    free: 'Não tem plano gratuito.',
    quality: 'A melhor de todas para correção e para o humor do personagem.',
    speed: 'Rápido',
    model: 'claude-haiku-4-5-20251001',
    signup: 'https://console.anthropic.com',
  },
]

export type AiConfig = { provider: string; model: string; apiKey: string }

export function getAi(): AiConfig {
  try {
    const raw = localStorage.getItem(AI_STORE)
    if (raw) return { provider: '', model: '', apiKey: '', ...JSON.parse(raw) }
  } catch {
    /* navegador sem storage */
  }
  return { provider: '', model: '', apiKey: '' }
}

export function setAi(c: AiConfig) {
  try {
    localStorage.setItem(AI_STORE, JSON.stringify(c))
  } catch {
    /* navegador sem storage */
  }
  online = null
}

/** A pessoa configurou IA no proprio app? */
export function userAiReady() {
  const a = getAi()
  return !!a.provider && (!!a.apiKey || a.provider === 'ollama')
}

let online: boolean | null = null

export async function checkServer(): Promise<boolean> {
  if (online !== null) return online
  try {
    const r = await fetch('/api/health', { method: 'GET' })
    const j = await r.json()
    // tem provedor no servidor, ou a pessoa configurou o dela no app
    online = !!j.ok && (!!j.key || (!!j.byok && userAiReady()))
  } catch {
    online = false
  }
  return online
}

export function resetServerCheck() {
  online = null
}

export type ChatRequest = {
  langId: string
  langName: string
  mood: string
  scenarioId: string
  scenarioTitle: string
  situation: string
  level: string
  userName: string
  history: ChatTurn[]
  message: string
  weakSpots: string[]
  /** true = e a IA quem abre a conversa */
  opening?: boolean
}

export async function sendChat(req: ChatRequest): Promise<ChatReply> {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, ...aiFields() }),
  })
  if (!r.ok) throw new Error(await errorText(r))
  return (await r.json()) as ChatReply
}

export type Report = {
  summary: string
  strengths: string[]
  fix: { what: string; example: string }[]
  nextGoal: string
}

export async function sendReport(req: {
  langName: string
  mood: string
  turns: ChatTurn[]
  userName: string
}): Promise<Report> {
  const r = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, ...aiFields() }),
  })
  if (!r.ok) throw new Error(await errorText(r))
  return (await r.json()) as Report
}

function aiFields() {
  const a = getAi()
  if (!a.provider) return {}
  return { provider: a.provider, model: a.model || undefined, apiKey: a.apiKey || undefined }
}

async function errorText(r: Response) {
  try {
    const j = await r.json()
    return j.error ? String(j.error) : `servidor respondeu ${r.status}`
  } catch {
    return `servidor respondeu ${r.status}`
  }
}

/** Testa a configuracao atual e devolve a primeira fala da IA, ou o erro. */
export async function testAi(langName: string): Promise<{ ok: boolean; message: string }> {
  try {
    const out = await sendChat({
      langId: 'test',
      langName,
      mood: 'neutro',
      scenarioId: 'free',
      scenarioTitle: 'Teste',
      situation: 'Say hello and ask one simple question.',
      level: 'A1',
      userName: '',
      history: [],
      message: '',
      weakSpots: [],
      opening: true,
    })
    resetServerCheck()
    return { ok: true, message: out.reply }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'falhou' }
  }
}
