# 011 — O Núcleo do GIDEON sai do n8n e vai para o Supabase

- **Data:** 06/11/2026 · **Situação:** aprovada pelo dono ("trocamos pro supabase agora").
- **Contexto:** orçamento zero. O n8n usa 340–570 MB parado; nenhum servidor grátis simples aguenta (Render 512 MB, Hugging Face exige PRO, Railway ~US$ 5/mês, Oracle dá trabalho).
- **Decisão:** o GIDEON roda como **uma Edge Function** (`supabase/functions/gideon/`), com rotas `telegram`, `nucleo`, `lembretes`, `relatorio`, `registrar` e `status`. Lembretes e relatório são chamados pelo **pg_cron**. Banco, memória e configuração continuam no Supabase.
- **Segurança:**
  - chaves do Gemini e do Telegram só nos segredos das Edge Functions (o dono cadastra no painel);
  - o segredo do agendador é gerado no banco e fica no Vault;
  - o webhook do Telegram é conferido por um segredo derivado do token;
  - só o ID do dono é atendido.
- **Melhorias sobre o n8n:**
  - memória curta persistente (`gideon_mensagens`);
  - tokens registrados por pedido;
  - nunca envia mensagem vazia;
  - ferramentas `guardar_nota` e `buscar_memoria`;
  - data no fim do prompt, para o Gemini reaproveitar a parte fixa.
- **Custo:** grátis (500 mil chamadas por mês no plano grátis; o GIDEON usa ~45 mil, quase todas do agendador).
- **n8n:** fica no Railway como reserva até o crédito de teste acabar; depois é desligado.
