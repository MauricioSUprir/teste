# CASO DANTÈS: ARQUIVO REABERTO 🔍

Jogo web de detetive em modo quiosque para tablet — sarau literário escolar
(*E se Edmond Dantès vivesse em 2026?* — O Conde de Monte Cristo, A. Dumas).
Sessões de 3–6 min: 6 mini-games de evidências, interrogatório com IA (ou
roteirizado offline), acusação final, ranking do dia e certificado.

## Instalar e rodar

```bash
npm install
npm run dev          # abre em http://localhost:5173 (acessivel na rede local)
```

Build de produção:

```bash
npm run build
npm run preview      # serve o build em http://<ip-do-computador>:4173
```

## Modo online (interrogatório com IA)

1. Copie `.env.example` para `.env` e coloque sua `ANTHROPIC_API_KEY`.
2. Rode o proxy junto com o front:

```bash
npm run server       # proxy Anthropic em http://localhost:8787
npm run dev          # o Vite encaminha /api -> 8787
```

A chave **nunca** vai ao navegador — só o servidor `server/index.js` a usa.

## Modo offline (obrigatório para a quadra sem internet)

O jogo inteiro funciona **sem rede**: se a API falhar, os suspeitos respondem
por árvores de diálogo roteirizadas (as contradições continuam detectáveis).
Para forçar sempre offline: use o toggle no `/admin`, ou rode com
`VITE_OFFLINE=true npm run build`.

## QR code de entrada 📱

- A **tela de atração** e o **certificado** mostram um QR code que aponta para
  o próprio jogo com `?entrada=qr`.
- Quando alguém escaneia e abre o link, o jogo **detecta e registra a entrada**:
  banner "ENTRADA VIA QR CODE REGISTRADA ✓", marcação 📱 na sessão, no HUD, no
  ranking e no certificado.
- O total de entradas via QR (hoje/total/última) aparece no painel `/admin`,
  onde também dá para zerar o contador.
- Importante: abra o jogo pelo **IP da rede local** (ex.:
  `http://192.168.0.10:4173`) para o QR funcionar nos celulares dos visitantes
  (que precisam estar no mesmo Wi-Fi).

## Modo quiosque no tablet

1. No computador do estande: `npm run build && npm run preview` (anote o IP).
2. No tablet, abra `http://<ip>:4173` no Chrome (Android) ou Safari (iPad).
3. Instale como PWA: menu → "Adicionar à tela inicial" → abra pelo ícone
   (tela cheia, sem barra do navegador).
4. Admin: rota `#/admin`, **5 toques rápidos no canto superior esquerdo** da
   tela de atração, ou `Ctrl+Shift+A`. PIN: **1815**.
   No admin: zerar ranking, online/offline, tempo (4/6/8 min), sons, voz e
   estatísticas do QR.

## Regras do quiosque

- 90 s de inatividade em qualquer tela → volta sozinho ao modo de atração.
- Sons gerados por WebAudio (sem arquivos), botão de mudo no HUD.
- Vozes dos suspeitos via `speechSynthesis` pt-BR (toggle no admin).
- Ranking TOP 10 do dia fica em `localStorage` do próprio tablet.
