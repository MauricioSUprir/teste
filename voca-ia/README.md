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

### 4. O que faz voltar todo dia
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

## Estrutura
```
src/content/     currículos dos 10 idiomas, humores, cenários, clipes de vídeo
src/lib/         voz, gerador de exercícios, revisão espaçada, comparação de respostas
src/screens/     onboarding, home, lição, conversa, perfil
src/components/  Voca.tsx (o bonequinho animado), ClipCard
server/index.js  proxy da Anthropic + prompts + regras de segurança
```
