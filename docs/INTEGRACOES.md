# Configurar as integrações

## 1. Assistente IA — escolha sua opção

O Pulso funciona com **duas IAs** (assistente, quiz, Feynman, leitura de imagens do
calendário). Você só precisa de UMA:

### Opção A — Gemini (Google) · GRATUITA · ~2 minutos

1. Acesse [aistudio.google.com/apikey](https://aistudio.google.com/apikey) com sua conta
   Google e clique em **Create API key** (não pede cartão).
2. No `.env`, preencha:
   ```
   GEMINI_API_KEY="AIza..."
   ```
3. Reinicie o servidor. Pronto — o plano gratuito tem limites por minuto/dia, mas é
   suficiente para uso pessoal de estudos.

### Opção B — Claude (Anthropic) · paga por uso · ~2 minutos

1. Acesse [console.anthropic.com](https://console.anthropic.com), crie a conta e vá em
   **Settings → API Keys → Create Key**.
2. No `.env`, preencha:
   ```
   ANTHROPIC_API_KEY="sk-ant-..."
   ```
> O Claude não tem camada gratuita na API: é pago por consumo (centavos por conversa,
> exige adicionar créditos/cartão). Em troca, costuma dar respostas de mais qualidade.
> Se tiver as duas chaves, escolha com `IA_PROVEDOR="claude"` ou `"gemini"`.

### E o NotebookLM ("Gemini Notebook")?

O **NotebookLM não tem API pública** — o Google não permite que outros aplicativos se
conectem a ele. Ou seja, não dá para integrar diretamente ao Pulso. Alternativas:
- Use o **Gemini** aqui dentro (opção A) — é a mesma família de IA por trás do NotebookLM;
- Para usar o NotebookLM em paralelo: copie suas Notas do Pulso e cole lá como fonte.

## 2. Google (Classroom, Gmail, Drive) — ~10 minutos, gratuito

O sistema pede apenas **escopos somente leitura**: ele nunca altera, envia ou apaga nada na
sua conta Google.

### Passo a passo no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) com sua conta Google.
2. No topo, crie um **novo projeto** (ex.: "Pulso").
3. **Ative as três APIs** — menu *APIs e serviços → Biblioteca*, busque e ative uma a uma:
   - **Google Classroom API**
   - **Gmail API**
   - **Google Drive API**
4. **Tela de consentimento** — menu *APIs e serviços → Tela de permissão OAuth*:
   - Tipo de usuário: **Externo** → criar
   - Preencha só o obrigatório (nome do app "Pulso", seu e-mail nos dois campos)
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
   de teste; clique em *Avançado → Acessar Pulso*.

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
