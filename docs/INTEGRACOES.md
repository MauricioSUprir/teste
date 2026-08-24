# Configurar as integrações

## 1. Assistente IA (Claude) — ~2 minutos

1. Acesse [console.anthropic.com](https://console.anthropic.com) e crie uma conta (ou entre).
2. Vá em **Settings → API Keys → Create Key** e copie a chave.
3. No projeto, copie `.env.example` para `.env` (se ainda não fez) e preencha:
   ```
   ANTHROPIC_API_KEY="sk-ant-..."
   ```
4. Reinicie o servidor (`npm run dev`). A página **Assistente IA** passa a funcionar.

> O uso da API é pago por consumo (centavos por conversa). Você acompanha os gastos no
> próprio console da Anthropic.

## 2. Google (Classroom, Gmail, Drive) — ~10 minutos, gratuito

O sistema pede apenas **escopos somente leitura**: ele nunca altera, envia ou apaga nada na
sua conta Google.

### Passo a passo no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) com sua conta Google.
2. No topo, crie um **novo projeto** (ex.: "EstudaFlow").
3. **Ative as três APIs** — menu *APIs e serviços → Biblioteca*, busque e ative uma a uma:
   - **Google Classroom API**
   - **Gmail API**
   - **Google Drive API**
4. **Tela de consentimento** — menu *APIs e serviços → Tela de permissão OAuth*:
   - Tipo de usuário: **Externo** → criar
   - Preencha só o obrigatório (nome do app "EstudaFlow", seu e-mail nos dois campos)
   - Em **Usuários de teste**, adicione o seu próprio e-mail (importante!)
5. **Credenciais** — menu *APIs e serviços → Credenciais → Criar credenciais → ID do
   cliente OAuth*:
   - Tipo: **Aplicativo da Web**
   - Em **URIs de redirecionamento autorizados**, adicione exatamente:
     ```
     http://localhost:3000/api/google/callback
     ```
   - Crie e copie o **ID do cliente** e a **Chave secreta**.
6. Preencha no `.env`:
   ```
   GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-..."
   GOOGLE_REDIRECT_URI="http://localhost:3000/api/google/callback"
   ```
7. Reinicie o servidor, abra **Integrações** no menu e clique em **Conectar conta Google**.
   O Google mostrará um aviso de "app não verificado" — normal para apps pessoais em modo
   de teste; clique em *Avançado → Acessar EstudaFlow*.

### O que cada integração faz

| Integração | O que acontece |
|---|---|
| **Classroom** | Cada curso ativo vira uma matéria; cada atividade vira uma tarefa com prazo e link. Rodar de novo nunca duplica — só traz o que é novo. |
| **Gmail** | Busca e-mails dos últimos 14 dias vindos do Classroom ou com assunto de prova/trabalho/prazo/atividade/aula, com link direto para abrir no Gmail. |
| **Drive** | Lista seus arquivos modificados recentemente com link para abrir no Drive. |

### Problemas comuns

- **"acesso negado" ao conectar** — seu e-mail não está em *Usuários de teste* na tela de
  consentimento, ou você negou alguma permissão.
- **Erro 400 redirect_uri_mismatch** — o URI de redirecionamento no Google Cloud não é
  exatamente `http://localhost:3000/api/google/callback`.
- **Classroom retorna 403** — a Google Classroom API não foi ativada no projeto, ou sua
  conta não participa de nenhum curso.
- **Tokens expiraram após muito tempo sem usar** — clique em *Desconectar* e conecte de novo.
