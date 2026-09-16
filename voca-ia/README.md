# VOCA IA 🗣️

App de idiomas no estilo Duolingo, mas com a parte que a gente queria de verdade:
uma **conversa contínua por voz com uma IA que muda de humor** — do gentil ao
"sem paciência nenhuma".

**10 idiomas:** 🇬🇧 Inglês · 🇪🇸 Espanhol · 🇫🇷 Francês · 🇮🇹 Italiano · 🇩🇪 Alemão ·
🇯🇵 Japonês · 🇰🇷 Coreano · 🇨🇳 Mandarim · 🇷🇺 Russo · 🇸🇦 Árabe

---

## O que tem dentro

### 1. Conversa contínua (a parte principal)
- Você fala no microfone → ele transcreve → a IA responde → **o Voca fala em voz alta**
  → o microfone volta a escutar sozinho. Sem apertar botão a cada frase.
- **Um bonequinho animado** no lugar do círculo de ondas: ele pisca, respira, inclina a
  cabeça quando escuta, mexe a boca quando fala e muda de cara conforme o humor.
- **6 humores, trocáveis no meio da conversa** (é só tocar no chip):
  🥰 Gentil · 🙂 Professor · 😏 Sarcástico · 😤 Brutal · 🎭 Dramático · 🪖 Sargento.
- 10 cenários: café, aeroporto, entrevista de emprego, médico, compras, festa,
  vizinho barulhento, táxi, fofoca de série, papo livre.
- Cada resposta traz **correções na hora** (o que você errou → o certo → a regra),
  uma sugestão do que dizer em seguida e uma provocação no tom do humor escolhido.
- No fim: **relatório da conversa** (o que foi bem, os 3 erros que mais importam,
  meta para a próxima) e **os seus erros viram cartões de revisão**.

> Os humores bravos são piada: o Voca implica com o **erro**, nunca com a pessoa.
> Nada de ofensa a aparência, família, inteligência ou identidade — e se a pessoa
> ficar chateada ou pedir, ele sai do personagem na hora.

### 2. Curso completo
- **Inglês:** 6 unidades / 24 lições (A1 → B1).
  Outros 9 idiomas: 3 unidades / 9 lições cada (A1 → A2).
- 8 tipos de exercício: traduzir nos dois sentidos, escutar e escrever, montar a
  frase com blocos, múltipla escolha, completar lacuna, ligar pares e **falar em
  voz alta** (o app ouve e corrige).
- Os exercícios são **gerados a partir das frases**, então a lição nunca cai igual
  duas vezes.
- Japonês, coreano, mandarim, russo e árabe mostram o alfabeto original **e aceitam
  a resposta em romaji / pinyin / transliteração** (com ou sem acento de tom).

### 3. Vídeos didáticos na correção 🎬
Quando você erra, aparece uma cena real de **filme, série ou desenho** com a mesma
estrutura — Terminator para `I'll be back`, Frozen para `let it go`, Encanto para o
"se" impessoal, Ghibli para o `いただきます`, Masha e o Urso para o russo, e por aí.
Cada clipe tem **"o que observar"** (a regra, não só a curiosidade), um link para a
cena e um link para ouvir **aquela frase exata** sendo falada em dezenas de vídeos reais.

### 4. Correção que ensina 🧠
- **Dicas na hora da questão:** uma dica local de graça (quantas palavras, a regra
  da lição) e o **"pedir ajuda ao Voca"**, que dá uma pista de verdade sem nunca
  entregar a resposta. Pedir ajuda custa XP — de propósito.
- **Explicaçãozinha do erro:** a IA explica o que deu errado, a regra em duas
  frases, 3 exemplos com áudio e um macete pra não errar de novo.
- **Chat de dúvidas dentro da explicação:** dá pra continuar perguntando ali
  mesmo ("por que não pode ser do outro jeito?", "como fica no passado?") e ele
  responde preso ao contexto daquela questão.
- Sem IA ligada, os dois viram versão simples (dica local e explicação montada
  com o material do curso) — nunca fica mudo.

### 5. Nível e dificuldade
- **Teste de nivelamento** de ~15 questões que sobe de nível e para quando você
  trava; no fim define seu nível (A1→B2), sugere a dificuldade e **abre as lições
  do seu nível** em vez de te fazer repetir "oi, tudo bem".
- **3 dificuldades:** Leve (escolher e montar, perdoa typo), Normal (mistura tudo)
  e Pesado (escrever do zero e falar, sem perdão, mais XP).

### 6. Conta e progresso na nuvem
Criar conta com e-mail guarda XP, ofensiva, lições e revisões no servidor
(Supabase). Trocou de celular, continua de onde parou. **Sem conta o app funciona
igual**, só fica preso ao navegador. O merge é sempre a favor de quem tem mais
progresso: ninguém perde ofensiva por ter entrado em outro aparelho.

### 7. Voz natural (ElevenLabs)
A voz do navegador é robótica. Com uma chave do ElevenLabs no servidor, a fala
em português (a bronca e a tradução) passa a vir de uma voz de verdade, com o
tom ajustado pelo humor: quanto mais bravo, menos estável e mais teatral.

```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=SOYHLrjzK2X1ezoPC6cr   # opcional (padrão: Harry, bem intenso)
ELEVENLABS_MODEL=eleven_flash_v2_5         # opcional (o mais barato e rápido)
```

**Cache dos dois lados**, porque crédito de voz acaba: o servidor guarda o áudio
de cada frase já gerada e o navegador guarda o da sessão. As falas fixas das
lições (o banco de broncas em `content/moods.ts`) são geradas **uma vez cada** e
depois saem de graça para sempre. Sem chave, sem crédito ou com erro, cai
sozinho na voz do navegador — nunca fica mudo.

### 8. Limite diário das IAs
Os planos grátis têm cota por dia. Quando **as duas** IAs recusam, o app não dá
erro seco: mostra um aviso explicando que acabou por hoje, quanto falta para
virar o dia, e o que continua funcionando (lições, revisão, vídeos, modo
offline). Uma faixa discreta fica na home até a virada. Detecção por HTTP 429 e
pelas mensagens de cota de cada serviço.

### 9. VOCA PRO — pagamento por Pix
Três planos, **só Pix**, sem gateway no meio (o dinheiro cai direto na conta):

| Plano | Preço | Sai por |
|---|---|---|
| Mensal | R$ 14,90 | R$ 14,90/mês |
| 3 meses | R$ 37,90 | R$ 12,63/mês — economiza 15% |
| 1 ano | R$ 119,90 | R$ 9,99/mês — economiza 33% |

O app gera o **Pix copia-e-cola e o QR** na hora (BR Code EMV montado em
`src/lib/pix.ts`, com CRC16 validado contra o vetor padrão). Cada cobrança leva
um identificador único (`VOCAANU7K2Q`), que é como você encontra o pagamento.

Fluxo: escolhe o plano → paga no banco → toca em "já paguei" → o app registra em
`payments` com status `aguardando`. Quando o Pix cair, você confirma:

```sql
select public.aprovar_pagamento('VOCAANU7K2Q');
```

Isso marca o pagamento e libera o PRO na conta, somando o tempo em cima do que
ainda restava. O app **nunca** consegue se promover: um trigger no banco recusa
qualquer mudança de plano vinda de requisição autenticada do app.

Configure a sua conta Pix no build:

```bash
VITE_PIX_KEY=sua-chave-pix
VITE_PIX_NAME="NOME COMO ESTA NO BANCO"
VITE_PIX_CITY="SUA CIDADE"
VITE_PAYWALL=on     # só quando quiser de fato travar as funções de IA
```

Enquanto `VITE_PAYWALL` não for `on`, **tudo fica liberado** e a página de planos
serve só para quem quiser apoiar.

### 10. O que faz voltar todo dia
Ofensiva 🔥 (com 1 congelamento), 5 vidas que voltam sozinhas, XP e níveis, meta
diária, 12 conquistas, e **revisão espaçada** (SM-2): cada frase volta no dia em que
você está prestes a esquecê-la.

---

## Rodar

```bash
cd voca-ia
npm install
npm run dev          # http://localhost:5173
```

### Modo com IA de verdade (recomendado)

```bash
cp .env.example .env     # coloque sua ANTHROPIC_API_KEY
npm run server           # servidor em :8787 — a chave fica SÓ aqui
npm run dev              # o Vite encaminha /api -> 8787
```

A chave **nunca** chega no navegador. Dá para trocar os modelos por variável:
`VOCA_CHAT_MODEL` (padrão rápido, para a conversa) e `VOCA_REPORT_MODEL`
(padrão mais forte, para o relatório final).

### Modo offline
Sem chave (ou sem internet) **o app inteiro continua funcionando**: as lições, a
revisão e os vídeos são locais, e a conversa vira um interrogatório em que o Voca
puxa perguntas do próprio curso e corrige por regras os erros clássicos de brasileiro
("I have 15 years", "people is", "estoy estudiante", "je suis 16 ans"…).

### Publicar

```bash
npm run build
npm run server       # serve o dist/ e a API na mesma porta
```

## Compatibilidade
- **Voz (falar e ouvir): Chrome ou Edge**, no computador ou no Android.
  No Firefox e no Safari a conversa funciona **digitando** (o resto é igual).
- Tudo (progresso, XP, revisões) fica salvo só no navegador do aparelho.
  O áudio nunca sai do aparelho — quem transcreve é o próprio navegador.

## Banco de dados (contas)
```bash
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_KEY=<publishable key>
```
Tabela `progress` (um registro por pessoa) com RLS: cada conta só enxerga a
própria linha.

## Estrutura
```
src/content/     currículos dos 10 idiomas, humores, cenários, clipes de vídeo
src/lib/         voz, gerador de exercícios, revisão espaçada, comparação de respostas
src/screens/     onboarding, nivelamento, home, lição, conversa, conta, assinatura, perfil
src/components/  Voca.tsx (o bonequinho animado), ClipCard, ExplainPanel, HintBar
src/lib/plan.ts  o que é grátis, o que será pago e como ligar a cobrança
server/index.js  proxy da Anthropic + prompts + regras de segurança
```
