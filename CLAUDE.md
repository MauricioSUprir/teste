# Instruções do projeto

## Sobre

EstudaFlow — sistema pessoal de organização de estudos (Next.js 15 + Prisma/SQLite),
em português, com assistente de IA (Claude) e integrações Google somente leitura.
Documentação em `docs/`.

## Preferências do usuário

- **Sempre enviar o link de acesso ao PROJETO** ao final de cada trabalho:
  http://localhost:3000 enquanto for local; a URL de produção depois do deploy.
  O usuário NÃO quer o link do GitHub.
- **Nunca enviar links do claude.ai** (artifacts etc.) — o usuário está com o
  claude.ai bloqueado e não consegue acessar.
- Comunicação em português do Brasil.

## Comandos

- `npm run setup` — instala dependências, gera o cliente Prisma e cria o banco
- `npm run dev` — roda em http://localhost:3000
- `npm run build` — build de produção (valida tipos)
- `npm run db:push` / `npm run db:studio` — schema e inspeção do banco

## Convenções

- Interface, código de domínio e commits em português.
- CRUD via Server Actions em `lib/actions.ts`; rotas de API só para IA e OAuth Google.
- SQLite não suporta enums no Prisma: `status`/`priority`/`source` são `String`
  (valores em `docs/MODELO-DE-DADOS.md`).
