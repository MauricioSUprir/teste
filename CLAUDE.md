# Instruções do projeto

## Sobre

EstudaFlow — sistema pessoal de organização de estudos (Next.js 15 + Prisma/SQLite),
em português, com assistente de IA (Claude) e integrações Google somente leitura.
Documentação em `docs/`.

## Preferências do usuário

- **Sempre enviar o link do GitHub** (branch, commit ou PR) ao final de qualquer
  trabalho commitado/enviado, em toda resposta.
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
