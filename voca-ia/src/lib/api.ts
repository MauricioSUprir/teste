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

const KEY_STORE = 'voca-ia:key'

/** Chave da Anthropic que a propria pessoa colou no app (fica so no navegador). */
export function getUserKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) ?? ''
  } catch {
    return ''
  }
}

export function setUserKey(k: string) {
  try {
    if (k.trim()) localStorage.setItem(KEY_STORE, k.trim())
    else localStorage.removeItem(KEY_STORE)
  } catch {
    /* navegador sem storage */
  }
  online = null
}

let online: boolean | null = null

export async function checkServer(): Promise<boolean> {
  if (online !== null) return online
  try {
    const r = await fetch('/api/health', { method: 'GET' })
    const j = await r.json()
    // tem chave no servidor, ou a pessoa colou a dela no app
    online = !!j.ok && (!!j.key || (!!j.byok && !!getUserKey()))
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
    body: JSON.stringify({ ...req, apiKey: getUserKey() || undefined }),
  })
  if (!r.ok) throw new Error(`servidor respondeu ${r.status}`)
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
    body: JSON.stringify({ ...req, apiKey: getUserKey() || undefined }),
  })
  if (!r.ok) throw new Error(`servidor respondeu ${r.status}`)
  return (await r.json()) as Report
}
