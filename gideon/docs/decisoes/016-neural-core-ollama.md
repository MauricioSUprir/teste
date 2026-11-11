# 016 — Neural Core: IA local no PC do dono (Ollama)

**Data:** 11/11/2026 · **Fase:** 2 (Neural Core) · **Situação:** aceita (falta o dono instalar e testar)

## Decisão
- **Ollama** no PC do dono (grátis, Windows): roda modelos de IA no próprio computador e já vem com uma janela de chat (o "chat próprio" da fase 2.1, sem precisar do Open WebUI).
- O **GIDEON PC 2.3** conversa com o Ollama em `http://127.0.0.1:11434` (só dentro do PC) e informa à GIDEON a memória, as placas de vídeo, o disco livre e os modelos baixados (para escolher o modelo que cabe).
- **Modo privado no Telegram:** mensagem que começa com `privado:` não passa pelo núcleo nem pelo Google: vai direto para o Ollama do PC (ação `pc_ia_local`), a resposta volta ao Telegram com a marca 🔒, nada vai para a memória nem para o histórico, a ordem é limpa do banco e o registro (`gideon_execucoes`) guarda só "(pedido privado)" e `modelo = local:<nome>`.
- Ferramenta `pc_ia_local` também para quando o dono pedir "pergunta pra IA do meu PC" numa conversa normal (aí a pergunta já passou pelo modelo da conversa; para sigilo, usar `privado:`).
- **Sigilo total** (nem Telegram nem Supabase): a janela de chat do próprio Ollama, no PC.

## Qual modelo
| PC | Modelo sugerido | Tamanho |
|---|---|---|
| até 8 GB de memória, sem placa de vídeo boa | `qwen3:1.7b` | ~1,4 GB |
| 16 GB de memória ou placa com 4–6 GB | `qwen3:4b` | ~2,6 GB |
| placa de vídeo com 8 GB ou mais | `qwen3:8b` | ~5,2 GB |
| placa com 12 GB ou mais | `qwen3:14b` ou `gemma3:12b` | ~8–9 GB |
O GIDEON PC 2.3 manda esses dados sozinho; a GIDEON/Claude confirma a escolha.

## Alternativas descartadas
- **Open WebUI:** precisa de Docker ou Python com muitos pacotes; o chat do Ollama já atende.
- **LM Studio:** bom, mas o Ollama tem API simples e é o mais usado.

## Testes (11/11/2026)
Na máquina de testes, com um Ollama simulado: o GIDEON PC lista os modelos, pula o modelo de "embed", tira o raciocínio `<think>` da resposta e recusa com mensagem clara quando o Ollama está fechado. Falta: o dono instalar o Ollama e testar `privado:` de verdade.
