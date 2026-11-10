# GIDEON PC — a GIDEON mexendo no seu computador

Programa pequeno que deixa a GIDEON organizar arquivos, criar projetos, rodar código e abrir aplicativos no seu PC, com segurança.
Decisão e regras completas: `docs/decisoes/014-gideon-pc.md`.

## Instalar (uns 5 minutos, só uma vez)
1. No PC, baixe o programa: https://gideon-home.onrender.com/pc/GIDEON-PC.cmd
   (é o mesmo arquivo desta pasta, `GIDEON-PC.cmd`). Guarde num lugar fixo, por exemplo `Documentos`.
2. Dê dois cliques no arquivo.
   - Se o Windows mostrar "O Windows protegeu o computador": clique em **Mais informações** e depois em **Executar assim mesmo**. Isso aparece porque o arquivo veio da internet e não tem assinatura de empresa.
3. No Telegram, mande **/pc** para a GIDEON. Ela responde com a **chave do PC**. Copie a chave e cole na janela do programa (clique com o botão direito para colar), depois aperte Enter.
4. **Pasta liberada:** aperte Enter para usar `C:\Users\<você>\GIDEON` (recomendado). É a única pasta onde a GIDEON pode criar, mover e apagar.
5. Responda **S** para o GIDEON PC abrir sozinho quando o Windows ligar.
6. Pronto: a janela mostra "G I D E O N   P C — Ligado". Pode minimizar, mas **não feche** (fechar desliga).

## Testar
No Telegram ou por voz no GIDEON Home:
- "O GIDEON PC está ligado?"
- "Lista o que tem na minha pasta GIDEON"
- "Cria um projeto Python chamado teste"
- "Abre o VS Code no projeto teste"
- Coloque uns arquivos bagunçados na pasta GIDEON e peça: "Organiza minha pasta GIDEON por tipo". Ela mostra o plano e espera seu **Aprovar**.

## O que ela pode e não pode
- **Pode:** listar, procurar e ler arquivos (pasta GIDEON, Documentos, Downloads, Área de Trabalho); criar e editar arquivos de texto e código na pasta GIDEON; organizar; preparar projetos (Git e ambiente Python/Node); rodar git, python, node, npm; abrir e fechar aplicativos da lista.
- **Pede seu OK antes:** apagar (vai para a lixeira da GIDEON, `.lixeira-gideon`), organizar, sobrescrever arquivo, instalar pacotes, `git push`.
- **Não pode:** mexer fora da pasta GIDEON, rodar comandos fora da lista, criar ou abrir programas e scripts (.exe, .bat, .ps1…).
- **Desfazer:** "desfaz a última organização" devolve tudo para onde estava.

## Problemas comuns
- **"O GIDEON PC não está ligado":** a janela do programa foi fechada ou o PC dormiu. Abra o `GIDEON-PC.cmd` de novo.
- **Chave errada ou vencida:** mande /pc no Telegram, apague o arquivo `.gideon-pc.json` da sua pasta de usuário (`C:\Users\<você>`) e abra o programa de novo.
- **Trocar a pasta liberada:** apague `.gideon-pc.json` e abra o programa de novo.
- **Desligar de vez:** feche a janela e apague o atalho "GIDEON PC" em `shell:startup` (Win+R, digite `shell:startup`, Enter).
- O que ela fez fica anotado em `C:\Users\<você>\GIDEON\.gideon-pc.log`.

## Para quem mexe no código
- `GIDEON-PC.cmd`: arquivo único. A parte de cima é um `.cmd` que chama o PowerShell, e o resto é o programa (compatível com Windows PowerShell 5.1 e PowerShell 7). Precisa de finais de linha CRLF e UTF-8 sem BOM.
- `../home/pc/GIDEON-PC.cmd` é uma **cópia** para download pelo site do GIDEON Home. Ao alterar o programa, copie de novo.
- Teste fora do Windows: `GIDEON_PC_CHAVE`, `GIDEON_PC_PASTA` e `GIDEON_PC_LEITURA` como variáveis de ambiente, e `pwsh -Command 'iex ([IO.File]::ReadAllText("GIDEON-PC.cmd"))'`.
- Ferramentas e rotas do servidor: `supabase/functions/gideon/pc.ts`. Fila: migração `011_pc.sql`.
