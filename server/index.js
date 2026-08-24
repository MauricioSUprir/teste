// Servidor proxy opcional para a API da Anthropic.
// A chave fica SOMENTE aqui (lida de .env) e nunca vai ao front-end.
import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8787
const API_KEY = process.env.ANTHROPIC_API_KEY

app.post('/api/interrogar', async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY nao configurada' })
  }
  const { system, messages } = req.body || {}
  if (!system || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'payload invalido' })
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 300,
        system,
        messages,
      }),
    })
    if (!r.ok) {
      const detail = await r.text()
      return res.status(502).json({ error: 'falha na API', detail })
    }
    const data = await r.json()
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
    res.json({ text })
  } catch (err) {
    res.status(502).json({ error: 'falha de rede', detail: String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`[caso-dantes] proxy Anthropic ouvindo em http://localhost:${PORT}`)
})
