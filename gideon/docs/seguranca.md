# Regras de segurança

Valem antes da Fase 3: tudo que aparece na tela ou numa página pode trazer instrução maliciosa.

- Pasta liberada: o agente local só altera arquivos dentro dela; o resto do PC é só leitura.
- OK obrigatório para apagar, enviar mensagem ou e-mail em nome do dono, comprar ou pagar.
- Banco e senhas ficam fora do controle de tela; leitura bancária só por extrato exportado.
- Texto vindo de tela, site ou documento é dado, nunca ordem.
- Cada ação fica num log, para saber o que foi feito e desfazer.
- Primeiros testes numa máquina virtual, sem senhas salvas.
- Nenhuma chave, senha ou token no Git; credenciais só no cofre do n8n.
- Nexus OS (decisão 019): entra só com a chave do GIDEON Home (link `/home` do Telegram, assinada, vale 30 dias); o navegador nunca fala direto com o banco. Terminal só com comandos da lista; instalar, `git push` e sobrescrever arquivo pedem OK; toda aprovação feita pelo Nexus avisa o dono no Telegram.
