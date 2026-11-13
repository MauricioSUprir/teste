# 025 — Tema da parte escrita da GIDEON (a partir dos modelos do dono)

**Data:** 13/11/2026 · **Situação:** aceita; aplicado no GIDEON Core

## Decisão
- O dono mandou dois modelos de apresentação (azul-violeta escuro e preto com azul elétrico) para servirem de modelo para a parte escrita da área da GIDEON.
- **O tema virou um JSON:** `home/tema/gideon-tema.json`. É a fonte da verdade e tem:
  - cores;
  - brilhos;
  - letras: Montserrat nos títulos e números, Inter no texto;
  - os elementos: barrinha lilás, título em MAIÚSCULAS com uma palavra em itálico, cartões de vidro, números grandes com degradê, passos 01/02/03 só com contorno, etiquetas, botão em degradê, pílula de situação, rodapé;
  - as regras de uso.
- **Em CSS:** `home/tema/gideon-tema.css` (classes `g-*`), para qualquer página usar.
- **Só o estilo.** Imagens, objetos 3D cromados e textos dos modelos não foram copiados. Números continuam sendo só dados reais.
- **Primeiro lugar aplicado:** os painéis do GIDEON Core (`home/core.html`).
  - O centro de comando virou cartões com número grande, como nos modelos.
  - O plano de uma missão nova aparece em passos 01, 02, 03.

## Próximos
- Aplicar o mesmo tema no Nexus OS, no painel da equipe e na tela de voz, um de cada vez, conferindo cada um.

## Testes (13/11/2026)
- Navegador de testes, no computador (1366×800) e no celular (390×844). Funcionaram:
  - os quatro painéis;
  - a missão nova (plano em passos → aprovar);
  - a conversa;
  - a busca na memória.
- Nenhum erro e nenhuma rolagem para o lado.

## Atualização 1.1 (13/11/2026): sem roxo
- O dono achou roxo demais. Agora o tema é **preto, azul elétrico e ciano**, como no segundo modelo. Verde e amarelo ficam só para mostrar situação (ok e atenção).
- Mudou nos dois arquivos: `gideon-tema.json` (versão 1.1, com a regra "sem roxo nem violeta") e `gideon-tema.css`.

