import { LOJA } from "@/lib/loja";
import { CUPOM_BOAS_VINDAS } from "@/lib/cupons";
import { DESCONTO_PIX_PCT, FAIXA_BRINDE_CENTAVOS, MAX_PARCELAS } from "@/lib/preco";

/** reais inteiros para as chamadas do topo (R$ 99, R$ 250) */
// espaço que não quebra: "R$" e o valor nunca ficam em linhas diferentes
const reais = (centavos: number) => `R$\u00a0${Math.round(centavos / 100)}`;

/**
 * Vantagens da faixa do topo — todas são regras que o checkout cumpre de
 * verdade (Pix, parcelas, brinde, cupom). Frete grátis por valor NÃO entra:
 * foi desligado a pedido do Mauricio.
 */
type Vantagem = { destaque: string; texto: string; link?: string };
const vantagensVarejo: Vantagem[] = [
  {
    destaque: CUPOM_BOAS_VINDAS.codigo,
    texto: `${CUPOM_BOAS_VINDAS.valor}% off em compras acima de ${reais(CUPOM_BOAS_VINDAS.minimoCentavos)}`,
  },
  { destaque: `${DESCONTO_PIX_PCT}% off`, texto: "pagando no Pix" },
  { destaque: "Brinde", texto: `nas compras acima de ${reais(FAIXA_BRINDE_CENTAVOS)}` },
  { destaque: `${MAX_PARCELAS}x`, texto: "sem juros no cartão" },
];
/** loja com preço fechado até o CNPJ ser aprovado (hoje a Bradeco) */
const vantagensB2B: Vantagem[] = [
  { destaque: "CNPJ ou MEI", texto: "cadastre e veja os preços de distribuidora", link: "/profissional" },
  { destaque: "Na hora", texto: "liberação automática com CNPJ ativo" },
  { destaque: `${DESCONTO_PIX_PCT}% off`, texto: `no Pix · até ${MAX_PARCELAS}x sem juros` },
  { destaque: "Brinde", texto: `nas compras acima de ${reais(FAIXA_BRINDE_CENTAVOS)}` },
];
/** loja profissional aberta a todos (Be2Beauty desde 16/10) */
const vantagensProfissional: Vantagem[] = [
  { destaque: "Linhas de 1 litro", texto: "tamanho de salão para o seu studio", link: "/destaques/linhas-de-litro" },
  { destaque: "Profissional", texto: "cadastre o CNPJ e receba condições exclusivas", link: "/profissional" },
  { destaque: `${DESCONTO_PIX_PCT}% off`, texto: `no Pix · até ${MAX_PARCELAS}x sem juros` },
  { destaque: "Brinde", texto: `nas compras acima de ${reais(FAIXA_BRINDE_CENTAVOS)}` },
];
/** loja voltada ao profissional mas aberta a qualquer comprador */
const profissionalAberta = LOJA.b2b && !LOJA.precoFechado;

/**
 * Todos os textos de interface em pt-BR — CLAUDE.md §4.
 * Nada de string solta em JSX. Voz: direta, informativa, sem infantilizar (docs/03 §6).
 * Textos que mudam entre BeautyNow e Be2Beauty usam LOJA.b2b (voz para o
 * profissional) e LOJA.precoFechado (preço só com CNPJ aprovado).
 */
export const copy = {
  marca: {
    nome: LOJA.nome,
    slogan:
      LOJA.id === "bradeco"
        ? "Elo entre indústria e varejo."
        : LOJA.b2b
          ? "Only professional."
          : LOJA.id === "pulse"
            ? "Cuidado no ritmo certo."
            : "Cosméticos profissionais, curadoria de verdade.",
  },
  header: {
    busca: "Buscar produto, marca ou necessidade",
    buscar: "Buscar",
    minhaConta: "Minha conta",
    sacola: "Sacola",
    menu: "Menu",
    fecharMenu: "Fechar menu",
    anuncio:
      LOJA.id === "bradeco"
        ? "Distribuição para lojistas e profissionais em todo o estado de SP · Cadastre o CNPJ e libere os preços"
        : profissionalAberta
          ? "Linhas profissionais para salões e studios · Compre com ou sem CNPJ"
          : LOJA.b2b
            ? "Site exclusivo para profissionais da beleza com CNPJ/MEI · Cadastre-se e libere os preços"
            : "Pix com 5% de desconto · Produtos 100% originais",
    vantagens: profissionalAberta ? vantagensProfissional : LOJA.b2b ? vantagensB2B : vantagensVarejo,
    vantagensRotulo: "Vantagens da loja",
    atalhos: {
      rotulo: "Atalhos",
      atendimento: "Atendimento",
      whatsapp: "WhatsApp",
      entregaRio: "Entrega em 1 dia útil no Rio",
      profissional: "Cadastro profissional",
      afiliado: "Seja afiliado",
      pedidos: "Meus pedidos",
      favoritos: "Favoritos",
      versao: {
        rotulo: "Ver a loja:",
        normal: "Normal",
        tresD: "Em 3D",
        menu3d: "Passear pela loja em 3D",
        menuNormal: "Voltar para a loja normal",
        curto: "3D",
      },
    },
    destaques: {
      maisVendidos: "Mais vendidos",
      marcasProfissionais: "Marcas Profissionais",
      liberarPrecos: profissionalAberta ? "Ver categorias" : "Liberar preços",
    },
  },
  nav: {
    inicio: "Início",
    categorias: "Categorias",
    marcas: "Marcas",
    necessidades: "Por necessidade",
    todasMarcas: "Ver todas as marcas",
    voltar: "Voltar",
  },
  home: {
    heroTitulo: "Seu cabelo, tratado como em salão.",
    heroTexto:
      "As linhas de haircare, perfumaria e cuidado pessoal que a gente distribui para salão há 15 anos, agora para você usar em casa.",
    heroCta: "Ver mais vendidos",
    maisVendidos: "Mais vendidos",
    lancamentos: "Lançamentos",
    porCategoria: "Compre por categoria",
    /** vitrine de campanha (src/lib/destaque-home.ts) */
    destaqueMarca: {
      logoAlt: "Wahl",
      titulo: "Máquinas Wahl em destaque",
      texto: "Máquinas de corte, de acabamento e aparadores Wahl, com garantia de distribuidor autorizado.",
      cta: "Ver tudo da Wahl",
    },
    porNecessidade: "O que seu cabelo precisa hoje?",
    marcasDestaque: "Marcas que a gente confia",
    verTudo: "Ver tudo",
    cases: LOJA.b2b ? "Quem compra com a gente" : "Quem já comprou aqui",
    casesUma: "avaliação",
    casesMuitas: "avaliações",
    seloOriginal: "Distribuidor autorizado",
    seloOriginalTexto: "Produto 100% original, direto do fabricante.",
    seloEnvio: "Envio rápido",
    seloEnvioTexto: "Despachamos para todo o Brasil com rastreio ponta a ponta.",
    seloTroca: "Troca fácil em 7 dias",
    seloTrocaTexto: "Sem burocracia, conforme o CDC.",
    seloPix: "5% off no Pix",
    seloPixTexto: "Desconto aplicado no total do pedido.",
    newsletterTitulo: "Receba ofertas e novidades por e-mail",
    newsletterTexto: "Sem spam. Só lançamento, reposição e conteúdo que ajuda.",
    newsletterPlaceholder: "seu@email.com",
    newsletterCta: "Quero receber",
    newsletterOk: "Pronto! Confira seu e-mail para confirmar a inscrição.",
    irParaBanner: "Ir para o banner",
    bannerAnterior: "Banner anterior",
    proximoBanner: "Próximo banner",
    prateleiraAnterior: "Ver produtos anteriores",
    prateleiraProxima: "Ver mais produtos",
    verProdutos: "Ver produtos",
    vitrines: "Vitrines da loja",
    vitrinePromocoes: "Em promoção",
    vitrineLancamentos: "Lançamentos",
    vitrineCategoria: (nome: string) => `Destaques em ${nome}`,
    atalhosRotulo: "Atalhos da loja",
    atalhos: {
      maisVendidos: "Mais vendidos",
      cupom: `Cupom ${CUPOM_BOAS_VINDAS.codigo}`,
      cadastroCnpj: "Cadastre seu CNPJ",
      brinde: `Brinde acima de ${reais(FAIXA_BRINDE_CENTAVOS)}`,
      pix: `${DESCONTO_PIX_PCT}% off no Pix`,
      marcas: "Marcas profissionais",
      whatsapp: "Fale no WhatsApp",
      afiliado: "Seja afiliado",
    },
    campanha: profissionalAberta
      ? {
          sobretitulo: "Para o seu studio",
          titulo: "Linhas profissionais em tamanho de salão",
          texto: "Shampoo, condicionador e máscara de 1 litro, finalizadores e descoloração para o dia a dia do salão.",
          cta: "Ver linhas de 1 litro",
          link: "/destaques/linhas-de-litro",
        }
      : LOJA.b2b
      ? {
          sobretitulo: "Para o seu salão",
          titulo: "Preço de distribuidora para CNPJ e MEI",
          texto: "Cadastre o CNPJ e veja na hora os preços de compra profissional.",
          cta: "Liberar preços",
          link: "/profissional",
        }
      : {
          sobretitulo: "Presente da casa",
          titulo: `Brinde nas compras acima de ${reais(FAIXA_BRINDE_CENTAVOS)}`,
          texto: "O brinde entra sozinho no pedido quando o carrinho passa do valor.",
          cta: "Aproveite",
          link: "/categoria/cabelos",
        },
    editorial: LOJA.b2b
      ? {
          titulo: "Compra de salão",
          texto: "NF-e em todo pedido, estoque real e entrega rápida para quem trabalha com beleza.",
          cta: "Saiba mais",
          link: "/profissional",
        }
      : {
          titulo: "Linha de salão",
          texto: "Há 15 anos levando marcas profissionais aos salões. Agora, direto para a sua casa.",
          cta: "Conheça",
          link: "/institucional/quem-somos",
        },
    mosaicoTitulo: "Marcas em destaque",
    conhecerMarca: "Conhecer a marca",
    produtosDaMarca: (n: number) => `${n} produtos`,
    vantagensTitulo: "Por que comprar aqui",
    legalBanner: "Imagens ilustrativas. Ofertas por tempo limitado ou enquanto durar o estoque.",
  },
  card: {
    adicionar: "Adicionar",
    esgotado: "Esgotado",
    /** produto que o Hub ainda não precificou (tem estoque, falta preço) */
    emBreve: "Em breve",
    noPix: "no Pix",
    ate: "até",
    semJuros: "sem juros",
    tamanhos: "tamanhos",
    opcoes: "opções",
    verOpcoes: "Ver opções",
    de: "De",
    ouNoCartao: (preco: string) => `ou ${preco} no cartão`,
    nota: (nota: string) => `Nota ${nota} de 5`,
    lancamento: "Lançamento",
  },
  plp: {
    filtros: "Filtros",
    limparFiltros: "Limpar filtros",
    ordenar: "Ordenar por",
    produtos: "produtos",
    produto: "produto",
    nenhumResultado: "Nenhum produto com esses filtros. Remova algum filtro para ampliar a busca.",
    filtroMarca: "Marca",
    filtroPreco: "Preço",
    filtroTipoCabelo: "Tipo de cabelo",
    filtroNecessidade: "Necessidade",
    filtroTipoPele: "Tipo de pele",
    filtroBeneficios: "Características",
    disponiveis: "Somente disponíveis",
    /** título da região de resultados — só para leitor de tela */
    tituloResultados: "Produtos encontrados",
    verMais: "Ver mais produtos",
    de: "de",
    ordenacao: {
      relevancia: "Relevância",
      maisVendidos: "Mais vendidos",
      menorPreco: "Menor preço",
      maiorPreco: "Maior preço",
      lancamentos: "Lançamentos",
      melhorAvaliados: "Melhor avaliados",
    },
  },
  pdp: {
    adicionarSacola: "Adicionar à sacola",
    adicionado: "Adicionado à sacola",
    esgotado: "Produto esgotado",
    emBreve: "Em breve no site",
    aviseMe: "Avise-me quando chegar",
    aviseMeOk: "Pronto! Você será avisada assim que o produto voltar.",
    quantidade: "Quantidade",
    calcularFrete: "Calcular frete e prazo",
    cepPlaceholder: "00000-000",
    cepErro: "CEP não encontrado. Confira os 8 dígitos.",
    calcular: "OK",
    avaliacoes: "avaliações",
    avaliacao: "avaliação",
    sobre: "Sobre o produto",
    comoUsar: "Como usar",
    composicao: "Composição",
    especificacoes: "Especificações",
    compreJunto: "Compre junto",
    compreJuntoDesconto: "Leve o combo com 10% de desconto",
    adicionarCombo: "Adicionar combo à sacola",
    mesmaLinha: "Da mesma linha",
    quemViuTambemViu: "Quem viu também viu",
    ultimasUnidades: (n: number) => `Últimas ${n} unidades`,
    emEstoque: "Em estoque",
    distribuidorAutorizado: "Distribuidor autorizado",
    trocaFacil: "Troca em 7 dias",
    envioRapido: "Envio rápido",
    compraVerificada: "Compra verificada",
    de: "de",
    noPix: "no Pix",
    off: "off",
    emAte: "em até",
    semJuros: "sem juros",
  },
  carrinho: {
    titulo: "Sua sacola",
    vazio: "Sua sacola está vazia. Comece pelos mais vendidos.",
    verMaisVendidos: "Ver mais vendidos",
    subtotal: "Subtotal",
    descontoPix: "Desconto Pix (5%)",
    totalNoPix: "Total no Pix",
    finalizarCompra: "Finalizar compra",
    continuarComprando: "Continuar comprando",
    remover: "Remover",
    brindeAtingido: `Brinde garantido: Nécessaire ${LOJA.nome}`,
    brindeFaltam: (valor: string) => `Faltam ${valor} para ganhar um brinde`,
    pedidoMinimo: (valor: string) => `Pedido mínimo de ${valor} para finalizar a compra`,
    fechar: "Fechar sacola",
    cupomTitulo: "Tem cupom de desconto?",
    cupomPlaceholder: "Digite o código",
    cupomAplicar: "Aplicar",
    cupomConferindo: "Conferindo…",
    cupomAplicado: (codigo: string) => `Cupom ${codigo} aplicado`,
    cupomRemover: "Remover cupom",
    cupomDesconto: "Desconto do cupom",
  },
  checkout: {
    titulo: "Finalizar compra",
    precisaContaTitulo: "Entre na sua conta para finalizar",
    precisaContaTexto:
      "Para concluir a compra você precisa estar na sua conta. Assim seus pedidos ficam salvos e fica mais fácil acompanhar. Seu carrinho continua guardado.",
    precisaContaEntrar: "Entrar na minha conta",
    precisaContaCriar: "Criar conta grátis",
    vendedorRotulo: "Usuário do vendedor (se um afiliado te indicou)",
    vendedorDica: "A compra é creditada ao vendedor com esse usuário.",
    vendedorNaoEncontrado:
      "Usuário do vendedor não encontrado. Confira com quem te indicou ou deixe em branco.",
    identificacao: "Identificação",
    entrega: "Entrega",
    pagamento: "Pagamento",
    email: "E-mail",
    nome: "Nome completo",
    cpf: "CPF",
    telefone: "Celular (WhatsApp)",
    cep: "CEP",
    logradouro: "Endereço",
    numero: "Número",
    complemento: "Complemento (opcional)",
    bairro: "Bairro",
    cidade: "Cidade",
    uf: "UF",
    referencia: "Ponto de referência (opcional)",
    pix: "Pix",
    pixDetalhe: "Aprovação na hora · 5% de desconto",
    cartao: "Cartão de crédito ou débito",
    cartaoDetalhe: "Crédito em até 6x sem juros · débito à vista",
    boleto: "Boleto à vista",
    boletoDetalhe: "Compensação em até 2 dias úteis",
    resumo: "Resumo do pedido",
    frete: "Frete",
    desconto: "Desconto do cupom",
    total: "Total",
    concluir: "Concluir pedido",
    seguro: "Ambiente seguro",
    atendimento: "Precisa de ajuda? Fale com a gente pelo WhatsApp ou e-mail do rodapé.",
    continuar: "Continuar",
    voltarLoja: "Voltar para a loja",
    camposObrigatorios: "Preencha os campos destacados para continuar.",
  },
  confirmacao: {
    titulo: "Pedido recebido!",
    tituloAguardando: "Esperando pagamento…",
    subtitulo: (numero: string) =>
      `Seu pedido ${numero} foi registrado. Enviamos a confirmação para o seu e-mail.`,
    subtituloAguardando: (numero: string) =>
      `Seu pedido ${numero} foi registrado e será confirmado assim que o pagamento cair.`,
    pixTitulo: "Pague com Pix para aprovar na hora",
    pixCopiar: "Copiar código Pix",
    pixCopiado: "Código copiado!",
    prazo: "Prazo estimado de entrega",
    acompanhar: "Acompanhar pedido",
    proximosTitulo: "O que acontece agora",
    proximosPassos: [
      "Confirmamos o pagamento e você recebe um e-mail com o resumo do pedido.",
      "Separamos e embalamos os produtos. Pedidos aprovados até 15h saem no mesmo dia útil.",
      "Assim que despachar, o código de rastreio chega no seu e-mail e no WhatsApp.",
    ],
    duvida: "Dúvida sobre o pedido? Fale com a gente:",
  },
  avaliacoes: {
    titulo: "Avaliações da loja",
    subtitulo: "O que nossas clientes dizem sobre os produtos e a experiência de compra.",
    deixeAvaliacao: "Deixe sua avaliação",
    suaNota: "Sua nota",
    notaProduto: "Nota para o produto",
    notaExperiencia: "Nota para a experiência de compra",
    seuNome: "Seu nome",
    seuComentario: "Conte como foi (opcional)",
    enviar: "Enviar avaliação",
    enviando: "Enviando…",
    obrigado: "✅ Obrigado! Sua avaliação já está publicada.",
    falha: "Não foi possível enviar agora. Tente novamente.",
    escolhaEstrelas: "Escolha de 1 a 5 estrelas antes de enviar.",
    carregando: "Carregando avaliações…",
    sejaPrimeira: "Seja a primeira pessoa a avaliar a loja!",
    nenhumaAinda: "Nenhuma avaliação ainda. A sua pode ser a primeira.",
    avaliacao: "avaliação",
    avaliacoes: "avaliações",
    compraVerificada: "compra verificada",
    posCompraTitulo: "Como foi sua experiência?",
    posCompraTexto: "Avalie em segundos. Ajuda outras clientes e ajuda a gente a melhorar.",
  },
  rodape: {
    institucional: "Institucional",
    ajuda: "Ajuda",
    pagamento: "Pagamento",
    seguranca: "Segurança",
    quemSomos: "Quem somos",
    trocasDevolucoes: "Trocas e devoluções",
    politicaPrivacidade: "Política de privacidade",
    termosUso: "Termos de uso",
    politicaEntrega: "Política de entrega",
    faq: "Perguntas frequentes",
    avaliacoes: "Avaliações da loja",
    contato: "Fale com a gente",
    rastrearPedido: "Rastrear pedido",
    programaAfiliados: "Seja um afiliado",
    cnpj:
      LOJA.id === "bradeco"
        ? "Bradeco Distribuidora · Distribuição, consultoria e representação · Exclusivo para CNPJ"
        : profissionalAberta
          ? "Be2Beauty · Only Professional"
          : LOJA.b2b
            ? "Be2Beauty · Only Professional · Exclusivo para CNPJ/MEI"
            : "BeautyNow Cosméticos · CNPJ 52.286.975/0001-21",
    endereco:
      LOJA.id === "bradeco"
        ? "Av. Rosa Zanetti Ferragut, 195 · Pinheirinho, Vinhedo/SP · admbradeco@gmail.com"
        : "Rio de Janeiro, RJ · Atendimento: (21) 99732-2464",
    direitos: `© ${new Date().getFullYear()} ${LOJA.nome}. Todos os direitos reservados.`,
  },
  /** linhas profissionais em destaque (lib/catalogo/destaques.ts) */
  destaques: {
    sobretitulo: "Para o seu studio",
    titulo: "Linhas profissionais",
    texto: "O que o salão usa todo dia, em tamanho profissional.",
    paginaTitulo: "Linhas profissionais",
    paginaTexto: "As linhas que o salão usa todo dia: tamanhos de 1 litro, finalizadores, descoloração, maquiagem e as marcas profissionais da casa.",
    verTodas: "Ver todas as linhas",
    produtos: (n: number) => (n === 1 ? "1 produto" : `${n} produtos`),
    itens: {
      evoly: { nome: "Evoly", chamada: "Tratamento profissional", texto: "Linha profissional Evoly para o salão." },
      "linhas-de-litro": {
        nome: "Linhas de 1 litro",
        chamada: "Tamanho de salão",
        texto: "Shampoo, condicionador, máscara e tratamento em embalagem de 1 litro (ou 1 kg), o tamanho que rende no lavatório.",
      },
      finalizadores: {
        nome: "Finalizadores",
        chamada: "Leave-in, óleo, creme e spray",
        texto: "Leave-in, creme de pentear, gelatina, óleo, sérum, spray e pomada para fechar o atendimento.",
      },
      descoloracao: {
        nome: "Descoloração e OX",
        chamada: "Pó descolorante D'vence",
        texto: "Pó descolorante e emulsões reveladoras (OX), com a linha Savior Blond da D'vence em primeiro.",
      },
      theoric: { nome: "Theoric", chamada: "Cuidado premium", texto: "Linha Theoric de tratamento, óleos e finalização." },
      maquiagem: {
        nome: "Maquiagem",
        chamada: "Make profissional",
        texto: "Base, corretivo, pó, blush, batom, pincéis e esponjas das marcas que o maquiador usa no dia a dia.",
      },
    },
  },
  b2b: {
    precoFechado: LOJA.id === "bradeco" ? "Preço de distribuidora" : "Preço para profissionais",
    liberarPrecos: "Cadastre seu CNPJ para ver os preços",
    aguardandoAprovacao:
      "Cadastro em análise. Isso acontece quando o CNPJ não está como ativo na Receita — avisamos por e-mail assim que liberar",
    recusado:
      LOJA.id === "bradeco"
        ? "Cadastro não aprovado. Fale com a gente: admbradeco@gmail.com"
        : "Cadastro não aprovado. Fale com a gente: (21) 99732-2464",
    paginaTitulo: LOJA.id === "bradeco" ? "Cadastro de lojista" : "Cadastro profissional",
    paginaTexto:
      LOJA.id === "bradeco"
        ? "A Bradeco Distribuidora atende lojistas, farmácias, salões e redes em todo o estado de São Paulo. Informe o CNPJ da sua empresa: a gente confere na Receita Federal e, estando ativo, os preços de distribuidora e a compra liberam na hora."
        : profissionalAberta
          ? "A Be2Beauty é feita para quem trabalha com beleza. Cadastre o CNPJ do seu salão, studio, clínica ou loja: a gente confere na Receita Federal e, estando ativo, o cadastro profissional fica valendo na hora para você receber as condições exclusivas."
          : "A Be2Beauty vende exclusivamente para profissionais e lojistas. Informe o CNPJ do seu salão, clínica ou loja: a gente confere na Receita Federal e, estando ativo, os preços e a compra liberam na hora.",
    semCnpj: "Não tem CNPJ? Compre no varejo pela BeautyNow →",
    semCnpjUrl: "https://www.beautynowstore.com.br",
    cnpj: "CNPJ",
    razaoSocial: "Razão social",
    nomeResponsavel: "Nome do responsável",
    email: "E-mail",
    whatsapp: "WhatsApp",
    enviar: "Enviar cadastro",
    enviando: "Enviando…",
    enviadoOk: "✅ Cadastro recebido! Vamos analisar e avisar por e-mail.",
    enviadoLiberado: profissionalAberta
      ? "✅ CNPJ conferido na Receita Federal. Cadastro profissional ativo."
      : "✅ CNPJ conferido na Receita Federal. Preços liberados neste navegador.",
    cnpjInvalido: "CNPJ inválido. Confira os 14 dígitos.",
    falha: "Não foi possível enviar agora. Tente novamente em instantes.",
    statusTitulo: "Situação do seu cadastro",
    statusPendente: "⏳ Em análise",
    statusAprovado: profissionalAberta ? "✅ Aprovado! Cadastro profissional ativo." : "✅ Aprovado! Preços liberados.",
    statusRecusado: "❌ Não aprovado",
    verificarNovamente: "Verificar novamente",
    trocarCnpj: "Cadastrar outro CNPJ",
    admin: {
      titulo: LOJA.id === "bradeco" ? "Lojistas (B2B)" : "Profissionais (B2B)",
      texto: profissionalAberta
        ? `Cadastros com CNPJ do site ${LOJA.nome}. Aprovar marca o cliente como profissional, para receber as condições exclusivas (cupons).`
        : `Cadastros com CNPJ do site ${LOJA.nome}. Aprovar libera os preços para o cliente.`,
      vazio: "Nenhum cadastro ainda.",
      aprovar: "Aprovar",
      recusar: "Recusar",
      pendente: "Pendente",
      aprovado: "Aprovado",
      recusadoRotulo: "Recusado",
    },
    afiliado: {
      titulo: "Programa de afiliados",
      texto:
        `Divulgue a ${LOJA.nome} com o seu link. Cada compra feita por ele rende comissão para você, e dá para acompanhar tudo por aqui.`,
      gerarLink: "Gerar meu link de afiliado",
      gerando: "Gerando…",
      seuLink: "Seu link de afiliado",
      copiar: "Copiar link",
      copiado: "✅ Link copiado!",
      comoUsar:
        "Cole este link nos seus vídeos, bio e stories. Quem comprar por ele nos próximos 30 dias conta como venda sua.",
      suaComissao: (pct: number) => `Sua comissão: ${pct}% por venda paga`,
      cardVendas: "Vendas",
      cardVendido: "Total vendido",
      cardComissao: "Sua comissão",
      graficoTitulo: "Vendas por mês",
      vendasRecentes: "Vendas recentes",
      semVendas: "Nenhuma venda pelo seu link ainda. Compartilhe para começar!",
      atualizar: "Atualizar",
      falha: "Não foi possível carregar agora. Tente de novo em instantes.",
      saqueTitulo: "Resgatar comissão",
      saqueTexto:
        "O valor disponível é enviado por Pix para a chave que você informar. Depois do pedido, a nossa equipe confirma o pagamento e o dinheiro chega em no máximo 2 dias.",
      saqueDisponivel: "Disponível para saque",
      saqueAguardando: "Aguardando pagamento",
      saqueRecebido: "Já recebido",
      saqueChavePix: "Sua chave Pix",
      saqueValor: "Valor do saque (R$)",
      saquePedir: "Pedir saque",
      saquePedindo: "Enviando pedido…",
      saqueOk: "✅ Pedido de saque enviado! O Pix chega em no máximo 2 dias e você recebe um e-mail quando ele sair.",
      saqueSemSaldo: "Você ainda não tem saldo para sacar.",
      saqueHistorico: "Seus saques",
      saqueStatusPendente: "⏳ Aguardando",
      saqueStatusPago: "✅ Pago",
      saqueStatusRecusado: "❌ Recusado",
      admin: {
        titulo: "Afiliados",
        texto:
          `Profissionais aprovados que divulgam a ${LOJA.nome}. Defina a comissão (%) de cada um e acompanhe as vendas.`,
        geralVendas: "Vendas por afiliados",
        geralVendido: "Total vendido",
        geralComissao: "Comissões a pagar",
        colComissao: "Comissão %",
        salvarPct: "Salvar",
        salvo: "✅",
        semCodigo: "ainda não gerou o link",
        vazio: "Nenhum afiliado ainda. Aprove cadastros na aba Profissionais.",
        ultimasVendas: "Últimas vendas por link de afiliado",
        saquesTitulo: "Pedidos de saque",
        saquesTexto:
          "Faça o Pix para a chave informada e marque como pago. Recusar devolve o valor ao saldo do afiliado.",
        saquesPendentes: "Saques pendentes",
        aPagar: "A pagar agora",
        marcarPago: "Marcar como pago",
        recusarSaque: "Recusar",
        semSaques: "Nenhum pedido de saque.",
      },
    },
  },
  afiliado: {
    paginaTitulo: "Área do afiliado",
    paginaTexto:
      `Divulgue a ${LOJA.nome} com o seu link e ganhe comissão em cada venda. Entre com o e-mail cadastrado: o acesso funciona em qualquer aparelho, sem senha.`,
    loginTitulo: "Entrar",
    loginTexto: "Digite o e-mail que você usou (ou vai usar) no cadastro de afiliado.",
    loginEmailRotulo: "E-mail",
    loginBotao: "Enviar código",
    loginEnviando: "Enviando código…",
    trocarEmail: "Usar outro e-mail",
    sair: "Sair",
    cadastroTitulo: "Cadastro de afiliado",
    cadastroTexto:
      "Só precisamos do seu nome e WhatsApp. O CNPJ é opcional. Depois de aprovado, você recebe um link só seu para divulgar.",
    formNome: "Seu nome",
    formWhatsapp: "WhatsApp",
    formCnpj: "CNPJ (opcional)",
    formCnpjDica: "Só preencha se divulgar como empresa. Pessoa física também pode ser afiliado.",
    enviar: "Enviar cadastro",
    enviando: "Enviando…",
    enviadoOk: "✅ Cadastro recebido! Vamos analisar e avisar por e-mail.",
    enviadoLiberado: "✅ CNPJ conferido na Receita Federal. Preços liberados neste navegador.",
    cnpjInvalido: "CNPJ inválido. Confira os 14 dígitos ou deixe o campo em branco.",
    falha: "Não foi possível enviar agora. Tente novamente em instantes.",
    statusPendenteTitulo: "⏳ Cadastro em análise",
    statusPendenteTexto: "Avisamos por e-mail assim que aprovarmos, geralmente em até 1 dia útil.",
    statusRecusadoTitulo: "❌ Cadastro não aprovado",
    statusRecusadoTexto: "Em caso de dúvida, fale com a gente: (21) 99732-2464.",
    verificarNovamente: "Verificar novamente",
    usuarioRotulo: "Usuário de vendedor",
    usuarioDica:
      "SÓ LETRAS MAIÚSCULAS, com pelo menos um número e um caractere especial (ex.: MARIA#22). É ele que identifica as suas vendas.",
    usuarioInvalido:
      "Usuário inválido. Use só LETRAS MAIÚSCULAS, com pelo menos um número e um caractere especial (ex.: MARIA#22).",
    loginUsuarioRotulo: "Seu usuário de vendedor",
    usuarioNaoConfere: "Usuário de vendedor não confere com este e-mail. Confira e tente de novo.",
    pixRotulo: "Sua chave Pix",
    pixDica: "Obrigatória: é nela que a sua comissão cai.",
    pixVazia: "Informe sua chave Pix (obrigatória para receber a comissão).",
    aviso: {
      entrouPeloLink: "Você entrou pelo link do vendedor",
      compraCreditada: "Informe esse usuário no pagamento para a compra contar para ele.",
    },
    conta: {
      titulo: "Programa de afiliados",
      texto:
        "Divulgue nossos produtos com os seus links e ganhe comissão em cada venda paga. A solicitação vai para o administrador aprovar.",
      botao: "Quero ser afiliado",
      senhaRotulo: "Confirme sua senha",
      senhaErrada: "Senha incorreta. Confira e tente de novo.",
      enviada: "✅ Solicitação enviada! Você recebe a resposta por e-mail.",
      pendente: "⏳ Sua solicitação está em análise",
      pendenteTexto: "O administrador vai aprovar e avisamos por e-mail, geralmente em até 1 dia útil.",
      recusada: "❌ Sua solicitação não foi aprovada",
      recusadaTexto: "Em caso de dúvida, fale com a gente: (21) 99732-2464.",
      aprovada: "✅ Você é afiliado!",
      aprovadaTexto: "Seu painel tem seus links, suas vendas, sua comissão e o pedido de saque.",
      abrirPainel: "Abrir meu painel de afiliado",
    },
    links: {
      titulo: "Links por produto",
      texto:
        "Cada produto tem um link só seu, que abre direto na página dele. Pesquise ou filtre por marca e copie o link do produto que você vai divulgar.",
      busca: "Pesquisar produto…",
      todasMarcas: "Todas as marcas",
      nenhum: "Nenhum produto encontrado com essa busca.",
      copiar: "Copiar link",
      copiado: "✅ Copiado!",
      maisResultados: (n: number) => `+${n} produtos. Refine a busca para achar o seu.`,
    },
    admin: {
      titulo: "Pedidos de afiliado",
      texto: "Cadastros pedindo entrada no programa de afiliados. O CNPJ é opcional aqui.",
      vazio: "Nenhum pedido de afiliado ainda.",
      aprovar: "Aprovar",
      recusar: "Recusar",
      excluir: "Excluir",
      pendente: "Pendente",
      aprovado: "Aprovado",
      recusadoRotulo: "Recusado",
      semCnpj: "sem CNPJ",
      novo: {
        abrir: "＋ Cadastrar afiliado",
        fechar: "Fechar cadastro",
        titulo: "Cadastrar afiliado",
        texto:
          "O afiliado já entra aprovado, com o link pronto, e recebe um e-mail com o link e as instruções. Usuário e chave Pix são opcionais: sem usuário, o sistema cria um; a chave Pix ele informa na hora de resgatar.",
        nome: "Nome",
        email: "E-mail",
        whatsapp: "WhatsApp",
        usuario: "Usuário de vendedor (opcional)",
        usuarioDica: "Ex.: MARIA#22 — maiúsculas, um número e um caractere especial",
        chavePix: "Chave Pix (opcional)",
        cnpj: "CNPJ (opcional)",
        comissao: "Comissão (%)",
        salvar: "Cadastrar afiliado",
        salvando: "Cadastrando…",
        pronto: "✅ Afiliado cadastrado e avisado por e-mail.",
        usuarioCriado: "Usuário de vendedor",
        link: "Link do afiliado",
      },
    },
  },
  atendimento: {
    buscaRotulo: "Buscar nas perguntas frequentes",
    buscaPlaceholder: "Ex.: troca, frete, rastreio…",
    nenhuma: (termo: string) =>
      `Nenhuma pergunta encontrada para "${termo}". Fale com a gente pelo WhatsApp.`,
  },
  loja3d: {
    titulo: "Loja 3D",
    descricao: (loja: string) => `Passeie pela ${loja} em 3D, de cesta na mão, e escolha seus produtos nas estantes das marcas.`,
    montando: "Montando a loja…",
    setores: "Setores da loja",
    visaoGeral: "Visão geral",
    destaques: "Destaques",
    dica: "Ande para a frente (W ou ↑) e a porta abre · arraste para olhar · clique no chão para ir até lá · clique num produto para ver · a Larissa está no caixa",
    dicaAlto: "Clique numa estante, num produto ou no chão para descer até lá · arraste para girar · rodinha para aproximar",
    // no celular e no tablet
    dicaToque: "Use a bolinha para andar · arraste para olhar · toque no chão para ir até lá · toque num produto para ver · a Larissa está no caixa",
    dicaAltoToque: "Toque numa estante, num produto ou no chão para descer até lá · arraste para girar · dois dedos para aproximar",
    naPrateleira: "Você chegou. Escolha seu produto.",
    soPaisagem: "A cidade é só paisagem: o passeio é na loja e na calçada da frente.",
    fechar: "Fechar",
    verTodos: (categoria: string) => `Ver tudo de ${categoria}`,
    verEmLista: "Ver a loja em lista",
    semWebgl: "Seu aparelho não conseguiu abrir a loja em 3D. Use a loja normal — os produtos e preços são os mesmos.",
    rotuloCena: "Loja em 3D: estantes com os produtos de cada marca",
    // logo na parede do fundo e na vitrine: a linha "destaque" é a grande
    logo:
      LOJA.id === "beautynow"
        ? [
            { texto: "BEAUTY", destaque: false },
            { texto: "NOW!", destaque: true },
          ]
        : LOJA.id === "be2beauty"
          ? [
              { texto: "BE2", sufixo: "BEAUTY", destaque: true },
              { texto: "ONLY PROFESSIONAL", destaque: false },
            ]
          : [{ texto: LOJA.nome.toUpperCase(), destaque: true }],
    fraseVitrine: LOJA.id === "beautynow" ? "Beleza que acontece agora." : LOJA.id === "be2beauty" ? "Only professional." : null,
    // a atendente do caixa (agente de vendas no WhatsApp)
    larissa: {
      nome: "Larissa",
      balao: ["Oi! Sou a Larissa", "Clique para conversar"] as [string, string],
      balaoToque: ["Oi! Sou a Larissa", "Toque para conversar"] as [string, string],
      titulo: "Oi! Eu sou a Larissa",
      texto: LOJA.b2b
        ? `Atendo salões e profissionais no WhatsApp da ${LOJA.nome}: tiro dúvidas, indico linhas e fecho seu pedido com você.`
        : `Atendo no WhatsApp da ${LOJA.nome}: tiro dúvidas, indico produtos para o seu cabelo e a sua pele e fecho o pedido com você.`,
      botao: "Falar com a Larissa no WhatsApp",
      continuar: "Continuar passeando",
      fechar: "Fechar a conversa com a Larissa",
      mensagem: (itens: string[]) =>
        itens.length
          ? `Oi, Larissa! Estou na loja 3D do site e coloquei na cesta: ${itens.join(", ")}. Pode me ajudar a fechar?`
          : "Oi, Larissa! Estou na loja 3D do site e queria uma ajuda para escolher.",
    },
    guia: {
      botao: "Onde fica?",
      rotulo: "Procurar um produto ou marca na loja",
      placeholder: "Produto ou marca",
      semResultado: "Não achei isso na loja 3D.",
      marca: "Marca",
      seguindo: (nome: string) => `Siga as setas até ${nome}`,
      meLeva: "Me leva até lá",
      parar: "Parar o guia",
      chegou: "É aqui!",
    },
    som: { ligar: "Ligar o som", desligar: "Tirar o som" },
    // ficha do produto: no balão do mouse e no card
    ficha: {
      tipo: "Tipo",
      para: "Público",
      cabelo: "Cabelo",
      pele: "Pele",
      acao: "Ação",
      acabamento: "Acabamento",
      tom: "Tom",
      tamanho: "Tamanho",
      noPix: "no Pix",
      clique: "Clique para ver e comprar",
    },
    // celular: a loja 3D ocupa a tela toda, com sacola e saída dentro dela
    telaCheia: "Tela cheia",
    sairTelaCheia: "Sair da tela cheia",
    sair: "Sair da loja 3D",
    sacola: (itens: number) => (itens ? `Sacola, ${itens} ${itens === 1 ? "item" : "itens"}` : "Sacola"),
  },
  naoEncontrada: {
    procurando: "Procurando a página…",
    titulo: "Página não encontrada",
    texto: "O endereço pode ter mudado. Comece pela página inicial ou pelos mais vendidos.",
    inicio: "Ir para a página inicial",
  },
  busca: {
    titulo: "Resultados para",
    placeholder: "Buscar produto, marca ou necessidade",
    nenhum: (termo: string) =>
      `Nenhum resultado para "${termo}". Confira a digitação ou navegue pelas categorias.`,
    sugestoes: "Sugestões",
    verTodos: "Ver todos os resultados",
    aproximado: (termo: string) =>
      `Não achamos produtos com tudo o que você digitou em "${termo}". Estes são os mais parecidos:`,
    tipoMarca: "Marca",
    tipoCategoria: "Categoria",
    explorar: "Ver mais vendidos",
  },
  conta: {
    titulo: "Minha conta",
    entrar: "Entrar",
    entrarTitulo: "Entrar na sua conta",
    criarConta: "Criar conta",
    criarTitulo: "Criar sua conta",
    email: "E-mail",
    senha: "Senha",
    senhaDica: "Mínimo de 8 caracteres",
    nome: "Nome completo",
    cep: "CEP",
    numero: "Número da residência",
    complemento: "Complemento (opcional)",
    botaoEntrar: "Entrar",
    /** acesso ao painel só com o código (ADMINS_POR_CODIGO) */
    botaoEnviarCodigo: "Enviar código",
    acessoPorCodigo: "Acesso ao painel: enviamos um código de 6 dígitos para este e-mail. Não precisa de senha.",
    botaoEntrando: "Enviando código…",
    botaoCriar: "Criar conta",
    botaoCriando: "Criando conta…",
    botaoConfirmando: "Confirmando…",
    aguardeServidor: "Conectando ao servidor. A primeira vez do dia pode levar até 1 minuto.",
    entrarComGoogle: "Entrar com o Google",
    ou: "ou",
    aindaSemConta: "Ainda não tem conta?",
    jaTemConta: "Já tem conta?",
    codigoTitulo: "Confirme que é você",
    codigoTexto: (email: string) =>
      `Enviamos um código de 6 dígitos para ${email}. Digite-o abaixo para concluir o login.`,
    codigoRotulo: "Código de verificação",
    codigoBotao: "Confirmar código",
    codigoVoltar: "Voltar e tentar outro e-mail",
    codigoEnviado: "✅ Código enviado! Confira sua caixa de entrada (e o spam).",
    codigoReenviado: "✅ Novo código enviado! Confira sua caixa de entrada (e o spam).",
    codigoNaoEnviado: "❌ Não foi possível enviar o código.",
    codigoReenviar: "Reenviar código",
    codigoReenviando: "Reenviando…",
    codigoReenviarEm: (s: number) => `Reenviar código em ${s}s`,
    codigoDemoAviso:
      "Modo demonstração: sem servidor de e-mail, o código aparece aqui. Na versão final ele chega na sua caixa de entrada.",
    codigoDemoRotulo: "Seu código",
    ola: (nome: string) => `Olá, ${nome.split(" ")[0]}!`,
    favoritos: "Meus favoritos",
    favoritosVazio: "Você ainda não favoritou nenhum produto. Toque no coração dos produtos que amar.",
    favoritar: "Adicionar aos favoritos",
    desfavoritar: "Remover dos favoritos",
    meusDados: "Meus dados",
    endereco: "Endereço",
    semEndereco: "Nenhum endereço cadastrado.",
    contaGoogle: "Conta conectada via Google",
    sair: "Sair da conta",
    painelAdmin: "Painel do administrador",
    admin: {
      titulo: `Painel ${LOJA.nome}`,
      subtitulo: "Área restrita do administrador.",
      catalogo: "Catálogo",
      produtos: "produtos ativos",
      marcas: "marcas",
      esgotados: "esgotados",
      pedidos: "Pedidos",
      pedidosVazio:
        "Os pedidos reais aparecem aqui quando o site estiver conectado ao painel/ERP via API.",
      cupons: "Cupons",
      cuponsTexto:
        "Crie códigos de desconto para campanhas. O cliente digita o código na sacola e o desconto entra antes do Pix.",
      cupomCodigo: "Código",
      cupomTipo: "Tipo",
      cupomPercentual: "Percentual (%)",
      cupomValorFixo: "Valor fixo (R$)",
      cupomValor: "Valor",
      cupomMinimo: "Pedido mínimo (R$)",
      cupomAtivo: "Ativo",
      cupomInativo: "Inativo",
      atualizarCatalogo: {
        botao: "Atualizar catálogo agora",
        enviando: "Enviando pedido…",
        dica: "Puxa produtos, preços e fotos do painel Suprir sem esperar a atualização diária.",
        pedido: (h: string) => `Pedido feito às ${h}. O robô começa em até 10 minutos.`,
        andamento: (h: string) =>
          `Atualizando desde ${h}. As quatro lojas ficam prontas em cerca de 15 minutos.`,
        resultado: {
          publicado: (h: string) => `Última atualização: ${h} — catálogo novo publicado nas lojas.`,
          "sem-novidade": (h: string) => `Última atualização: ${h} — nada mudou no painel Suprir.`,
          falhou: (h: string) => `A atualização de ${h} falhou. Tente de novo; se repetir, me avise.`,
        },
        erro: "Não consegui falar com o servidor. Aguarde uns segundos e tente de novo.",
      },
      cupomCriar: "Criar cupom",
      cupomCarregando: "Carregando cupons…",
      cupomSalvando: "Salvando…",
      cupomErroCarregar: "Não consegui carregar os cupons do servidor. Aguarde uns segundos e recarregue a página.",
      cupomErroSalvar: "Não consegui salvar no servidor. Tente de novo.",
      cupomExcluir: "Excluir",
      cupomVazio: "Nenhum cupom cadastrado ainda.",
      clientes: "Contas de cliente",
      clientesTexto: (n: number) =>
        n === 1 ? "1 conta criada nesta demonstração." : `${n} contas criadas nesta demonstração.`,
      acessoNegado: "Esta área é restrita. Entre com a conta de administrador.",
    },
  },
} as const;
