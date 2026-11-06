# 009 — Escopo completo (os 9 projetos) e orçamento zero por enquanto

- **Data:** 06/11/2026
- **Decisão do dono:**
  1. **Todos os 9 projetos** do roadmap serão feitos (Universal Memory, Deep Research, Jarvis Prime, Screen Intelligence, Voice OS, Neural Core, AI Company, Self-Improving, Nexus OS), e no final tudo fica junto e conectado no GIDEON.
  2. **Orçamento de API: zero por enquanto.** Usar só planos grátis (Gemini free tier, Supabase free, ferramentas open source). Qualquer coisa paga precisa de OK explícito antes.
  3. **Memória (Fase 1): Supabase** (plano grátis, pgvector).
- **Como:** a ordem das fases do roadmap continua valendo; uma fase por vez, cada uma com critério de pronto, e todas ligadas ao orquestrador (n8n) desde o início.
- **Consequências:**
  - Modelos pagos (Claude, ElevenLabs, SerpApi) ficam de fora até haver orçamento; alternativas grátis: Gemini free tier, voz local (whisper.cpp + Kokoro), busca grátis.
  - O Railway (n8n) não é grátis: o período de teste acaba e depois custa ~US$ 5/mês. Precisa de decisão do dono (ver changelog de 06/11).
  - O plano grátis do Supabase permite só 2 projetos ativos, e já existem 2 (`lojas-dados` e `sinapse`).
