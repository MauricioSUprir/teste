# 007 — n8n self-hosted no Railway

- **Data:** 06/11/2026
- **Contexto:** a instância do n8n Cloud (`mauriciosrn8n.app.n8n.cloud`) não existe mais ("No instance here"). Os workflows antigos não puderam ser exportados. O dono confirmou que não há outra conta com a instância.
- **Decisão:** rodar o n8n próprio (self-hosted) no Railway, projeto `gideon-n8n`, usando o modelo `MRazvG`:
  - imagem oficial `n8nio/n8n`;
  - Postgres com volume persistente, acessado pela rede privada do Railway;
  - `N8N_ENCRYPTION_KEY` gerada na implantação (guardada só nas variáveis do Railway);
  - `WEBHOOK_URL` apontando para o domínio público do serviço.
- **Alternativas descartadas:** novo teste do n8n Cloud (expira de novo em 14 dias); Render grátis (dorme sem tráfego, ruim para Telegram e agendamentos); modelo n8n mais popular do Railway (usa repositório de terceiros e expõe o banco publicamente).
- **Custo:** plano Hobby do Railway (US$ 5/mês com US$ 5 de uso incluso); estimativa de US$ 5 a 10/mês para uso leve.
- **Consequências:**
  - Os workflows do GIDEON precisam ser reconstruídos.
  - Backup obrigatório: export dos workflows em `n8n/workflows/` + a `N8N_ENCRYPTION_KEY` guardada fora do Git (sem ela as credenciais salvas não podem ser lidas).
  - Atualizar o n8n = redeploy do serviço; ler as notas de versão antes de versões grandes.
  - A conta do Railway é a do e-mail `gui.drodrigues21@gmail.com` (confirmada pelo dono).
