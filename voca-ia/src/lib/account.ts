// Conta do VOCA IA: e-mail e senha, com o progresso guardado na nuvem.
// O app funciona sem conta (tudo fica no navegador); a conta serve para
// nao perder nada ao trocar de aparelho — e, no futuro, para o plano pago.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SaveData } from '../state/types'

const URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? ''

export const accountsEnabled = !!URL && !!KEY

let client: SupabaseClient | null = null
function db() {
  if (!accountsEnabled) return null
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

export type Session = { id: string; email: string }

function traduzErro(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha errados.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Esse e-mail já tem conta. Tente entrar.'
  if (m.includes('password should be')) return 'A senha precisa de pelo menos 6 caracteres.'
  if (m.includes('valid email')) return 'Esse e-mail não parece válido.'
  if (m.includes('email not confirmed')) return 'Confirme o e-mail que enviamos antes de entrar.'
  if (m.includes('rate limit')) return 'Muitas tentativas seguidas. Espere um minuto.'
  return msg
}

export async function currentSession(): Promise<Session | null> {
  const c = db()
  if (!c) return null
  const { data } = await c.auth.getSession()
  const u = data.session?.user
  return u ? { id: u.id, email: u.email ?? '' } : null
}

export async function signUp(email: string, password: string, name: string) {
  const c = db()
  if (!c) throw new Error('contas não estão configuradas neste servidor')
  const { data, error } = await c.auth.signUp({ email, password, options: { data: { name } } })
  if (error) throw new Error(traduzErro(error.message))
  const u = data.user
  // quando a confirmacao por e-mail esta ligada, ainda nao ha sessao
  return u && data.session ? ({ id: u.id, email: u.email ?? '' } as Session) : null
}

export async function signIn(email: string, password: string): Promise<Session> {
  const c = db()
  if (!c) throw new Error('contas não estão configuradas neste servidor')
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(traduzErro(error.message))
  return { id: data.user.id, email: data.user.email ?? '' }
}

export async function signOut() {
  await db()?.auth.signOut()
}

export type CloudRow = { save: SaveData | null; plan: 'free' | 'pro'; proUntil: number | null; updatedAt: number }

export async function pull(): Promise<CloudRow | null> {
  const c = db()
  if (!c) return null
  const { data, error } = await c.from('progress').select('save, plan, pro_until, updated_at').maybeSingle()
  if (error || !data) return null
  return {
    save: (data.save as SaveData) ?? null,
    plan: (data.plan as 'free' | 'pro') ?? 'free',
    proUntil: data.pro_until ? new Date(data.pro_until).getTime() : null,
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : 0,
  }
}

export async function push(userId: string, save: SaveData) {
  const c = db()
  if (!c) return
  const { error } = await c
    .from('progress')
    .upsert({ user_id: userId, name: save.profile.name, save }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}

/**
 * Junta o que esta no aparelho com o que esta na nuvem, sempre para o lado de
 * quem tem MAIS progresso: ninguem perde ofensiva por ter trocado de celular.
 */
export function merge(local: SaveData, cloud: SaveData): SaveData {
  const lessons = { ...cloud.lessons }
  for (const [k, v] of Object.entries(local.lessons)) {
    const c = lessons[k]
    lessons[k] = !c
      ? v
      : {
          completed: c.completed || v.completed,
          stars: Math.max(c.stars, v.stars),
          bestAccuracy: Math.max(c.bestAccuracy, v.bestAccuracy),
          times: Math.max(c.times, v.times),
          lastAt: Math.max(c.lastAt, v.lastAt),
        }
  }
  const srs = { ...cloud.srs }
  for (const [k, v] of Object.entries(local.srs)) {
    const c = srs[k]
    srs[k] = !c || v.reps > c.reps ? v : c
  }
  const dias = new Map<string, { day: string; xp: number; minutes: number }>()
  for (const h of [...cloud.history, ...local.history]) {
    const d = dias.get(h.day)
    dias.set(h.day, d ? { ...d, xp: Math.max(d.xp, h.xp) } : h)
  }
  const recente = (local.syncedAt ?? 0) >= (cloud.syncedAt ?? 0) ? local : cloud
  return {
    ...recente,
    xp: Math.max(local.xp, cloud.xp),
    streak: Math.max(local.streak, cloud.streak),
    bestStreak: Math.max(local.bestStreak, cloud.bestStreak),
    hearts: Math.max(local.hearts, cloud.hearts),
    lessons,
    srs,
    history: [...dias.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-120),
    achievements: Array.from(new Set([...local.achievements, ...cloud.achievements])),
    stats: {
      answers: Math.max(local.stats.answers, cloud.stats.answers),
      correct: Math.max(local.stats.correct, cloud.stats.correct),
      lessonsDone: Math.max(local.stats.lessonsDone, cloud.stats.lessonsDone),
      conversationTurns: Math.max(local.stats.conversationTurns, cloud.stats.conversationTurns),
      conversationSeconds: Math.max(local.stats.conversationSeconds, cloud.stats.conversationSeconds),
      wordsSpoken: Math.max(local.stats.wordsSpoken, cloud.stats.wordsSpoken),
    },
    weakSpots: { ...cloud.weakSpots, ...local.weakSpots },
    profile: {
      ...recente.profile,
      langs: Array.from(new Set([...local.profile.langs, ...cloud.profile.langs])),
      placed: Array.from(new Set([...local.profile.placed, ...cloud.profile.placed])),
      levels: { ...cloud.profile.levels, ...local.profile.levels },
    },
  }
}

export type NovoPagamento = { plan: string; amount: number; months: number; txid: string; email: string }

/** Registra a intencao de pagamento. Quem libera o plano e o dono, ao conferir o Pix. */
export async function registrarPagamento(userId: string, p: NovoPagamento) {
  const c = db()
  if (!c) throw new Error('contas não estão configuradas neste servidor')
  const { error } = await c.from('payments').insert({
    user_id: userId,
    email: p.email,
    plan: p.plan,
    amount: p.amount,
    months: p.months,
    txid: p.txid,
  })
  if (error) throw new Error(error.message)
}

/** Pagamentos da pessoa, do mais novo para o mais antigo. */
export async function meusPagamentos() {
  const c = db()
  if (!c) return []
  const { data } = await c
    .from('payments')
    .select('plan, amount, txid, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}
