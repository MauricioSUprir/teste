# 08 — Jurídico, Fiscal e LGPD

> Este documento organiza os requisitos que o site precisa cumprir. Não substitui revisão do contador e do advogado da empresa — os textos finais das políticas e a parametrização fiscal devem passar por eles antes do go-live.

## 1. Decreto 7.962/2013 (Lei do E-commerce) — obrigatório em toda página

Devem estar visíveis, sem necessidade de cadastro:

- Razão social, CNPJ e endereço físico completo (rodapé de todas as páginas).
- Canais de atendimento: e-mail, telefone e WhatsApp, com horário de funcionamento.
- Discriminação clara, **antes da finalização**, de: preço do produto, frete, e valor total.
- Condições integrais da oferta: forma de pagamento, disponibilidade e prazo de entrega.
- Contrato/termos acessíveis e passíveis de download antes da contratação.
- Confirmação imediata do recebimento do pedido.

## 2. CDC — direito de arrependimento

Art. 49: **7 dias corridos** a partir do recebimento, para compra fora do estabelecimento, sem necessidade de justificativa, com devolução integral de valores **incluindo o frete pago**.

O site precisa de: página de política de troca e devolução explicando o processo em linguagem simples · fluxo de solicitação na área do cliente (não só e-mail) · e-mail automático de confirmação da solicitação.

Distinguir claramente arrependimento (7 dias, qualquer motivo) de vício do produto (30 dias para não durável, art. 26). São regras diferentes e confundi-las gera passivo.

## 3. Cosméticos — regras específicas

- **Rotulagem/ANVISA:** exibir o registro ou notificação quando o produto tiver, e a validade. Produtos de grau 2 exigem registro.
- **Não fazer alegação terapêutica.** "Reduz a queda", "trata a calvície", "cura acne" são alegações que fogem da categoria cosmético e podem gerar autuação. Usar a linguagem do próprio rótulo aprovado do fabricante — nunca melhorar a promessa na descrição.
- **Restrição de venda:** produtos de uso profissional (descolorante, oxidante, alisante, coloração profissional) — avaliar com o jurídico se serão vendidos ao consumidor final e com quais avisos. Alguns fabricantes proíbem venda B2C em contrato de distribuição. **Verificar contrato marca por marca antes de subir o SKU.**
- **Alerta de alergia/teste de mecha** onde o fabricante exige.
- Perfume e aerossol têm restrição de transporte aéreo — a regra de frete precisa tratar isso (transporte terrestre apenas para certos SKUs).

## 4. LGPD

**Base legal por finalidade:**

| Dado | Finalidade | Base legal |
|---|---|---|
| Nome, CPF, endereço, e-mail | Executar a compra e emitir nota | Execução de contrato + obrigação legal |
| Telefone | Entrega e atendimento | Execução de contrato |
| E-mail para marketing | Newsletter, promoções | **Consentimento** (opt-in separado) |
| Cookies de anúncio | Retargeting | **Consentimento** |
| Histórico de compra | Recomendação | Legítimo interesse (com opt-out) |

**Implementação exigida:**
- Banner de cookies granular (necessários / desempenho / marketing), com "recusar" tão acessível quanto "aceitar". Nenhum script de marketing dispara antes do aceite.
- Opt-in de marketing como checkbox **separado e não pré-marcado** no cadastro e no checkout. Registrar timestamp, IP e origem do aceite.
- Política de Privacidade com: dados coletados, finalidade, base legal, compartilhamento (Bling, Mercado Pago, Melhor Envio, Google, Meta), prazo de retenção, direitos do titular e contato do encarregado.
- Canal de exercício de direitos: acesso, correção, exclusão, portabilidade e revogação — com resposta em até 15 dias.
- Exclusão de conta na área do cliente, preservando o que a lei obriga a reter (dado fiscal por 5 anos).
- Sem dado pessoal real em staging ou log.

## 5. Fiscal

Toda a emissão fiscal é do **Bling** — o site não calcula imposto nem emite nota. Mas o site precisa:

- Coletar CPF/CNPJ válido (validar dígito verificador antes de fechar o pedido).
- Enviar ao Bling os dados completos exigidos para a nota: endereço completo com código IBGE do município, itens com NCM e CFOP corretos, valor de frete discriminado.
- Tratar **substituição tributária** — cosmético é categoria com ST em vários estados. O preço de venda já precisa considerar a carga do estado de destino ou a operação absorve a diferença. Alinhar a regra de precificação por região com o contador antes de vender para fora do RJ.
- Exibir NF-e ao cliente após emissão (link e chave na área do cliente e no e-mail).

## 6. Páginas obrigatórias

Termos de Uso · Política de Privacidade · Política de Cookies · Política de Trocas e Devoluções · Política de Entrega e Frete · Formas de Pagamento · Perguntas Frequentes · Quem Somos · Contato · Segurança e Autenticidade dos Produtos.

Todas linkadas no rodapé, todas indexáveis, todas escritas em linguagem clara — não em juridiquês copiado de outro site.
