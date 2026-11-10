# 014 — GIDEON PC: como a GIDEON mexe no computador do dono

**Data:** 10/11/2026 · **Fase:** 1 (Jarvis Prime) · **Situação:** aceita

## Decisão
Um programa pequeno em **PowerShell** (`agente-local/GIDEON-PC.cmd`), que já vem no Windows: nada para instalar.
O dono dá dois cliques, cola a chave que a GIDEON manda no Telegram (`/pc`) e escolhe a pasta liberada.

## Como funciona
- O programa **só faz pedidos para fora**: pergunta à função `gideon` (rota `pc-buscar`) se há ordem, esperando até 20 s por pedido, e devolve o resultado (`pc-resultado`). Nada no PC fica aberto na internet; não precisa abrir porta nem mexer no roteador.
- A ordem nasce quando o modelo chama uma ferramenta `pc_*`. Ela vai para a tabela `gideon_pc_ordens` e o servidor espera o resultado (até 25 s; comandos e projetos até 50 s).
- Se o programa não deu sinal nos últimos 75 s (`gideon_dispositivos`), a GIDEON responde que o PC está desligado e não faz nada.
- Chave do PC: validade de 1 ano mais assinatura HMAC com o segredo do Vault (igual à do GIDEON Home). No Windows ela fica guardada protegida (DPAPI), legível só pelo usuário dono, naquele PC.

## Regras de segurança (valem no servidor e de novo no programa)
- **Só altera** dentro da pasta liberada (padrão `C:\Users\<dono>\GIDEON`). Fora dela, **só lê** em Documentos, Downloads e Área de Trabalho. Caminhos com `..` e atalhos de pasta (junction/symlink) que levem para fora são recusados.
- **Apagar** move para `.lixeira-gideon` dentro da pasta liberada. Organizar e apagar ficam num diário, e `pc_desfazer` devolve tudo.
- **Pedem OK do dono** (botões Aprovar/Negar no Telegram, Confirmar/Cancelar no GIDEON Home): organizar, apagar, sobrescrever arquivo, instalar (pip/npm install…), `npx` e `git push`.
- **Comandos:** só uma lista (git, python/py, pip, node, npm, npx, dotnet, java, dir, where), com subcomandos permitidos. Não aceita comandos encadeados nem os símbolos `& | ; < > $ % ^` ou crase. Roda sem shell, com tempo limite de 40 s.
- **Scripts e programas soltos** (.exe, .bat, .ps1, .vbs…) não são criados nem abertos. Aplicativos só de uma lista (VS Code, navegadores, explorador, bloco de notas, calculadora, Office, Spotify, terminal). Fechar app pede para fechar normalmente, sem forçar.
- **Registro:** cada mudança vai para `gideon_acoes` (quem `gideon/pc`, com o jeito de desfazer) e para `.gideon-pc.log` na pasta liberada.
- Conteúdo de arquivo é **dado, nunca ordem**.

## Alternativas descartadas
- **Claude Desktop com computer use / UI-TARS:** pagos, ou pesados e com controle total da tela, mais do que a fase precisa. Ficam para a fase de tela (cliques), se for preciso.
- **Servidor MCP local:** exigiria Node ou Python instalados e uma porta aberta, ou um túnel.
- **Python no PC:** o dono teria de instalar o Python antes. O PowerShell já está em todo Windows 10/11.

## Testes (10/11/2026)
Primeiro com um PC simulado; depois com o **programa de verdade** rodando no PowerShell 7 na máquina de testes, contra a GIDEON real.
O pedido "organiza a pasta, apaga os .tmp e prepara um projeto Python" pediu OK para organizar e para apagar e criou o projeto (README, .gitignore, main.py, Git, .venv). Também passaram, no programa de verdade:
- aprovar nas duas ordens;
- procurar e ler;
- escrever e rodar código;
- `git add` e `git commit`;
- desfazer, que limpa as pastas vazias.

Foram recusados: mexer fora da pasta, `rm`, comando encadeado, `python -c`, ler `/etc/passwd` e criar `.bat`.

**Falta testar no Windows do dono:** primeira configuração, chave protegida, atalho de início e abrir/fechar aplicativos. São as partes que só existem no Windows.
