# GIDEON PC — a GIDEON mexendo no seu computador

Programa pequeno que deixa a GIDEON organizar arquivos, criar projetos, rodar código e abrir aplicativos no seu PC, com segurança.
Decisão e regras completas: `docs/decisoes/014-gideon-pc.md`.

## Instalar (uns 5 minutos, só uma vez)
0. Instale o **Python** (grátis): Microsoft Store → procure **Python 3.13** (Python Software Foundation) → **Obter**.
1. No PC, baixe o programa: https://gideon-home.onrender.com/pc/gideon_pc.py
   (é o mesmo arquivo desta pasta, `gideon_pc.py`). Se o navegador avisar, escolha **Manter**. Guarde num lugar fixo, por exemplo `Documentos`.
2. Dê **dois cliques** no arquivo (se o Windows perguntar com o que abrir, escolha **Python**). Outra forma: no Prompt de Comando, `python "%USERPROFILE%\Documents\gideon_pc.py"`.
   Na primeira vez ele instala sozinho a peça do print da tela (Pillow), uns segundos.
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
- Com um erro aberto na tela, pergunte: "Que erro é esse na minha tela?". A janela do programa avisa que ela está vendo a tela.

## O que ela pode e não pode
- **Pode:** listar, procurar e ler arquivos (pasta GIDEON, Documentos, Downloads, Área de Trabalho); criar e editar arquivos de texto e código na pasta GIDEON; organizar; preparar projetos (Git e ambiente Python/Node); rodar git, python, node, npm; abrir e fechar aplicativos da lista.
- **Pede seu OK antes:** apagar (vai para a lixeira da GIDEON, `.lixeira-gideon`), organizar, sobrescrever arquivo, instalar pacotes, `git push`.
- **Não pode:** mexer fora da pasta GIDEON, rodar comandos fora da lista, criar ou abrir programas e scripts (.exe, .bat, .ps1…).
- **Desfazer:** "desfaz a última organização" devolve tudo para onde estava.
- **Tela:** ela só tira print quando você pede, avisa na janela e não guarda a imagem. Antes de pedir, feche ou minimize janelas de banco e de senhas (o print vai para a IA do Google analisar).

## Problemas comuns
- **"O GIDEON PC não está ligado":** a janela do programa foi fechada ou o PC dormiu. Abra o `gideon_pc.py` de novo (dois cliques).
- **Chave errada ou vencida:** mande /pc no Telegram, apague o arquivo `.gideon-pc.json` da sua pasta de usuário (`C:\Users\<você>`) e abra o programa de novo.
- **Trocar a pasta liberada:** apague `.gideon-pc.json` e abra o programa de novo.
- **Desligar de vez:** feche a janela e apague o arquivo "GIDEON PC.cmd" em `shell:startup` (Win+R, digite `shell:startup`, Enter).
- O que ela fez fica anotado em `C:\Users\<você>\GIDEON\.gideon-pc.log`.

## Para quem mexe no código
- `gideon_pc.py` (versão 2.0): arquivo único em Python 3, só biblioteca padrão + Pillow para o print da tela (instalada sozinha na primeira vez). O "abrir com o Windows" é um `GIDEON PC.cmd` na pasta Inicializar.
- Até a versão 1.2 era PowerShell (`.cmd` e depois `.ps1`). O antivírus do Windows bloqueava as duas ("conteúdo mal-intencionado"): um script de PowerShell que recebe ordens da internet, roda comandos e tira print é o padrão dos vírus. Nada de esconder ou embaralhar código para passar pelo antivírus; por isso a troca para Python.
- `../home/pc/gideon_pc.py` é uma **cópia** para download pelo site do GIDEON Home. Ao alterar o programa, copie de novo.
- Teste fora do Windows: `GIDEON_PC_CHAVE`, `GIDEON_PC_PASTA`, `GIDEON_PC_LEITURA` (e `GIDEON_PC_TELA_TESTE` com uma imagem) como variáveis de ambiente, e `python3 gideon_pc.py`.
- Ferramentas e rotas do servidor: `supabase/functions/gideon/pc.ts`. Fila: migração `011_pc.sql`.
