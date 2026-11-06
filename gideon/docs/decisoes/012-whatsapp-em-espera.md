# 012 — WhatsApp em espera (controle parental)

- **Data:** 06/11/2026
- **Contexto:** o número do dono tem o controle parental do WhatsApp ativo. Nessas contas o WhatsApp não permite conectar aparelhos ("No momento, não é possível conectar outros dispositivos a contas com controle parental"), e o WAHA funciona como aparelho conectado.
- **Decisão do dono:** ficar sem WhatsApp por enquanto; o Telegram é o canal principal.
- **Situação técnica:** código pronto e publicado (`supabase/functions/gideon/whatsapp.ts`, rotas `whatsapp` e `configurar-whatsapp`, ferramenta `whatsapp_enviar` com confirmação). Sessão do WAHA parada; sem agendador acordando o Render.
- **Para retomar:** responsável desliga o controle parental, ou um número separado com permissão do dono do número e do responsável (cadastrar `gideon_config.whatsapp_dono`). Depois: rota `configurar-whatsapp` com o número → código de 8 letras → "Conectar com número de telefone".
- **Regra:** o GIDEON não tenta contornar o controle parental.
