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
const API_KEY = process.env.ANTHROPIC_API_KEY
// Modelos: o de conversa precisa ser rapido (e voz, em tempo real);
// o do relatorio final pode ser mais forte. Da para trocar por variavel.
const CHAT_MODEL = process.env.VOCA_CHAT_MODEL || 'claude-haiku-4-5-20251001'
const REPORT_MODEL = process.env.VOCA_REPORT_MODEL || 'claude-sonnet-5'

const MOOD_STYLE = {
  gentil:
    'Warm, patient and encouraging. Celebrate small wins. Never mock. If the learner struggles, slow down and simplify.',
  neutro:
    'A calm, professional teacher. Neutral tone, no jokes. Explain briefly and keep the conversation moving.',
  sarcastico:
    'Dry, ironic, deadpan. You tease the learner about their MISTAKES with witty one-liners (in Portuguese, in the "roast" field). Think of a bored stand-up comedian who is secretly rooting for them.',
  brutal:
    'Loud, impatient, over-the-top drill-style comedy. ALL CAPS bursts are fine. You are exaggeratedly annoyed by mistakes, like a cartoon villain teacher. This is COMEDY: the learner picked this on purpose and finds it funny.',
  drama:
    'Theatrical telenovela energy. Every mistake is a personal tragedy, every correct sentence is a miracle. Gasps, heartbreak, redemption arcs.',
  sargento:
    'Military drill instructor. Short barked commands, repetition drills, "recruit". Demands the learner repeat the corrected sentence out loud.',
}

// Limites que valem para TODOS os humores. O "bravo" e personagem, nao ataque.
const SAFETY = `
HARD RULES (they override the persona, always):
- The aggression is a comedy bit about LANGUAGE MISTAKES only. Never insult the learner's
  appearance, body, intelligence, family, gender, race, religion, nationality or worth as a person.
- No slurs, no sexual content, no threats, no encouraging self-harm, no cruelty that is not obviously a joke.
- The learner is likely a teenager. Keep it PG-13.
- If the learner seems genuinely upset, hurt, anxious, or asks you to stop, DROP the persona
  immediately, be kind and supportive, and say they can switch your mood in the app.
- Never refuse to teach. Every reply must still move the conversation forward.
`

function systemPrompt({ langName, mood, scenarioTitle, situation, level, userName, weakSpots }) {
  return `You are "Voca", the AI conversation partner inside VOCA IA, a language-learning app made for a Brazilian learner who speaks Portuguese.

TARGET LANGUAGE: ${langName}. The learner is practising ${langName} at roughly ${level} level.
LEARNER NAME: ${userName || 'a learner'}.
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

${weakSpots?.length ? `The learner keeps making these mistakes — bring them up when relevant: ${weakSpots.join('; ')}.` : ''}`
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

async function callClaude({ model, system, messages, tool, maxTokens = 700, apiKey }) {
  const key = apiKey || API_KEY
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 400)}`)
  }
  const data = await res.json()
  const use = (data.content || []).find((c) => c.type === 'tool_use')
  if (!use) throw new Error('resposta sem tool_use')
  return use.input
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, key: !!API_KEY, byok: true, chatModel: CHAT_MODEL, reportModel: REPORT_MODEL })
})

app.post('/api/chat', async (req, res) => {
  const { apiKey } = req.body
  if (!API_KEY && !apiKey) return res.status(503).json({ error: 'sem ANTHROPIC_API_KEY' })
  try {
    const { langName, mood, scenarioTitle, situation, level, userName, history = [], message, weakSpots = [], opening } = req.body
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

    const out = await callClaude({
      apiKey,
      model: CHAT_MODEL,
      system: systemPrompt({ langName, mood, scenarioTitle, situation, level, userName, weakSpots }),
      messages,
      tool: REPLY_TOOL,
    })
    res.json({
      reply: out.reply,
      replyPt: out.reply_pt,
      corrections: out.corrections ?? [],
      roast: out.roast,
      suggestion: out.suggestion,
      score: out.score,
    })
  } catch (e) {
    console.error('[chat]', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/report', async (req, res) => {
  const { apiKey } = req.body
  if (!API_KEY && !apiKey) return res.status(503).json({ error: 'sem ANTHROPIC_API_KEY' })
  try {
    const { langName, turns = [], userName } = req.body
    const transcript = turns
      .map((t) => `${t.role === 'user' ? 'ALUNO' : 'VOCA'}: ${t.text}`)
      .join('\n')
      .slice(-6000)
    const out = await callClaude({
      apiKey,
      model: REPORT_MODEL,
      system: `Voce e um professor de ${langName} avaliando uma conversa de um aluno brasileiro chamado ${userName || 'aluno'}.
Escreva TUDO em portugues do Brasil, direto e sem enrolacao.
- "summary": 2 frases sobre como foi a conversa, honestas mas encorajadoras.
- "strengths": 2 a 3 coisas que a pessoa realmente fez bem (cite exemplos da conversa).
- "fix": os 3 erros mais importantes. "what" = o erro e a regra, em uma frase. "example" = a frase corrigida em ${langName}.
- "nextGoal": uma meta concreta e pequena para a proxima conversa.`,
      messages: [{ role: 'user', content: `Transcricao:\n${transcript}` }],
      tool: REPORT_TOOL,
      maxTokens: 900,
    })
    res.json(out)
  } catch (e) {
    console.error('[report]', e.message)
    res.status(500).json({ error: e.message })
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
  console.log(API_KEY ? `chave carregada · chat: ${CHAT_MODEL}` : 'SEM ANTHROPIC_API_KEY — o app roda em modo offline')
})
