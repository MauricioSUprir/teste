# BeautyNow — Estado do projeto (11/11/2026)

## No ar

- BeautyNow: https://www.beautynowstore.com.br, com os espelhos /pro (Be2Beauty),
  /pulse e /bradeco. Publicado pela branch gh-pages deste repositório.
- Be2Beauty: https://www.be2beauty.com.br. Publicado pela branch gh-pages do
  repositório MauricioSUprir/Be2Beauty, com o mesmo código daqui.
- Servidor: Render (plano gratuito), branch claude/beauty-now-ecommerce-fbfxh2,
  pasta apps/servidor.
- Catálogo do Hub sincronizado por robô diário (estoque também ao vivo pelo servidor).
- Pagamento pelo Mercado Pago, faturamento no Bling e e-mail pelo Brevo.
- Dados no Supabase, com backup versionado neste repositório.
- Google: Analytics e Tag Manager (só depois do aceite de cookies), Search Console
  dos dois domínios e feed do Merchant Center.
- Build sem depender do Google Fonts: as fontes estão em
  apps/storefront/src/app/fontes, sob licença OFL.

## Revisão da agência (em andamento)

Relatórios entregues em particular; o detalhe não fica neste repositório.

- [x] Raio-x do projeto (11/11/2026)
- [x] Etapa 0: preparação (11/11/2026); aguardando decisões e ações do responsável pelas contas
- [ ] Etapa 1: pedidos (cálculo e pagamento)
- [ ] Etapa 2: login e sessões
- [ ] Etapa 3: dados e hospedagem
- [ ] Etapa 4: frete real (proposta em docs/13-frete.md antes de programar)
- [ ] Etapa 5: vitrine de creators na home (proposta em docs/12-creators.md antes de programar)
- [ ] Etapa 6: preço por loja e desempenho
- [ ] Etapa 7: demais ajustes

## Pendências operacionais

- [ ] 1 pedido pago aguardando entrada no Bling por endereço com estado inválido
      (correção proposta, aguardando aprovação)
- [ ] Merchant Center: confirmar o site, configurar frete e devolução, cadastrar
      o feed (BeautyNow), e criar a conta da Be2Beauty
- [ ] Google Meu Negócio: verificação e preenchimento do perfil
- [ ] Acesso da agência às ferramentas do Google
- [ ] Documentação desatualizada. O CLAUDE.md (seção 3) e os arquivos docs/02, 04,
      05, 06 e 09 descrevem a arquitetura planejada (Medusa, Postgres,
      Meilisearch, n8n, Melhor Envio, VPS), não a que está no ar.
- [ ] .env.example sem algumas variáveis que o servidor usa

## Pendências que precisam do responsável pelas contas

- [ ] Regenerar o Client Secret do Bling e atualizar no Render
- [ ] Estornar a compra-teste no painel do Mercado Pago (conferir se ainda está aberta)
- [ ] Atualizar a URL da loja no cadastro do app do Mercado Pago
- [ ] Decidir o plano do servidor (hoje é o gratuito)

## Conteúdo

- [ ] Logos maiores de Batiste, Latika, Mawwal e Reyou (página /enviar-logos)
- [ ] Descrições completas dos produtos (exportador ?modo=completo)
- [ ] Revisão dos textos legais (privacidade, trocas, termos): docs/08
