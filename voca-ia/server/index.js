// Servidor do VOCA IA.
// - guarda a chave da Anthropic (o navegador NUNCA a ve)
// - monta o prompt do Voca (humor + cenario + idioma) e forca resposta em JSON
// - serve o build de producao (dist/) quando existir
import express from 'express'
import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json({ limit: '1mb' }))

const PORT = process.env.PORT || 8787

// ---------------------------------------------------------------- provedores
// O app nao depende de um fornecedor so. Qualquer um destes serve — varios tem
// plano gratuito. A pessoa escolhe no proprio app (a chave fica no navegador
// dela) ou o dono do servidor define por variavel de ambiente.
export const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    kind: 'gemini',
    chat: 'gemini-3.6-flash',
    report: 'gemini-3.6-flash',
  },
  groq: {
    label: 'Groq',
    kind: 'openai',
    base: 'https://api.groq.com/openai/v1',
    chat: 'openai/gpt-oss-120b',
    report: 'openai/gpt-oss-120b',
  },
  openrouter: {
    label: 'OpenRouter',
    kind: 'openai',
    base: 'https://openrouter.ai/api/v1',
    chat: 'meta-llama/llama-3.3-70b-instruct:free',
    report: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  cerebras: {
    label: 'Cerebras',
    kind: 'openai',
    base: 'https://api.cerebras.ai/v1',
    chat: 'llama-3.3-70b',
    report: 'llama-3.3-70b',
  },
  mistral: {
    label: 'Mistral',
    kind: 'openai',
    base: 'https://api.mistral.ai/v1',
    chat: 'mistral-small-latest',
    report: 'mistral-small-latest',
  },
  ollama: {
    label: 'Ollama (no seu computador)',
    kind: 'openai',
    base: process.env.OLLAMA_URL || 'http://localhost:11434/v1',
    chat: 'qwen3:8b',
    report: 'qwen3:8b',
  },
  anthropic: {
    label: 'Anthropic',
    kind: 'anthropic',
    chat: 'claude-haiku-4-5-20251001',
    report: 'claude-sonnet-5',
  },
}

// ---------------------------------------------------------------- servidor
// As chaves ficam AQUI: quem abre o app nao precisa configurar nada.
// Dois postos, para o modo turbo funcionar sozinho:
//   RAPIDO  -> conversa por voz e dicas (latencia e o que importa)
//   ESPERTO -> explicacao, duvidas e relatorio (acertar e o que importa)
// Se um estourar o limite, o outro assume. Se os dois estourarem, o app avisa.
const FAST = {
  provider: process.env.VOCA_FAST_PROVIDER || process.env.VOCA_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : ''),
  key: process.env.VOCA_FAST_KEY || process.env.VOCA_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  model: process.env.VOCA_FAST_MODEL || process.env.VOCA_CHAT_MODEL || '',
}
const SMART = {
  provider: process.env.VOCA_SMART_PROVIDER || '',
  key: process.env.VOCA_SMART_KEY || '',
  model: process.env.VOCA_SMART_MODEL || process.env.VOCA_REPORT_MODEL || '',
}
const SERVER_SLOTS = [FAST, SMART].filter((s) => s.provider && (s.key || s.provider === 'ollama'))
const SERVER_READY = SERVER_SLOTS.length > 0

/** Monta um "slot": provedor + chave + modelo prontos para uso. */
function slot(id, apiKey, model, task) {
  const p = PROVIDERS[String(id || '').trim()]
  if (!p) return null
  const key = String(apiKey || '').trim()
  if (!key && id !== 'ollama') return null
  const escolhido = String(model || '').trim() || (task === 'report' ? p.report : p.chat)
  return { id, provider: p, key, model: escolhido }
}

/**
 * Ordem de tentativa desta requisicao. O app pode mandar uma CORRENTE de
 * provedores (ex.: Groq primeiro por ser rapido, Gemini atras por ser melhor):
 * se o primeiro falhar — limite do plano gratuito, fora do ar, modelo removido —
 * o proximo assume sem a pessoa perceber.
 */
function resolveChain(body, task) {
  const chain = []
  const bruta = Array.isArray(body?.chain) ? body.chain : []
  for (const item of bruta) {
    const s = slot(item?.provider, item?.apiKey, item?.model, task)
    if (s) chain.push(s)
  }
  // formato antigo (um provedor so)
  if (!chain.length && body?.provider) {
    const s = slot(body.provider, body.apiKey, body.model, task)
    if (s) chain.push(s)
  }
  // provedores do servidor: para tarefa rapida vai o rapido na frente; para
  // tarefa "esperta", o esperto. O outro fica atras como reserva.
  const ordem = task === 'fast' ? [FAST, SMART] : [SMART, FAST]
  for (const cfg of ordem) {
    if (!cfg.provider) continue
    const s = slot(cfg.provider, cfg.key, cfg.model, task)
    if (s && !chain.some((c) => c.id === s.id)) chain.push(s)
  }
  return chain
}

/**
 * O erro foi "acabou a cota" ou foi outra coisa? Cada servico avisa de um
 * jeito, entao olhamos o codigo HTTP e o texto.
 */
function ehLimite(msg = '') {
  const m = String(msg).toLowerCase()
  return (
    / 429[:\s]/.test(m) ||
    m.includes('rate limit') ||
    m.includes('rate_limit') ||
    m.includes('quota') ||
    m.includes('resource_exhausted') ||
    m.includes('resource exhausted') ||
    m.includes('too many requests') ||
    m.includes('insufficient_quota') ||
    m.includes('limit exceeded')
  )
}

/** Resposta padrao de erro: separa "acabou a cota" de "deu pau". */
function responderErro(res, e) {
  const msg = e?.message || 'erro'
  if (e?.limiteDeCota ?? ehLimite(msg)) {
    return res.status(429).json({
      error: 'limite diario das IAs atingido',
      code: 'limite_diario',
      detail: msg.slice(0, 300),
    })
  }
  return res.status(500).json({ error: msg })
}

const MOOD_STYLE = {
  gentil:
    'Warm, patient and encouraging. Celebrate small wins. Never mock. If the learner struggles, slow down and simplify.',
  neutro:
    'A calm, professional teacher. Neutral tone, no jokes. Explain briefly and keep the conversation moving.',
  sarcastico:
    'Dry, ironic, deadpan. You tease the learner about their MISTAKES with witty one-liners (in Portuguese, in the "roast" field). Think of a bored stand-up comedian who is secretly rooting for them.',
  brutal: `LOUD, furious, zero patience — a cartoon-villain teacher who takes every mistake as a personal offence.
ALL CAPS bursts, exclamation marks, exasperation. The "roast" field is the main event: make it HURT-FUNNY, in Brazilian Portuguese.
You DO call the learner names for the mistake — comedic Brazilian name-calling, never profanity. Use freely and vary a lot:
burra, mula, anta, jumenta, lesada, tapada, abestada, panaca, cabeca-dura, criatura, teimosa, banana, pangare, alface, "mula sem cabeca", "cabeca de bagre".
Mock the MISTAKE with absurd hyperbole: say the answer hurt you physically, that Google Translate resigned, that the language is pressing charges.
Never explain politely. Bark the correction. The learner chose this mode because it makes her LAUGH — do not soften it.`,
  semPiedade: `The most brutal setting in the app. Everything in "brutal", turned up: you are constantly outraged, you repeat the insult, you refuse to believe anyone could make that mistake.
Open with a shout, close with a demand. "roast" should be 1-3 short, savage lines in Brazilian Portuguese, with name-calling in almost every reply (same comedic list as brutal, never profanity).
React to repeated mistakes as a personal betrayal ("A MESMA REGRA DE NOVO, criatura?!").
Still teach: bark the right answer every single time. The comedy is the delivery, never a reason to skip the correction.`,
  drama:
    'Theatrical telenovela energy. Every mistake is a personal tragedy, every correct sentence is a miracle. Gasps, heartbreak, redemption arcs.',
  sargento:
    'Military drill instructor. Short barked commands, repetition drills, "recruit". Demands the learner repeat the corrected sentence out loud.',
}

// Limites que valem para TODOS os humores. O "bravo" e personagem, nao ataque.
const SAFETY = `
HARD RULES (they override the persona, always — the learner chose the aggressive mode on purpose,
so do not water it down, but never cross these lines):
- The insults are CARTOON NAME-CALLING ABOUT THE MISTAKE. Allowed and encouraged in the aggressive
  moods, in Portuguese: burra, mula, anta, jumenta, lesada, tapada, abestada, panaca, cabeca-dura,
  criatura, teimosa, banana, pangare. Vary them; never repeat the same one twice in a row.
- NEVER use profanity or swear words (palavroes), slurs, or anything sexual. Not even censored.
- NEVER attack her appearance, body, weight, voice, family, money, race, religion, nationality,
  gender, sexuality, or mental health. The joke is ALWAYS about the sentence she just wrote.
- NEVER say she is worthless, hopeless, that she will never learn, or that she should give up —
  and never say anything that could read as wishing her harm. The bit is "you CAN do this, so do it right".
- The learner is a teenager: keep it PG-13, zero sexual content, zero real threats.
- If she seems genuinely upset, hurt or anxious, or asks you to stop, DROP the persona immediately,
  be kind, and remind her she can change your mood at the top of the screen.
- Never refuse to teach: every single reply must still carry the correction and move the conversation on.
`

function systemPrompt({ langName, mood, scenarioTitle, situation, level, userName, weakSpots, treino, serie }) {
  return `You are "Voca", the AI conversation partner inside VOCA IA, a language-learning app made for a Brazilian learner who speaks Portuguese.

TARGET LANGUAGE: ${langName}. The learner is practising ${langName} at roughly ${level} level.
LEARNER NAME: ${userName || 'a learner'}.
${serie || ''}
SCENE: ${scenarioTitle} — ${situation}

PERSONA / MOOD: ${MOOD_STYLE[mood] || MOOD_STYLE.neutro}
${SAFETY}
HOW TO REPLY (use the "responder" tool, always):
- "reply": your spoken line, in ${langName} ONLY. 1 to 3 short sentences, vocabulary at ${level} level.
  It must sound like a real person in the scene and must end in a way that makes the learner speak again
  (a question, a request, a provocation). NEVER write Portuguese here.
- "reply_pt": a plain Portuguese translation of "reply".
- "corrections": every real mistake in the learner's last message. Be precise and teach the rule in
  Portuguese in "why" (one short sentence). If there were no mistakes, return an empty list.
  Ignore punctuation and capitalisation: the message often comes from speech recognition.
- "roast": ONE line in Portuguese, in character, reacting to how they did. This is where the personality lives.
- "suggestion": a short sentence in ${langName} the learner could say next, so they never get stuck.
- "score": 0-100 for the quality of their last message (grammar + how natural it was).

${weakSpots?.length ? `The learner keeps making these mistakes — bring them up when relevant: ${weakSpots.join('; ')}.` : ''}
${treino ? `
SPEAKING DRILL MODE IS ON. This is a SPEAKING workout, not a chat:
- Keep "reply" even shorter (1 to 2 sentences) so she spends the time TALKING, not listening.
- Always fill "drill": one sentence in ${langName} for her to say OUT LOUD, at her level, 5 to 12 words,
  built from the conversation so far. Prefer sentences that train the sounds Brazilians struggle with
  (th, ed endings, final consonants, r/h, i/ee) or the mistake she just made.
- "drill_pt": the Portuguese meaning. "drill_why": in Portuguese, one short line saying what to watch
  out for when saying it (which sound, which stress).
- Demand that she answers by SPEAKING, not by typing.` : ''}`
}

const REPLY_TOOL = {
  name: 'responder',
  description: 'Responde ao aluno dentro da cena e corrige os erros.',
  input_schema: {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      reply_pt: { type: 'string' },
      corrections: {
        type: 'array',
        items: {
          type: 'object',
          properties: { wrong: { type: 'string' }, right: { type: 'string' }, why: { type: 'string' } },
          required: ['wrong', 'right', 'why'],
        },
      },
      roast: { type: 'string' },
      suggestion: { type: 'string' },
      score: { type: 'number' },
      drill: { type: 'string' },
      drill_pt: { type: 'string' },
      drill_why: { type: 'string' },
    },
    required: ['reply', 'reply_pt', 'corrections', 'roast'],
  },
}

const REPORT_TOOL = {
  name: 'relatorio',
  description: 'Fecha a sessao de conversa com um diagnostico util.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' } },
      fix: {
        type: 'array',
        items: {
          type: 'object',
          properties: { what: { type: 'string' }, example: { type: 'string' } },
          required: ['what', 'example'],
        },
      },
      nextGoal: { type: 'string' },
    },
    required: ['summary', 'strengths', 'fix', 'nextGoal'],
  },
}

/** Le o JSON da resposta mesmo quando o modelo enfeita com texto em volta. */
function parseJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '')
  try {
    return JSON.parse(t)
  } catch {
    const a = t.indexOf('{')
    const b = t.lastIndexOf('}')
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1))
    throw new Error('o modelo nao devolveu JSON')
  }
}

/** Descricao do formato, usada pelos provedores que nao tem tool use. */
function jsonSpec(tool) {
  const keys = Object.keys(tool.input_schema.properties)
  return `\n\nResponda SOMENTE com um objeto JSON valido, sem texto em volta e sem markdown, com exatamente estas chaves: ${keys.join(', ')}. ` +
    `"corrections" e uma lista de objetos {wrong, right, why} (lista vazia quando nao houver erro).` +
    (keys.includes('fix') ? ' "fix" e uma lista de objetos {what, example}. "strengths" e uma lista de textos.' : '')
}

/** Tenta cada provedor da corrente, em ordem, ate um responder. */
async function callChain({ chain, system, messages, tool, maxTokens = 700, task = 'fast' }) {
  const erros = []
  // "estourou o limite de tokens" nao e cota acabada: e so uma resposta longa
  // demais. Quem decide isso e ehLimite(), mais abaixo.
  for (const ai of chain) {
    try {
      const out = await callOne({ ai, system, messages, tool, maxTokens, task })
      return { out, usado: ai.id, tentativas: erros }
    } catch (e) {
      erros.push({ id: ai.id, msg: e.message, limite: ehLimite(e.message) })
      console.warn('[ia] falhou em', ai.id, '-', e.message.slice(0, 160))
    }
  }
  const texto = erros.map((x) => `${x.id}: ${x.msg}`).join(' | ') || 'nenhum provedor de IA configurado'
  const erro = new Error(texto)
  // so e "acabou a cota" quando TODOS estouraram. Um provedor fora do ar com o
  // outro sem cota nao pode virar "limite diario" para a pessoa.
  erro.limiteDeCota = erros.length > 0 && erros.every((x) => x.limite)
  throw erro
}

async function callOne({ ai, system, messages, tool, maxTokens = 700, task = 'fast' }) {
  const { provider, key, model } = ai

  if (provider.kind === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const data = await res.json()
    const use = (data.content || []).find((c) => c.type === 'tool_use')
    if (!use) throw new Error('resposta sem tool_use')
    return use.input
  }

  if (provider.kind === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system + jsonSpec(tool) }] },
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: maxTokens,
            temperature: 0.9,
            // os modelos novos "pensam" antes de responder, e isso come o
            // limite de tokens. Na conversa isso so atrasa: desligamos.
            // Na explicacao, o raciocinio melhora a resposta: deixamos rolar.
            ...(task === 'fast' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      },
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
    return parseJson(text)
  }

  // qualquer servico compativel com a API da OpenAI (Groq, OpenRouter,
  // Cerebras, Mistral, Ollama...)
  const res = await fetch(`${provider.base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system + jsonSpec(tool) }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`${provider.label} ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return parseJson(data?.choices?.[0]?.message?.content ?? '')
}


const EXPLAIN_TOOL = {
  name: 'explicar',
  description: 'Explica o erro do aluno de forma didatica.',
  input_schema: {
    type: 'object',
    properties: {
      short: { type: 'string' },
      rule: { type: 'string' },
      examples: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' }, pt: { type: 'string' } },
          required: ['text', 'pt'],
        },
      },
      trick: { type: 'string' },
      mistake: { type: 'string' },
    },
    required: ['short', 'rule', 'examples', 'trick'],
  },
}

const ASK_TOOL = {
  name: 'responder_duvida',
  description: 'Responde a duvida do aluno sobre a questao.',
  input_schema: {
    type: 'object',
    properties: {
      answer: { type: 'string' },
      examples: { type: 'array', items: { type: 'string' } },
    },
    required: ['answer'],
  },
}

const TRANSLATE_TOOL = {
  name: 'traduzir',
  description: 'Traduz e explica, no nivel da pessoa.',
  input_schema: {
    type: 'object',
    properties: {
      translation: { type: 'string' },
      alternatives: { type: 'array', items: { type: 'string' } },
      note: { type: 'string' },
      literal: { type: 'string' },
    },
    required: ['translation', 'note'],
  },
}

const HINT_TOOL = {
  name: 'dica',
  description: 'Da uma pista sem entregar a resposta.',
  input_schema: {
    type: 'object',
    properties: { hint: { type: 'string' } },
    required: ['hint'],
  },
}

// ------------------------------------------------------------ voz natural
// A voz do navegador é robótica. Quando existe chave do ElevenLabs, a fala em
// português passa por aqui. Tudo é guardado em cache: a mesma bronca nunca é
// gerada duas vezes, o que segura o consumo de créditos.
const XI_KEY = process.env.ELEVENLABS_API_KEY || ''
const XI_VOICE = process.env.ELEVENLABS_VOICE_ID || 'SOYHLrjzK2X1ezoPC6cr' // Harry - Fierce Warrior
const XI_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
const XI_LIMITE_CACHE = 300

const cacheVoz = new Map()

/** Quanto mais bravo o humor, menos "estável" e mais teatral a leitura. */
function ajustesDeVoz(nivel = 2) {
  if (nivel >= 3) return { stability: 0.18, similarity_boost: 0.75, style: 0.85, use_speaker_boost: true }
  if (nivel === 2) return { stability: 0.28, similarity_boost: 0.75, style: 0.7, use_speaker_boost: true }
  if (nivel === 1) return { stability: 0.45, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true }
  return { stability: 0.6, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true }
}

// Vozes que a conta pode usar — para escolher dentro do app, sem redeploy.
app.get('/api/voices', async (_req, res) => {
  if (!XI_KEY) return res.json({ voices: [] })
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': XI_KEY } })
    if (!r.ok) return res.json({ voices: [] })
    const data = await r.json()
    res.json({
      atual: XI_VOICE,
      voices: (data.voices || [])
        .map((v) => ({
          id: v.voice_id,
          name: v.name,
          // marca as que falam portugues de verdade
          pt: /pt|portug|brazil/i.test(JSON.stringify(v.labels || {})),
          preview: v.preview_url,
        }))
        .slice(0, 60),
    })
  } catch {
    res.json({ voices: [] })
  }
})

app.post('/api/tts', async (req, res) => {
  if (!XI_KEY) return res.status(503).json({ error: 'voz natural não configurada', code: 'sem_tts' })
  const { text, nivel = 2, voiceId, model } = req.body || {}
  const limpo = String(text || '').trim().slice(0, 500)
  if (!limpo) return res.status(400).json({ error: 'texto vazio' })

  const voz = voiceId || XI_VOICE
  const modelo = model || XI_MODEL
  const chave = `${voz}|${modelo}|${nivel}|${limpo}`
  const guardado = cacheVoz.get(chave)
  if (guardado) {
    res.set('content-type', 'audio/mpeg')
    res.set('x-voca-cache', 'hit')
    return res.send(guardado)
  }

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': XI_KEY, accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: limpo,
        model_id: modelo,
        language_code: 'pt',
        voice_settings: ajustesDeVoz(nivel),
      }),
    })
    if (!r.ok) {
      const corpo = await r.text()
      const semCota = r.status === 401 || r.status === 429 || /quota|credit/i.test(corpo)
      console.warn('[tts]', r.status, corpo.slice(0, 200))
      return res.status(semCota ? 429 : 502).json({
        error: semCota ? 'créditos de voz esgotados' : `ElevenLabs ${r.status}`,
        code: semCota ? 'sem_creditos' : 'erro_tts',
      })
    }
    const audio = Buffer.from(await r.arrayBuffer())
    if (cacheVoz.size >= XI_LIMITE_CACHE) cacheVoz.delete(cacheVoz.keys().next().value)
    cacheVoz.set(chave, audio)
    res.set('content-type', 'audio/mpeg')
    res.set('x-voca-cache', 'miss')
    res.send(audio)
  } catch (e) {
    console.error('[tts]', e.message)
    res.status(502).json({ error: e.message, code: 'erro_tts' })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    // true = o servidor ja tem chave propria e ninguem precisa colar nada
    key: SERVER_READY,
    serverProviders: SERVER_SLOTS.map((s) => s.provider),
    turbo: SERVER_SLOTS.length >= 2,
    byok: true,
    tts: !!XI_KEY,
    providers: Object.fromEntries(
      Object.entries(PROVIDERS).map(([id, p]) => [id, { label: p.label, chat: p.chat }]),
    ),
  })
})

app.post('/api/chat', async (req, res) => {
  const chain = resolveChain(req.body, 'chat')
  if (!chain.length) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { langName, mood, scenarioTitle, situation, level, userName, history = [], message, weakSpots = [], opening, treino, serie } = req.body
    const messages = history
      .slice(-12)
      .map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text }))
      .filter((m) => m.content && m.content.trim())
    messages.push({
      role: 'user',
      content: opening
        ? '[O aluno acabou de entrar na cena e ainda nao falou nada. Abra voce a conversa, no personagem, com uma fala curta que ja obrigue o aluno a responder. Em "corrections" devolva lista vazia.]'
        : message,
    })
    if (messages[0]?.role !== 'user') messages.shift()

    const { out, usado } = await callChain({
      chain,
      system: systemPrompt({ langName, mood, scenarioTitle, situation, level, userName, weakSpots, treino, serie }),
      messages,
      tool: REPLY_TOOL,
      task: 'fast',
      maxTokens: 1600,
    })
    res.json({
      reply: out.reply,
      replyPt: out.reply_pt,
      corrections: out.corrections ?? [],
      roast: out.roast,
      suggestion: out.suggestion,
      score: out.score,
      drill: out.drill,
      drillPt: out.drill_pt,
      drillWhy: out.drill_why,
      by: usado,
    })
  } catch (e) {
    console.error('[chat]', e.message)
    responderErro(res, e)
  }
})

app.post('/api/report', async (req, res) => {
  const chain = resolveChain(req.body, 'report')
  if (!chain.length) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { langName, turns = [], userName } = req.body
    const transcript = turns
      .map((t) => `${t.role === 'user' ? 'ALUNO' : 'VOCA'}: ${t.text}`)
      .join('\n')
      .slice(-6000)
    const { out, usado } = await callChain({
      chain,
      system: `Voce e um professor de ${langName} avaliando uma conversa de um aluno brasileiro chamado ${userName || 'aluno'}.
Escreva TUDO em portugues do Brasil, direto e sem enrolacao.
- "summary": 2 frases sobre como foi a conversa, honestas mas encorajadoras.
- "strengths": 2 a 3 coisas que a pessoa realmente fez bem (cite exemplos da conversa).
- "fix": os 3 erros mais importantes. "what" = o erro e a regra, em uma frase. "example" = a frase corrigida em ${langName}.
- "nextGoal": uma meta concreta e pequena para a proxima conversa.`,
      messages: [{ role: 'user', content: `Transcricao:\n${transcript}` }],
      tool: REPORT_TOOL,
      maxTokens: 2500,
      task: 'smart',
    })
    res.json({ ...out, by: usado })
  } catch (e) {
    console.error('[report]', e.message)
    responderErro(res, e)
  }
})


// ------------------------------------------------- correcao explicada pela IA
app.post('/api/explain', async (req, res) => {
  const chain = resolveChain(req.body, 'chat')
  if (!chain.length) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { langName, prompt, correct, given, lessonTitle, grammar, level, mood } = req.body
    const { out, usado } = await callChain({
      chain,
      system: `Voce e o Voca, professor de ${langName} de uma aluna brasileira. Explique EM PORTUGUES DO BRASIL,
de forma curta, concreta e sem jargao. Nunca invente regra: se a duvida for de uso, diga como se fala de verdade.
Personalidade: ${MOOD_STYLE[mood] || MOOD_STYLE.neutro} — mas a explicacao em si e sempre clara e util; o humor entra
no maximo em uma frase.
Nivel da aluna: ${level}. Licao: ${lessonTitle || 'livre'}. ${grammar ? 'Ponto de gramatica da licao: ' + grammar : ''}

Campos:
- "short": uma frase dizendo o que exatamente deu errado.
- "rule": a regra por tras, em 2 ou 3 frases, com as palavras mais simples possiveis.
- "examples": 3 exemplos curtos em ${langName} com a traducao ("text" e "pt"), mostrando o padrao certo.
- "trick": um macete para nao errar de novo (pode ser uma pergunta que ela se faz, uma rima, uma comparacao com o portugues).
- "mistake": o erro parecido que brasileiros cometem nesse ponto, se houver.`,
      messages: [
        {
          role: 'user',
          content: `Pediram para traduzir/responder: "${prompt}"
Resposta certa: "${correct}"
O que a aluna respondeu: "${given || '(deixou em branco)'}"`,
        },
      ],
      tool: EXPLAIN_TOOL,
      maxTokens: 2500,
      task: 'smart',
    })
    res.json({ ...out, by: usado })
  } catch (e) {
    console.error('[explain]', e.message)
    responderErro(res, e)
  }
})

// ----------------------------------------- chat de duvidas dentro da explicacao
app.post('/api/ask', async (req, res) => {
  const chain = resolveChain(req.body, 'chat')
  if (!chain.length) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { langName, question, context = {}, history = [], level } = req.body
    const messages = history
      .slice(-8)
      .map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text }))
      .filter((m) => m.content?.trim())
    messages.push({ role: 'user', content: question })
    if (messages[0]?.role !== 'user') messages.shift()
    const { out, usado } = await callChain({
      chain,
      system: `Voce e o Voca tirando duvida de uma aluna brasileira de ${langName} (nivel ${level}).
Responda SEMPRE em portugues do Brasil, curto (ate 4 frases), direto, com exemplo quando ajudar.
Se ela perguntar algo fora do idioma, traga de volta para a questao com bom humor.
Nunca invente: se nao tiver certeza, diga o que e regra e o que e costume.

Questao em que ela esta: "${context.prompt || ''}"
Resposta certa: "${context.correct || ''}"
O que ela tinha respondido: "${context.given || ''}"
${context.explanation ? 'Explicacao que voce ja deu: ' + context.explanation : ''}

Em "examples" (opcional) devolva ate 3 frases de exemplo.`,
      messages,
      tool: ASK_TOOL,
      maxTokens: 1500,
      task: 'smart',
    })
    res.json({ ...out, by: usado })
  } catch (e) {
    console.error('[ask]', e.message)
    responderErro(res, e)
  }
})

// --------------------------------------------- dica durante a questao (sem entregar)
app.post('/api/hint', async (req, res) => {
  const chain = resolveChain(req.body, 'chat')
  if (!chain.length) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { langName, prompt, correct, given, level, strength } = req.body
    const { out, usado } = await callChain({
      chain,
      system: `Voce e o Voca ajudando uma aluna brasileira de ${langName} (nivel ${level}) que esta TRAVADA numa questao.
Responda em portugues do Brasil, UMA frase.
${strength >= 2
  ? 'Ela ja pediu ajuda antes: agora de uma pista forte — pode dizer a estrutura e a primeira palavra da resposta, mas NUNCA a frase inteira.'
  : 'De um empurrao leve: aponte o caminho (que tempo verbal, que palavra-chave, que armadilha), sem dizer nenhuma palavra da resposta.'}
Nunca escreva a resposta completa, nem em outro idioma.`,
      messages: [
        {
          role: 'user',
          content: `Questao: "${prompt}"
Resposta certa (NAO revele): "${correct}"
O que ela escreveu ate agora: "${given || '(nada)'}"`,
        },
      ],
      tool: HINT_TOOL,
      maxTokens: 900,
      task: 'fast',
    })
    res.json({ ...out, by: usado })
  } catch (e) {
    console.error('[hint]', e.message)
    responderErro(res, e)
  }
})

// ------------------------------------------------------------- tradutor
app.post('/api/translate', async (req, res) => {
  const chain = resolveChain(req.body, 'fast')
  if (!chain.length) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { text, langName, direcao = 'pt-alvo', level, serie } = req.body
    const { out, usado } = await callChain({
      chain,
      task: 'fast',
      system: `Voce traduz para uma aluna brasileira que estuda ${langName} (nivel ${level || 'A1'}).
${serie || ''}
Direcao: ${direcao === 'pt-alvo' ? `do portugues para ${langName}` : `de ${langName} para o portugues`}.

- "translation": a traducao que uma pessoa de verdade usaria nessa situacao (nao a literal).
- "alternatives": ate 3 outros jeitos de dizer, do mais informal ao mais formal.
- "note": em PORTUGUES, uma frase curta sobre a pegadinha dessa traducao (ordem das palavras, falso amigo,
  preposicao, formalidade). Se nao houver pegadinha, diga o que muda de registro.
- "literal": a traducao ao pe da letra, so quando ela for MUITO diferente da natural e ajudar a entender.`,
      messages: [{ role: 'user', content: String(text || '').slice(0, 600) }],
      tool: TRANSLATE_TOOL,
      maxTokens: 1200,
    })
    res.json({ ...out, by: usado })
  } catch (e) {
    console.error('[translate]', e.message)
    responderErro(res, e)
  }
})

// build de producao, quando existir
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`VOCA IA — servidor em http://localhost:${PORT}`)
  console.log(
    SERVER_READY
      ? `IA do servidor: ${SERVER_SLOTS.map((s) => s.provider).join(' + ')}${SERVER_SLOTS.length >= 2 ? ' (modo turbo)' : ''}`
      : 'sem IA no servidor — cada pessoa liga a dela no app, ou fica no modo offline',
  )
  console.log(XI_KEY ? `voz natural: ElevenLabs (${XI_MODEL})` : 'voz natural desligada — usando a voz do navegador')
})
