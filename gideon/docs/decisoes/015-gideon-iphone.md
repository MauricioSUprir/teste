# 015 — GIDEON no iPhone pelo app Atalhos (Siri)

**Data:** 10/11/2026 · **Fase:** 8 (Voice OS), parte do celular · **Situação:** aceita

## Contexto
O dono quer falar com a GIDEON pelo celular (iPhone) e que ela faça coisas nele. Orçamento zero e nada para instalar além do que o iPhone já tem.

## Decisão
Um atalho no app **Atalhos** (já vem no iPhone), chamado "GIDEON":
1. "Ditar Texto" ouve o pedido.
2. "Obter Conteúdo da URL" manda `{ texto }` para a rota `gideon/celular`, com o cabeçalho `x-gideon-celular` (chave pedida com `/celular` no Telegram, vale 1 ano).
3. A resposta é `{ fala, abrir? }`: "Falar Texto" lê a `fala`; se vier `abrir`, "Abrir URLs" abre o link.

"E aí Siri, GIDEON" roda o atalho. Dá também para pôr na tela de início ou no Botão de Ação.
Guia passo a passo: `home/celular.html` (publicado em `https://gideon-home.onrender.com/celular.html`).

## Como ela age no iPhone
- Ferramenta `celular_abrir`, que só aparece para o modelo no canal `celular`. O servidor monta o link a partir de tipo + dados (o modelo não escreve URL): ligar (`tel:`), SMS (`sms:`), WhatsApp (`wa.me`), rota (Mapas, Waze ou Google Maps), música (YouTube Music, Spotify ou Apple Music), vídeo (YouTube), pesquisa (Google), site (só https) e apps de uma lista.
- **Ligação e mensagem só abrem preenchidas.** Quem confirma a ligação ou toca em enviar é o dono, no próprio iPhone.
- Pedido do iPhone que é para abrir algo obriga o modelo a chamar uma ferramenta na primeira volta (o modelo leve às vezes só dizia "estou abrindo").
- Links da resposta não dá para ouvir: a resposta completa vai para o Telegram. Ações que pedem OK (apagar, organizar no PC…) mandam Aprovar/Negar no Telegram.
- Mesma memória e mesmas ferramentas dos outros canais (sessão de conversa `celular`).

## Alternativas descartadas
- **App próprio para iPhone:** precisa de conta de desenvolvedor da Apple (paga) ou de Mac para instalar.
- **Arquivo de atalho pronto (.shortcut):** desde o iOS 15 o arquivo precisa ser assinado num Mac; por isso o dono monta o atalho seguindo o guia (uns 10 minutos, uma vez).
- **Ler e mexer dentro dos apps do celular:** o iPhone não permite isso para atalhos de fora; fica fora do escopo.

## Testes (10/11/2026, função v34)
Pelo servidor, com o mesmo formato do atalho: Spotify, Waze, Instagram, WhatsApp, pergunta com fonte (links foram para o Telegram) e hora ✅. Ligação ✅ (v33). Falta: o dono montar o atalho e testar no iPhone.
