# 09 — QA, Testes e Definition of Done

## 1. Pirâmide

- **Unitários (Vitest):** cálculo de preço, aplicação de desconto e cupom, ordem de promoções, validação de CPF/CEP, formatação monetária, regras de frete grátis. Toda função que toca dinheiro tem teste — sem exceção.
- **Integração:** sync do Bling, webhook de pagamento (incluindo reenvio duplicado), cotação de frete com mock, reserva e liberação de estoque.
- **E2E (Playwright):** os 12 cenários abaixo.
- **Visual:** snapshot dos componentes de catálogo e checkout em 3 breakpoints.

## 2. Cenários E2E obrigatórios

1. Visitante busca produto → PDP → adiciona → checkout → paga com Pix → pedido criado.
2. Visitante compra com cartão em 3x.
3. Visitante compra com boleto; estoque fica reservado.
4. Cliente logado usa "comprar novamente".
5. Produto com variação: trocar tamanho altera preço, imagem e estoque.
6. Cupom válido aplica; cupom expirado retorna erro claro.
7. Carrinho atinge o valor de frete grátis: barra completa e frete zera.
8. Faixa de brinde: brinde entra ao atingir e sai ao remover item.
9. Produto esgotado: CTA vira "avise-me" e captura e-mail.
10. Cálculo de frete na PDP retorna prazo em data.
11. Checkout com CEP inválido: erro inline, sem perder os dados preenchidos.
12. Dois clientes compram a última unidade simultaneamente: apenas um conclui.

O cenário 12 é o que separa um e-commerce sério de um protótipo. Rodar sob concorrência real, não sequencialmente.

## 3. Testes manuais antes do go-live

- Fluxo completo em iPhone real (Safari) e Android real (Chrome) — emulador não pega bug de teclado, de `input` e de scroll travado no drawer.
- Leitor de tela (VoiceOver ou NVDA) no fluxo PDP → carrinho → checkout.
- Um pedido real de ponta a ponta: pago, faturado no Bling, etiqueta gerada, e-mail recebido, rastreio atualizando.
- Teste de e-mail em Gmail web, Gmail app, Outlook e Apple Mail.
- Simulação de queda: derrubar Meilisearch e o Bling separadamente e confirmar que o site continua vendendo.

## 4. Definition of Done — por ticket

Um ticket só fecha quando:

- [ ] Funciona em mobile 360px e desktop 1440px.
- [ ] Estados cobertos: carregando, vazio, erro, sucesso.
- [ ] Navegável por teclado, com foco visível.
- [ ] Textos em `src/lib/copy/`, nenhuma string solta no JSX.
- [ ] Sem erro e sem warning novo no console.
- [ ] Testes escritos e passando; suíte inteira verde.
- [ ] Lighthouse não regrediu nas rotas afetadas.
- [ ] `.env.example` atualizado se entrou variável nova.
- [ ] Documentação atualizada se mudou comportamento descrito nos docs.
- [ ] Demonstrável em staging.

## 5. Definition of Done — lançamento

- [ ] 12 cenários E2E verdes.
- [ ] Lighthouse mobile ≥ 90 Performance e ≥ 95 Acessibilidade em Home, PLP, PDP, Checkout.
- [ ] 300 SKUs prioritários com foto, descrição, atributos e dimensões completos.
- [ ] 10 pedidos reais concluídos ponta a ponta no beta fechado.
- [ ] Todas as páginas legais publicadas e revisadas.
- [ ] Backup automático rodando e restore testado com tempo medido.
- [ ] Sentry, uptime e alertas de negócio ativos no Telegram.
- [ ] GA4, Meta CAPI e Merchant Center validados.
- [ ] Plano de rollback escrito e testado.
- [ ] Equipe de atendimento treinada no painel e no fluxo de troca.

## 6. Runbook de incidente

| Sintoma | Primeira ação |
|---|---|
| Site fora | Verificar container e Cloudflare; ativar página de manutenção |
| Pagamento falhando em massa | Checar status do Mercado Pago; desabilitar o meio afetado sem derrubar os outros |
| Estoque errado vendendo | Pausar o SKU; rodar sync manual; contatar quem comprou antes de cancelar |
| Pedido não chegou no Bling | Fila de reprocessamento no n8n; nunca recriar manualmente sem checar duplicata |
| Pico de tráfego derrubando os agentes | Escalar container do storefront; se persistir, executar a migração prevista no ADR-0005 |
