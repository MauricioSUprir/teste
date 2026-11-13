# 026 — Thought Map (módulo 72)

**Data:** 13/11/2026 · **Situação:** aceita, no ar no GIDEON Core

## Decisão
- **O que é:** você escreve um problema ou objetivo, e a IA monta um **mapa de pensamento**. O objetivo fica no centro, com 4 a 7 ramos ("partes"). Cada ramo tem filhos de cinco tipos: parte, **hipótese** (algo a testar), **alternativa** (outro caminho), **risco** (o que pode dar errado) e **dependência** (o que precisa vir antes).
- **Em cada item dá para:**
  - **Expandir com IA:** 3 a 5 filhos novos, sem repetir os que já existem;
  - **Virar tarefa:** cria uma tarefa de verdade em `gideon_tarefas`, que aparece no Telegram, no Nexus e no centro de comando; o item ganha um ✓;
  - **Renomear**;
  - **Apagar**, junto com o que está abaixo.
- **Onde fica:**
  - **Tela:** GIDEON Core, botão **🧭 Mapa** (tecla 5) ou "🧭 Thought Map" no GIDEON Lab. O código está em `home/core-mapa.js`. Arrastar move, rolar ou pinça aproxima, "Centralizar" enquadra, "Meus mapas" lista os guardados.
  - **Servidor:** função `nexus` (rotas `mapas`, `mapa`, `mapa-criar`, `mapa-expandir`, `mapa-salvar`, `mapa-tarefa`, `mapa-apagar`), que chama o Gemini direto, primeiro o modelo forte e depois os leves.
  - **Banco:** tabela `gideon_mapas` (migração 019); os itens ficam guardados em JSON.
- **Limites:**
  - até 120 itens por mapa;
  - títulos curtos;
  - a IA não inventa números, preços nem produtos, porque o mapa é para pensar, não uma pesquisa;
  - cada criação e expansão fica no registro de execuções (`ferramenta = mapa`).
- **Cores:** as do tema 1.1, sem roxo (objetivo em azul, parte em ciano, hipótese em azul, alternativa em verde-água, risco em âmbar, dependência em cinza-azulado).

## Testes (13/11/2026)
- **De verdade (função `nexus` v4, commit `3eb0714`):**
  - "criar um computador com IA própria em casa" virou um mapa de 21 itens em 5 ramos (hardware, modelo de IA, software, privacidade, interface), com riscos, alternativas e dependências;
  - expandir "Escolha do Modelo de IA" trouxe 4 itens novos (por exemplo, "Uso de modelos destilados menores" e "Gargalo de largura de banda da memória").
- **Navegador de testes** (computador 1366×800 e celular 390×844, com respostas de exemplo):
  - criar, expandir, virar tarefa (✓), apagar o ramo com os filhos e fechar com Esc funcionaram;
  - nenhum erro e nenhuma rolagem para o lado.
