/**
 * Catálogo de demonstração (Sprint 1.5 — seed de dados).
 * Marcas e produtos fictícios, criados para a demo — na integração real
 * este módulo é substituído pela réplica do Bling via Medusa.
 */
import type { Categoria, Marca, Necessidade, Produto } from "./tipos";

export const categorias: Categoria[] = [
  { slug: "cabelos", nome: "Cabelos", descricao: "Shampoo, máscara, leave-in e tratamento profissional para todo tipo de cabelo." },
  { slug: "maquiagem", nome: "Maquiagem", descricao: "Base, batom e acabamento profissional para o dia a dia." },
  { slug: "perfumaria", nome: "Perfumaria", descricao: "Fragrâncias marcantes para todos os momentos." },
  { slug: "corpo-e-banho", nome: "Corpo e Banho", descricao: "Hidratação e cuidado da pele do corpo, do banho ao pós-sol." },
  { slug: "masculino", nome: "Masculino", descricao: "Cuidado completo para cabelo, barba e pele masculina." },
];

export const marcas: Marca[] = [
  { slug: "keralab", nome: "KeraLab Professional", cor: "#7C3AED", descricao: "Tratamento capilar profissional com tecnologia de reconstrução de queratina. A marca preferida dos salões que atendemos há 15 anos." },
  { slug: "nuvelle", nome: "Nuvelle", cor: "#0EA5A4", descricao: "Finalizadores e leave-ins leves, pensados para o clima brasileiro. Fórmulas veganas e sem sulfato." },
  { slug: "floratta", nome: "Floratta", cor: "#E8467C", descricao: "Perfumaria e corpo com notas florais brasileiras e fixação de eau de parfum." },
  { slug: "urbanman", nome: "Urban Man", cor: "#2B4C7E", descricao: "Linha masculina completa: cabelo, barba e pele, sem complicação." },
  { slug: "colorpro", nome: "ColorPro Studio", cor: "#DC2626", descricao: "Maquiagem de alta pigmentação com acabamento profissional." },
];

export const necessidades: Necessidade[] = [
  { slug: "anti-frizz", nome: "Anti-frizz" },
  { slug: "hidratacao", nome: "Hidratação" },
  { slug: "reconstrucao", nome: "Reconstrução" },
  { slug: "cabelo-com-quimica", nome: "Cabelo com química" },
  { slug: "definicao-de-cachos", nome: "Definição de cachos" },
];

export const produtos: Produto[] = [
  {
    slug: "keralab-shampoo-reconstrutor-queratina",
    titulo: "Shampoo Reconstrutor Queratina Force",
    marca: "keralab",
    linha: "Queratina Force",
    categorias: ["cabelos"],
    descricao:
      "Shampoo de reconstrução profunda para cabelos danificados por química, descoloração ou calor. A queratina hidrolisada penetra na fibra e devolve resistência desde a primeira lavagem, sem pesar.",
    beneficios: [
      "Reconstrói a fibra capilar em 4 semanas de uso",
      "Reduz a quebra em até 80%",
      "Sem sulfato: limpa sem agredir",
      "Compatível com progressiva e coloração",
    ],
    modoDeUso: [
      "Aplique no cabelo molhado e massageie o couro cabeludo.",
      "Deixe agir por 2 minutos para a queratina penetrar.",
      "Enxágue bem e repita se necessário.",
      "Use com a Máscara Queratina Force para potencializar o resultado.",
    ],
    composicao:
      "Aqua, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Hydrolyzed Keratin, Panthenol, Glycerin, Citric Acid, Parfum.",
    especificacoes: {
      Volume: "300ml",
      "Tipo de cabelo": "Todos, especialmente com química",
      "Sem sulfato": "Sim",
      "Sem parabeno": "Sim",
      Vegano: "Não",
      "Registro ANVISA": "Isento nos termos da RDC 907/2024",
    },
    atributos: {
      tipoCabelo: ["liso", "ondulado", "cacheado", "crespo"],
      necessidade: ["reconstrucao", "cabelo-com-quimica"],
      semSulfato: true,
      semSilicone: false,
      vegano: false,
      crueltyFree: true,
    },
    variantes: [
      { sku: "KL-SH-QF-300", tituloVariacao: "300ml", precoDe: 12990, precoPor: 8990, estoque: 42, pesoG: 380 },
      { sku: "KL-SH-QF-1000", tituloVariacao: "1 litro", precoDe: 29990, precoPor: 23990, estoque: 11, pesoG: 1120 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Salvou meu cabelo descolorido", texto: "Fiz mechas e meu cabelo estava elástico. Com um mês de uso a quebra parou. Uso junto com a máscara da linha.", autor: "Rafaela M.", data: "2026-07-02", compraVerificada: true },
      { nota: 5, titulo: "Cheiro ótimo e rende muito", texto: "O de 1 litro dura meses. Não pesa mesmo lavando dia sim, dia não.", autor: "Juliana S.", data: "2026-06-18", compraVerificada: true },
      { nota: 4, titulo: "Bom, mas precisa da máscara", texto: "Sozinho ele limpa bem, mas o resultado de reconstrução mesmo vem com a linha completa.", autor: "Carla T.", data: "2026-05-30", compraVerificada: true },
    ],
    compreJunto: ["keralab-mascara-queratina-force", "nuvelle-leave-in-termoprotetor"],
    maisVendido: true,
    visual: { corA: "#7C3AED", corB: "#A78BFA", forma: "frasco" },
  },
  {
    slug: "keralab-mascara-queratina-force",
    titulo: "Máscara de Tratamento Queratina Force",
    marca: "keralab",
    linha: "Queratina Force",
    categorias: ["cabelos"],
    descricao:
      "Máscara de reconstrução intensiva com queratina hidrolisada e pantenol. Uso semanal para cabelos com química; quinzenal para cabelos naturais que precisam de força.",
    beneficios: [
      "Ação reconstrutora em 5 minutos de pausa",
      "Devolve elasticidade e brilho",
      "Sela as cutículas e reduz o frizz",
    ],
    modoDeUso: [
      "Após o shampoo, retire o excesso de água.",
      "Aplique mecha a mecha, do comprimento às pontas.",
      "Deixe agir por 5 a 10 minutos.",
      "Enxágue completamente.",
    ],
    composicao:
      "Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Hydrolyzed Keratin, Panthenol, Butyrospermum Parkii Butter, Parfum.",
    especificacoes: {
      Volume: "500g",
      "Tipo de cabelo": "Danificados e com química",
      "Sem sulfato": "Sim",
      Vegano: "Não",
    },
    atributos: {
      tipoCabelo: ["liso", "ondulado", "cacheado", "crespo"],
      necessidade: ["reconstrucao", "hidratacao", "cabelo-com-quimica"],
      semSulfato: true,
      crueltyFree: true,
    },
    variantes: [
      { sku: "KL-MA-QF-500", tituloVariacao: "500g", precoDe: 15990, precoPor: 11990, estoque: 28, pesoG: 620 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Efeito de salão em casa", texto: "Cabelo alinhado e forte. Uso toda semana depois da progressiva.", autor: "Patrícia L.", data: "2026-07-11", compraVerificada: true },
      { nota: 5, titulo: "Rende e funciona", texto: "Pouca quantidade já faz efeito. O pote de 500g durou 3 meses.", autor: "Amanda R.", data: "2026-06-01", compraVerificada: true },
    ],
    compreJunto: ["keralab-shampoo-reconstrutor-queratina", "keralab-ampola-choque-queratina"],
    maisVendido: true,
    visual: { corA: "#6D28D9", corB: "#C4B5FD", forma: "pote" },
  },
  {
    slug: "keralab-ampola-choque-queratina",
    titulo: "Ampola de Choque Queratina Force",
    marca: "keralab",
    linha: "Queratina Force",
    categorias: ["cabelos"],
    descricao:
      "Tratamento de choque em dose única para SOS capilar: pré-química, pós-descoloração ou antes de um evento. Resultado imediato em uma aplicação.",
    beneficios: ["Reconstrução expressa em 3 minutos", "Brilho imediato", "Dose única higiênica"],
    modoDeUso: [
      "Após o shampoo, aplique todo o conteúdo no cabelo úmido.",
      "Massageie e deixe agir por 3 minutos.",
      "Enxágue bem.",
    ],
    composicao: "Aqua, Cetearyl Alcohol, Hydrolyzed Keratin, Arginine, Panthenol, Parfum.",
    especificacoes: { Volume: "15ml", "Tipo de cabelo": "Danificados", Uso: "Semanal ou SOS" },
    atributos: { tipoCabelo: ["liso", "ondulado", "cacheado", "crespo"], necessidade: ["reconstrucao"], crueltyFree: true },
    variantes: [
      { sku: "KL-AM-QF-15", tituloVariacao: "15ml", precoDe: null, precoPor: 1990, estoque: 120, pesoG: 40 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Uso antes de festa", texto: "Cabelo de comercial na hora. Sempre tenho uma na gaveta.", autor: "Bianca F.", data: "2026-06-25", compraVerificada: true },
    ],
    compreJunto: ["keralab-mascara-queratina-force"],
    visual: { corA: "#8B5CF6", corB: "#DDD6FE", forma: "ampola" },
  },
  {
    slug: "nuvelle-leave-in-termoprotetor",
    titulo: "Leave-in Termoprotetor Leveza 230°",
    marca: "nuvelle",
    linha: "Leveza",
    categorias: ["cabelos"],
    descricao:
      "Leave-in vegano de proteção térmica até 230°C, com blend de óleos leves que desmaia o frizz sem deixar o cabelo oleoso. O finalizador coringa para escova, chapinha e dia a dia.",
    beneficios: [
      "Proteção térmica até 230°C",
      "Anti-frizz por até 48h",
      "Fórmula vegana e sem silicone",
      "Não pesa em cabelos finos",
    ],
    modoDeUso: [
      "Borrife no cabelo úmido, a 20cm de distância.",
      "Distribua com pente ou com os dedos.",
      "Finalize como preferir: escova, difusor ou natural.",
    ],
    composicao: "Aqua, Glycerin, Coco-Caprylate, Argania Spinosa Kernel Oil, Panthenol, Parfum.",
    especificacoes: {
      Volume: "200ml",
      "Proteção térmica": "Até 230°C",
      Vegano: "Sim",
      "Sem silicone": "Sim",
    },
    atributos: {
      tipoCabelo: ["liso", "ondulado", "cacheado"],
      necessidade: ["anti-frizz", "hidratacao"],
      semSilicone: true,
      vegano: true,
      crueltyFree: true,
    },
    variantes: [
      { sku: "NV-LI-LV-200", tituloVariacao: "200ml", precoDe: 8990, precoPor: 6990, estoque: 63, pesoG: 260 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "O melhor leave-in leve", texto: "Cabelo fino e oleoso: esse é o único que não pesa. Frizz sumiu.", autor: "Larissa P.", data: "2026-07-20", compraVerificada: true },
      { nota: 4, titulo: "Bom custo-benefício", texto: "Protege bem da chapinha e cheira muito bem. Só queria embalagem maior.", autor: "Renata G.", data: "2026-07-01", compraVerificada: true },
      { nota: 5, titulo: "Recompro sempre", texto: "Terceiro frasco. Virou passo fixo da minha rotina.", autor: "Márcia A.", data: "2026-05-14", compraVerificada: true },
    ],
    compreJunto: ["nuvelle-creme-cachos-definidos", "keralab-shampoo-reconstrutor-queratina"],
    maisVendido: true,
    visual: { corA: "#0EA5A4", corB: "#5EEAD4", forma: "spray" },
  },
  {
    slug: "nuvelle-creme-cachos-definidos",
    titulo: "Creme de Pentear Cachos Definidos",
    marca: "nuvelle",
    linha: "Cachos",
    categorias: ["cabelos"],
    descricao:
      "Creme de pentear com manteiga de karité e óleo de coco para definição de cachos 2C a 4C. Fórmula low poo, vegana, com fixação flexível — cacho definido que balança.",
    beneficios: ["Definição sem efeito casquinha", "Hidratação por 72h", "Liberado para low poo e no poo"],
    modoDeUso: [
      "No cabelo molhado, aplique mecha a mecha amassando de baixo para cima.",
      "Finalize com difusor ou deixe secar naturalmente.",
    ],
    composicao: "Aqua, Cetearyl Alcohol, Butyrospermum Parkii Butter, Cocos Nucifera Oil, Glycerin, Parfum.",
    especificacoes: {
      Volume: "300g",
      "Tipo de cabelo": "Ondulados, cacheados e crespos",
      "Low/No poo": "Sim",
      Vegano: "Sim",
    },
    atributos: {
      tipoCabelo: ["ondulado", "cacheado", "crespo"],
      necessidade: ["definicao-de-cachos", "hidratacao"],
      semSilicone: true,
      semSulfato: true,
      vegano: true,
      crueltyFree: true,
    },
    variantes: [
      { sku: "NV-CP-CD-300", tituloVariacao: "300g", precoDe: null, precoPor: 5490, estoque: 3, pesoG: 360 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Definição real", texto: "Cacho 3B definido do dia 1 ao dia 3. Sem casquinha, sem pesar.", autor: "Camila V.", data: "2026-07-15", compraVerificada: true },
      { nota: 5, titulo: "Melhor creme que já usei", texto: "E olha que já testei uns dez. O cheiro é maravilhoso.", autor: "Taís N.", data: "2026-06-20", compraVerificada: true },
    ],
    compreJunto: ["nuvelle-leave-in-termoprotetor"],
    lancamento: true,
    visual: { corA: "#0D9488", corB: "#99F6E4", forma: "pote" },
  },
  {
    slug: "keralab-acidificante-ph-balance",
    titulo: "Acidificante Capilar pH Balance",
    marca: "keralab",
    linha: "Tech",
    categorias: ["cabelos"],
    descricao:
      "Acidificante profissional que sela as cutículas e equilibra o pH após química, descoloração ou banho de mar e piscina. O passo técnico que segura o resultado do tratamento.",
    beneficios: ["Sela cutículas abertas", "Prolonga o efeito de progressivas e colorações", "Brilho espelhado"],
    modoDeUso: [
      "Após o shampoo, aplique no comprimento e pontas.",
      "Deixe agir por 5 minutos e enxágue.",
      "Use 1x por semana ou após exposição a piscina/mar.",
    ],
    composicao: "Aqua, Cetearyl Alcohol, Citric Acid, Lactic Acid, Panthenol, Parfum.",
    especificacoes: { Volume: "250g", pH: "3.5", Uso: "Semanal" },
    atributos: {
      tipoCabelo: ["liso", "ondulado", "cacheado", "crespo"],
      necessidade: ["cabelo-com-quimica", "reconstrucao"],
      crueltyFree: true,
    },
    variantes: [
      { sku: "KL-AC-PH-250", tituloVariacao: "250g", precoDe: 9990, precoPor: 7990, estoque: 0, pesoG: 310 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Indispensável pós-progressiva", texto: "Minha progressiva durou o dobro usando toda semana.", autor: "Vanessa K.", data: "2026-06-10", compraVerificada: true },
    ],
    visual: { corA: "#5B21B6", corB: "#A78BFA", forma: "tubo" },
  },
  {
    slug: "floratta-eau-de-parfum-flor-de-ipe",
    titulo: "Eau de Parfum Flor de Ipê",
    marca: "floratta",
    linha: "Brasilis",
    categorias: ["perfumaria"],
    descricao:
      "Floral frutal com saída de pera e mandarina, coração de flor de ipê e fundo de baunilha com almíscar. Fixação de 8 horas, rastro presente sem ser invasivo.",
    beneficios: ["Concentração eau de parfum (15%)", "Fixação de até 8h", "Notas florais brasileiras"],
    modoDeUso: [
      "Borrife nos pontos de pulsação: pulsos, pescoço e atrás das orelhas.",
      "Não esfregue — deixe a fragrância evoluir na pele.",
    ],
    composicao: "Alcohol, Parfum, Aqua, Linalool, Limonene, Citronellol.",
    especificacoes: {
      Volume: "75ml",
      Concentração: "Eau de Parfum",
      "Família olfativa": "Floral frutal",
      Gênero: "Feminino",
    },
    atributos: { crueltyFree: true },
    variantes: [
      { sku: "FL-EP-FI-75", tituloVariacao: "75ml", precoDe: 21990, precoPor: 17990, estoque: 19, pesoG: 320 },
      { sku: "FL-EP-FI-30", tituloVariacao: "30ml", precoDe: null, precoPor: 9990, estoque: 27, pesoG: 160 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Recebo elogio toda vez", texto: "Perfume de mulher elegante. Fixa o dia inteiro na minha pele.", autor: "Helena Q.", data: "2026-07-25", compraVerificada: true },
      { nota: 5, titulo: "Meu perfume de assinatura", texto: "Comprei o de 30ml para testar e voltei para o grande.", autor: "Núbia W.", data: "2026-06-28", compraVerificada: true },
    ],
    maisVendido: true,
    visual: { corA: "#E8467C", corB: "#FBCFE8", forma: "frasco" },
  },
  {
    slug: "floratta-hidratante-corporal-karite",
    titulo: "Creme Hidratante Corporal Karité & Amêndoas",
    marca: "floratta",
    linha: "Corpo",
    categorias: ["corpo-e-banho"],
    descricao:
      "Hidratação intensa por 48h com manteiga de karité e óleo de amêndoas doces. Textura rica que absorve rápido, com a fragrância suave da linha Brasilis.",
    beneficios: ["Hidratação comprovada por 48h", "Absorção em 1 minuto", "Perfumação delicada"],
    modoDeUso: ["Aplique no corpo após o banho, massageando até absorver."],
    composicao: "Aqua, Glycerin, Butyrospermum Parkii Butter, Prunus Amygdalus Dulcis Oil, Cetearyl Alcohol, Parfum.",
    especificacoes: { Volume: "400ml", "Tipo de pele": "Seca a extrasseca", Vegano: "Sim" },
    atributos: { tipoPele: ["seca", "normal"], vegano: true, crueltyFree: true },
    variantes: [
      { sku: "FL-HC-KA-400", tituloVariacao: "400ml", precoDe: 5990, precoPor: 4490, estoque: 71, pesoG: 460 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Cheirosa o dia todo", texto: "Hidrata muito e o cheiro fica na pele. Uso todo dia depois do banho.", autor: "Rosana E.", data: "2026-07-12", compraVerificada: true },
      { nota: 4, titulo: "Muito bom", texto: "Textura gostosa, absorve rápido. Só acho a tampa dura de abrir.", autor: "Lívia H.", data: "2026-06-05", compraVerificada: true },
    ],
    compreJunto: ["floratta-eau-de-parfum-flor-de-ipe"],
    visual: { corA: "#DB2777", corB: "#FCE7F3", forma: "pote" },
  },
  {
    slug: "colorpro-base-liquida-hd",
    titulo: "Base Líquida HD Cobertura Natural",
    marca: "colorpro",
    linha: "HD",
    categorias: ["maquiagem"],
    descricao:
      "Base líquida de cobertura média construível com acabamento natural. Fórmula oil-free com ácido hialurônico, disponível em 12 tons com subtons quente, frio e neutro.",
    beneficios: ["12 tons para pele brasileira", "Não craquela nem marca linhas", "Oil-free: não obstrui poros"],
    modoDeUso: [
      "Aplique com esponja úmida ou pincel, do centro do rosto para fora.",
      "Construa a cobertura em camadas finas.",
    ],
    composicao: "Aqua, Cyclopentasiloxane, Titanium Dioxide, Sodium Hyaluronate, Dimethicone.",
    especificacoes: { Volume: "30ml", Cobertura: "Média construível", Acabamento: "Natural", "Oil-free": "Sim" },
    atributos: { tipoPele: ["oleosa", "mista", "normal"], crueltyFree: true },
    variantes: [
      { sku: "CP-BL-HD-120", tituloVariacao: "Tom 120 · claro neutro", precoDe: null, precoPor: 8990, estoque: 15, pesoG: 110 },
      { sku: "CP-BL-HD-240", tituloVariacao: "Tom 240 · médio quente", precoDe: null, precoPor: 8990, estoque: 22, pesoG: 110 },
      { sku: "CP-BL-HD-360", tituloVariacao: "Tom 360 · escuro neutro", precoDe: null, precoPor: 8990, estoque: 9, pesoG: 110 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Achei meu tom!", texto: "Finalmente uma base nacional com subtom certo. O 240 é perfeito para pele morena dourada.", autor: "Yasmin O.", data: "2026-07-19", compraVerificada: true },
      { nota: 4, titulo: "Boa cobertura", texto: "Cobre bem sem pesar. Dura umas 8 horas na minha pele mista.", autor: "Priscila U.", data: "2026-06-30", compraVerificada: true },
    ],
    lancamento: true,
    visual: { corA: "#DC2626", corB: "#FECACA", forma: "frasco" },
  },
  {
    slug: "colorpro-batom-matte-vermelho-carmim",
    titulo: "Batom Matte Longa Duração Vermelho Carmim",
    marca: "colorpro",
    linha: "Matte",
    categorias: ["maquiagem"],
    descricao:
      "Batom matte de altíssima pigmentação com até 12h de duração. Fórmula cremosa na aplicação que seca em segundos sem repuxar os lábios.",
    beneficios: ["Cobertura total em uma passada", "Até 12h sem retoque", "Com vitamina E: não resseca"],
    modoDeUso: ["Aplique direto do bastão ou com pincel para maior precisão."],
    composicao: "Ricinus Communis Seed Oil, Cera Alba, Tocopherol, CI 15850, CI 77491.",
    especificacoes: { Peso: "3,5g", Acabamento: "Matte", Duração: "12h" },
    atributos: { vegano: false, crueltyFree: true },
    variantes: [
      { sku: "CP-BM-VC-35", tituloVariacao: "3,5g", precoDe: 4490, precoPor: 3490, estoque: 37, pesoG: 30 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Vermelho perfeito", texto: "Não sai nem comendo pizza. O vermelho é elegante, puxado pro frio.", autor: "Gabriela X.", data: "2026-07-07", compraVerificada: true },
    ],
    compreJunto: ["colorpro-base-liquida-hd"],
    visual: { corA: "#B91C1C", corB: "#FCA5A5", forma: "tubo" },
  },
  {
    slug: "urbanman-shampoo-cabelo-barba-3em1",
    titulo: "Shampoo Cabelo e Barba 3 em 1",
    marca: "urbanman",
    linha: "Essentials",
    categorias: ["masculino", "cabelos"],
    descricao:
      "Limpa cabelo, barba e corpo com uma fórmula só. Mentol refrescante, limpeza eficiente e zero ressecamento. O básico bem feito para quem quer praticidade.",
    beneficios: ["3 em 1: cabelo, barba e corpo", "Sensação refrescante de mentol", "Uso diário"],
    modoDeUso: ["Aplique no cabelo, barba e corpo molhados, massageie e enxágue."],
    composicao: "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Menthol, Parfum.",
    especificacoes: { Volume: "250ml", Uso: "Diário", Mentolado: "Sim" },
    atributos: { tipoCabelo: ["liso", "ondulado", "cacheado", "crespo"], crueltyFree: true },
    variantes: [
      { sku: "UM-SH-3E1-250", tituloVariacao: "250ml", precoDe: null, precoPor: 3990, estoque: 82, pesoG: 300 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Prático e cheiroso", texto: "Um produto só no banho. A sensação de gelado é ótima no calor.", autor: "Rodrigo N.", data: "2026-07-21", compraVerificada: true },
      { nota: 4, titulo: "Cumpre o que promete", texto: "Barba mais macia e cabelo limpo. Preço justo.", autor: "Felipe J.", data: "2026-06-19", compraVerificada: true },
    ],
    compreJunto: ["urbanman-oleo-barba-premium"],
    maisVendido: true,
    visual: { corA: "#2B4C7E", corB: "#93C5FD", forma: "frasco" },
  },
  {
    slug: "urbanman-oleo-barba-premium",
    titulo: "Óleo para Barba Premium Amadeirado",
    marca: "urbanman",
    linha: "Barba",
    categorias: ["masculino"],
    descricao:
      "Blend de óleos de argan e jojoba que amacia a barba, alinha os fios e hidrata a pele por baixo, com fragrância amadeirada discreta que não compete com o perfume.",
    beneficios: ["Barba macia e alinhada", "Acaba com a coceira", "Fragrância amadeirada sutil"],
    modoDeUso: ["Com a barba seca ou levemente úmida, aplique 3 a 5 gotas e distribua com pente."],
    composicao: "Argania Spinosa Kernel Oil, Simmondsia Chinensis Seed Oil, Tocopherol, Parfum.",
    especificacoes: { Volume: "30ml", Fragrância: "Amadeirada", Vegano: "Sim" },
    atributos: { vegano: true, crueltyFree: true },
    variantes: [
      { sku: "UM-OB-PR-30", tituloVariacao: "30ml", precoDe: 6990, precoPor: 5490, estoque: 26, pesoG: 80 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Barba de comercial", texto: "Coceira sumiu na primeira semana. O cheiro é discreto e masculino.", autor: "André Z.", data: "2026-07-10", compraVerificada: true },
    ],
    compreJunto: ["urbanman-shampoo-cabelo-barba-3em1"],
    visual: { corA: "#1E3A8A", corB: "#BFDBFE", forma: "ampola" },
  },
  {
    slug: "floratta-sabonete-liquido-lavanda",
    titulo: "Sabonete Líquido Corporal Lavanda Relax",
    marca: "floratta",
    linha: "Banho",
    categorias: ["corpo-e-banho"],
    descricao:
      "Sabonete líquido com óleo essencial de lavanda e glicerina vegetal. Limpa sem ressecar e transforma o banho do fim do dia em ritual de desacelerar.",
    beneficios: ["Aromaterapia com lavanda verdadeira", "Não resseca a pele", "Espuma cremosa"],
    modoDeUso: ["Aplique na pele molhada com as mãos ou esponja, massageie e enxágue."],
    composicao: "Aqua, Sodium Laureth Sulfate, Glycerin, Lavandula Angustifolia Oil, Citric Acid.",
    especificacoes: { Volume: "300ml", Fragrância: "Lavanda", Vegano: "Sim" },
    atributos: { tipoPele: ["normal", "seca"], vegano: true, crueltyFree: true },
    variantes: [
      { sku: "FL-SL-LA-300", tituloVariacao: "300ml", precoDe: null, precoPor: 2990, estoque: 94, pesoG: 350 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Banho de spa", texto: "O cheiro de lavanda é real, não artificial. Relaxa demais.", autor: "Cristina Y.", data: "2026-07-04", compraVerificada: true },
    ],
    compreJunto: ["floratta-hidratante-corporal-karite"],
    visual: { corA: "#C026D3", corB: "#F5D0FE", forma: "frasco" },
  },
  {
    slug: "keralab-kit-cronograma-capilar",
    titulo: "Kit Cronograma Capilar Completo",
    marca: "keralab",
    linha: "Queratina Force",
    categorias: ["cabelos"],
    descricao:
      "O cronograma capilar pronto: shampoo reconstrutor, máscara de tratamento e ampola de choque da linha Queratina Force, com economia de 20% sobre os itens avulsos.",
    beneficios: ["3 produtos com 20% de economia", "Cronograma de 4 semanas incluso no manual", "Para cabelos com química ou danificados"],
    modoDeUso: [
      "Semanas 1 e 3: shampoo + máscara (hidratação/reconstrução).",
      "Semana 2: shampoo + ampola de choque.",
      "Semana 4: linha completa no mesmo banho.",
    ],
    composicao: "Ver composição individual de cada produto do kit.",
    especificacoes: { Conteúdo: "Shampoo 300ml + Máscara 500g + Ampola 15ml", Economia: "20% vs. avulso" },
    atributos: {
      tipoCabelo: ["liso", "ondulado", "cacheado", "crespo"],
      necessidade: ["reconstrucao", "hidratacao", "cabelo-com-quimica"],
      crueltyFree: true,
    },
    variantes: [
      { sku: "KL-KIT-CRO-01", tituloVariacao: "Kit 3 itens", precoDe: 22970, precoPor: 18390, estoque: 14, pesoG: 1080 },
    ],
    avaliacoes: [
      { nota: 5, titulo: "Cronograma sem pensar", texto: "Vem tudo e ainda ensina a ordem. Meu cabelo mudou em um mês.", autor: "Tainá B.", data: "2026-07-23", compraVerificada: true },
      { nota: 5, titulo: "Presente perfeito", texto: "Dei para minha irmã que fez luzes. Ela amou o resultado.", autor: "Luana V.", data: "2026-07-01", compraVerificada: true },
    ],
    maisVendido: true,
    visual: { corA: "#7C3AED", corB: "#F0ABFC", forma: "pote" },
  },
];
