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
    chat: 'gemini-2.5-flash',
    report: 'gemini-2.5-flash',
  },
  groq: {
    label: 'Groq',
    kind: 'openai',
    base: 'https://api.groq.com/openai/v1',
    chat: 'llama-3.3-70b-versatile',
    report: 'llama-3.3-70b-versatile',
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

// Configuracao do servidor (opcional): se existir, vale para todo mundo que
// abrir o app, sem ninguem precisar colar chave nenhuma.
const SERVER_PROVIDER = process.env.VOCA_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : '')
const SERVER_KEY = process.env.VOCA_API_KEY || process.env.ANTHROPIC_API_KEY || ''
const CHAT_MODEL = process.env.VOCA_CHAT_MODEL || ''
const REPORT_MODEL = process.env.VOCA_REPORT_MODEL || ''

/** Decide qual provedor/chave/modelo usar nesta requisicao. */
function resolveAi(body, task) {
  const id = (body?.provider || SERVER_PROVIDER || '').trim()
  const p = PROVIDERS[id]
  if (!p) return null
  const key = (body?.apiKey || (id === SERVER_PROVIDER ? SERVER_KEY : '')).trim()
  // Ollama roda local e nao pede chave
  if (!key && p.kind !== 'openai') return null
  if (!key && id !== 'ollama') return null
  const model =
    (body?.model || '').trim() ||
    (id === SERVER_PROVIDER ? (task === 'report' ? REPORT_MODEL : CHAT_MODEL) : '') ||
    (task === 'report' ? p.report : p.chat)
  return { id, provider: p, key, model }
}

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

async function callAi({ ai, system, messages, tool, maxTokens = 700 }) {
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
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature: 0.9 },
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

const HINT_TOOL = {
  name: 'dica',
  description: 'Da uma pista sem entregar a resposta.',
  input_schema: {
    type: 'object',
    properties: { hint: { type: 'string' } },
    required: ['hint'],
  },
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    // true = o servidor ja tem chave propria e ninguem precisa colar nada
    key: !!(SERVER_PROVIDER && (SERVER_KEY || SERVER_PROVIDER === 'ollama')),
    serverProvider: SERVER_PROVIDER || null,
    byok: true,
    providers: Object.fromEntries(
      Object.entries(PROVIDERS).map(([id, p]) => [id, { label: p.label, chat: p.chat }]),
    ),
  })
})

app.post('/api/chat', async (req, res) => {
  const ai = resolveAi(req.body, 'chat')
  if (!ai) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
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

    const out = await callAi({
      ai,
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
  const ai = resolveAi(req.body, 'report')
  if (!ai) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { langName, turns = [], userName } = req.body
    const transcript = turns
      .map((t) => `${t.role === 'user' ? 'ALUNO' : 'VOCA'}: ${t.text}`)
      .join('\n')
      .slice(-6000)
    const out = await callAi({
      ai,
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


// ------------------------------------------------- correcao explicada pela IA
app.post('/api/explain', async (req, res) => {
  const ai = resolveAi(req.body, 'chat')
  if (!ai) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { langName, prompt, correct, given, lessonTitle, grammar, level, mood } = req.body
    const out = await callAi({
      ai,
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
      maxTokens: 800,
    })
    res.json(out)
  } catch (e) {
    console.error('[explain]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ----------------------------------------- chat de duvidas dentro da explicacao
app.post('/api/ask', async (req, res) => {
  const ai = resolveAi(req.body, 'chat')
  if (!ai) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { langName, question, context = {}, history = [], level } = req.body
    const messages = history
      .slice(-8)
      .map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text }))
      .filter((m) => m.content?.trim())
    messages.push({ role: 'user', content: question })
    if (messages[0]?.role !== 'user') messages.shift()
    const out = await callAi({
      ai,
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
      maxTokens: 500,
    })
    res.json(out)
  } catch (e) {
    console.error('[ask]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// --------------------------------------------- dica durante a questao (sem entregar)
app.post('/api/hint', async (req, res) => {
  const ai = resolveAi(req.body, 'chat')
  if (!ai) return res.status(503).json({ error: 'nenhum provedor de IA configurado' })
  try {
    const { langName, prompt, correct, given, level, strength } = req.body
    const out = await callAi({
      ai,
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
      maxTokens: 250,
    })
    res.json(out)
  } catch (e) {
    console.error('[hint]', e.message)
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
  console.log(
    SERVER_PROVIDER
      ? `provedor do servidor: ${SERVER_PROVIDER}${SERVER_KEY ? ' (com chave)' : ''}`
      : 'sem provedor no servidor — cada pessoa liga a IA no proprio app, ou fica no modo offline',
  )
})
