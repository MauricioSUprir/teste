# 010 — n8n grátis no Hugging Face Spaces, com o banco no Supabase

- **Data:** 06/11/2026 · **Situação:** aprovada pelo dono ("mover para grátis"); migração preparada, falta o token de escrita do Hugging Face.
- **Contexto:** orçamento zero (decisão 009). O Railway custa ~US$ 5/mês depois do crédito de teste. O Render grátis não comporta: a conta já tem 8 serviços dividindo 750 h/mês e só 512 MB de RAM.
- **Decisão:** n8n no Hugging Face Spaces (Docker, grátis, 2 vCPU e 16 GB de RAM), Space `Gui210113/gideon-n8n`, com os dados internos do n8n no Supabase `gideon` (esquema `n8n`, usuário `gideon_n8n`). Arquivos em `infra/hf-space/`.
- **Cuidados:**
  - O Space dorme após 48 h sem visitas → o uso diário do Telegram mantém acordado; `keepalive.yml` (GitHub Actions, grátis) abre o endereço a cada 6 h.
  - Disco apagado a cada reinício → nada fica no disco; tudo no Supabase.
  - Precisa ser público para receber o Telegram; só a tela de login do n8n aparece.
  - Banco grátis do Supabase tem 500 MB → execuções antigas são apagadas após 14 dias.
- **Plano de troca:** subir o Space → criar conta de dono → API key (formulário seguro) → credenciais → importar workflows (`n8n/README.md`) → ligar o canal novo (o Telegram passa a entregar no Space) → desligar e apagar o projeto do Railway.
