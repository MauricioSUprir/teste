# GIDEON na Oracle Cloud (grátis para sempre)

Você faz 4 coisas; o resto o Claude faz pelo n8n.

## 1. Criar a conta (10–20 min)
- https://signup.cloud.oracle.com — use o e-mail do projeto.
- **Home region:** escolha **Brazil East (São Paulo)** ou **US East (Ashburn)**. Não dá para trocar depois.
- Pede cartão **só para verificar** (pode aparecer uma cobrança de teste que é devolvida). O plano fica "Always Free"; não ative "Upgrade to Pay As You Go".

## 2. Criar o servidor (5 min)
1. Menu ☰ → **Compute → Instances → Create instance**.
2. Nome: `gideon`.
3. **Image and shape → Change image:** Canonical **Ubuntu 24.04**. **Change shape:** **Ampere** → `VM.Standard.A1.Flex` com **2 OCPU e 12 GB** (dentro do grátis).
4. **Networking:** deixe criar a rede nova, com **IP público** marcado.
5. **Add SSH keys:** "No SSH keys" (o Claude não precisa entrar no servidor).
6. Clique em **Show advanced options → Management → Paste cloud-init script** e cole todo o arquivo `cloud-init.yaml` desta pasta.
7. **Create.** Se aparecer "Out of capacity", tente outro *Availability domain* ou tente de novo mais tarde.

## 3. Abrir as portas 80 e 443 (3 min)
1. Na página da instância, clique na **Subnet** → **Security Lists** → a lista padrão → **Add Ingress Rules**.
2. Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination Port Range `80,443` → **Add**.

## 4. Mandar o IP para o Claude
Copie o **Public IP address** da instância (ex.: `129.80.1.2`). O n8n fica em `https://129-80-1-2.sslip.io` uns 5 minutos depois.

## Depois (Claude)
Criar sua conta de dono no n8n novo → API key pelo formulário seguro → você recadastra Telegram e Gemini → Claude cria a conexão com o Supabase, importa os workflows, testa, troca o Telegram e desliga o Railway.
