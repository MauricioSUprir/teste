import type { EvidenceId, SuspectId } from '../game/types'

export interface ConfrontButton {
  label: string
  needsEvidence: EvidenceId
  playerLine: string
  intent: string
}

export interface Suspect {
  id: SuspectId
  name: string
  role: string
  emoji: string
  tone: string
  systemPrompt: string
  contradictionRegex: RegExp
  confronts: ConfrontButton[]
  offline: {
    greeting: string
    denial: string[]
    evasion: string[]
    byIntent: Record<string, string>
    contradictionLine: string
    contradictionIntents: string[]
    keywords: Array<{ pattern: RegExp; intent: string }>
  }
}

const BASE_RULES =
  'Voce e um personagem de um jogo literario escolar sobre O Conde de Monte Cristo, ambientado como investigacao em 2026 sobre o caso de 1815. Responda SEMPRE em portugues do Brasil, em 1 a 3 frases curtas, sempre no personagem, sem sair do papel, sem violencia explicita, adequado para alunos. Nunca confesse por completo.'

export const SUSPECTS: Suspect[] = [
  {
    id: 'danglars',
    name: 'Danglars',
    role: 'Guarda-livros do Pharaon',
    emoji: '🖋️',
    tone: 'frio, calculista',
    systemPrompt: `${BASE_RULES} Voce e DANGLARS, guarda-livros do navio Pharaon, frio e calculista. Voce e culpado: escreveu a denuncia anonima contra Edmond Dantes por inveja do cargo de capitao. Negue tudo com frieza e desdem. POREM, SE o jogador confronta-lo com a analise de estilometria da denuncia ou com o registro da sua promocao a capitao, voce deixa escapar um detalhe que so o autor da denuncia saberia — mencione a ilha de Elba, a rota do navio ou a palavra "bonapartista" — e tente consertar em seguida, gaguejando. Nunca confesse por completo.`,
    contradictionRegex: /ilha de elba|rota|bonapartista/i,
    confronts: [
      {
        label: '📄 Estilometria da denúncia',
        needsEvidence: 'ev1',
        playerLine:
          'A análise de estilometria diz que a letra da denúncia anônima bate 87% com a sua escrita. Explique.',
        intent: 'estilometria',
      },
      {
        label: '💰 Sua promoção a capitão',
        needsEvidence: 'ev2',
        playerLine:
          'A ata da Companhia Morrel mostra que VOCÊ foi indicado capitão logo depois da prisão de Edmond. Coincidência?',
        intent: 'promocao',
      },
      {
        label: '🍷 Você estava na taberna',
        needsEvidence: 'ev3',
        playerLine:
          'A geolocalização coloca você na taberna de Caderousse na noite em que a denúncia foi postada. O que fazia lá?',
        intent: 'taberna',
      },
    ],
    offline: {
      greeting:
        'Danglars, guarda-livros. Números não mentem, detetive — pessoas, sim. Seja breve.',
      denial: [
        'Eu cuidava dos livros do Pharaon, nada mais. Essa acusação é um erro contábil seu.',
        'Inveja? Eu? Eu apenas registrava cargas e salários. Procure outro culpado.',
      ],
      evasion: [
        'Pergunta irrelevante. Volte quando tiver números, não suposições.',
        'Não vou perder tempo com especulações. Próxima pergunta.',
        'Isso não consta em nenhum registro meu. Prossiga.',
      ],
      byIntent: {
        taberna:
          'Estive na taberna a negócios, como meia Marselha. Beber vinho não é crime, detetive.',
        mercedes: 'A moça catalã? Assunto de Fernand, não meu. Eu lido com cifras.',
        carta: 'Cartas? Eu escrevo lançamentos contábeis, não correspondências.',
      },
      contradictionLine:
        'Eu jamais escreveria aquela denúncia... até porque quem escreveu sabia da parada na ilha de Elba e da rota do Pharaon, e do... do agente bonapartista — quer dizer, é o que dizem por aí! Foi o que ouvi, claro.',
      contradictionIntents: ['estilometria', 'promocao'],
      keywords: [
        { pattern: /estilometr|letra|escrita|denunci|anonim/i, intent: 'estilometria' },
        { pattern: /promo|capit|cargo|morrel|dinheiro|lucr/i, intent: 'promocao' },
        { pattern: /taberna|caderousse|vinho|bebida|porto/i, intent: 'taberna' },
        { pattern: /merc[eé]d[eè]s/i, intent: 'mercedes' },
        { pattern: /carta|noirtier/i, intent: 'carta' },
      ],
    },
  },
  {
    id: 'fernand',
    name: 'Fernand',
    role: 'Pescador catalão',
    emoji: '🎣',
    tone: 'orgulhoso, explosivo',
    systemPrompt: `${BASE_RULES} Voce e FERNAND, pescador catalao, orgulhoso e explosivo. Voce e culpado: levou a denuncia anonima ao correio por ciume de Edmond Dantes. Sua defesa e alegar que "mal conhecia" Edmond. PORAM, SE o jogador mencionar "Mercedes", voce perde a compostura e revela sua paixao por ela — diga algo como "ele nao a merecia" ou fale dela como "minha Mercedes" ou que voce a ama/amava — contradizendo o "mal conhecia". Tom explosivo, frases curtas. Nunca confesse por completo.`,
    contradictionRegex: /merc[eé]d[eè]s[\s\S]*?(am(o|ava)|merecia|minha)|((am(o|ava)|merecia|minha)[\s\S]*?merc[eé]d[eè]s)/i,
    confronts: [
      {
        label: '💌 O triângulo amoroso',
        needsEvidence: 'ev4',
        playerLine:
          'O quadro de vínculos mostra você como pretendente rejeitado de Mercédès, noiva de Edmond. Você o odiava, não?',
        intent: 'mercedes',
      },
      {
        label: '🍷 A noite na taberna',
        needsEvidence: 'ev3',
        playerLine:
          'Testemunhas colocam você na taberna de Caderousse quando a denúncia foi escrita. Quem a levou ao correio?',
        intent: 'taberna',
      },
      {
        label: '📄 A denúncia anônima',
        needsEvidence: 'ev1',
        playerLine: 'Alguém postou esta denúncia anônima contra Edmond. Você sabe quem foi?',
        intent: 'denuncia',
      },
    ],
    offline: {
      greeting: 'Fernand. Pescador. Não tenho nada a dizer sobre esse tal Dantès. Mal o conhecia!',
      denial: [
        'Já disse: mal conhecia esse homem! Eu pescava, ele navegava. Fim.',
        'Não me misture com essa história! Eu não escrevi nada, eu nem sei escrever direito!',
      ],
      evasion: [
        'Bah! Perguntas, perguntas! Vá pescar respostas em outro lugar!',
        'Isso não me diz respeito. Eu cuidava das minhas redes!',
        'Você me cansa, detetive. Pergunte logo o que interessa!',
      ],
      byIntent: {
        taberna:
          'Estive lá bebendo com Caderousse e Danglars, e daí? Um catalão não pode beber?',
        denuncia:
          'Denúncia? Papel e pena não são coisa de pescador. Eu só... eu não sei de carta nenhuma!',
        carta: 'Cartas de traidor não são problema meu. Fale com a justiça!',
      },
      contradictionLine:
        'MAL O CONHECIA, JÁ DISSE! Mas Mercédès... minha Mercédès merecia um homem de verdade! Eu a amava muito antes dele aparecer — ele nunca a mereceu! ...Quer dizer... eu... eu mal os conhecia, os dois.',
      contradictionIntents: ['mercedes'],
      keywords: [
        { pattern: /merc[eé]d[eè]s|noiva|amor|casament|catal[aã]/i, intent: 'mercedes' },
        { pattern: /taberna|caderousse|vinho|beb/i, intent: 'taberna' },
        { pattern: /denunci|anonim|correio|carta|postou/i, intent: 'denuncia' },
      ],
    },
  },
  {
    id: 'villefort',
    name: 'Villefort',
    role: 'Procurador do rei',
    emoji: '⚖️',
    tone: 'pomposo, jurídico',
    systemPrompt: `${BASE_RULES} Voce e VILLEFORT, procurador do rei, pomposo, fala em jargao juridico. Voce e culpado: queimou a carta enderecada ao seu proprio pai (Noirtier, um bonapartista) e prendeu um inocente sem julgamento para salvar sua carreira. Racionalize tudo ("protegi a ordem", "razoes de Estado"). PORAM, SE o jogador mencionar "Noirtier", voce hesita e nega o parentesco de forma pouco convincente — diga algo como "nao conheco esse Noirtier" ou "nao e meu parente" ou refira-se sem querer a "meu pai" e corrija-se. Nunca confesse abertamente.`,
    contradictionRegex: /noirtier[\s\S]*?(n[aã]o\s.*(conhe[cç]o|parente)|meu pai)|meu pai[\s\S]*?noirtier/i,
    confronts: [
      {
        label: '🔥 A carta queimada',
        needsEvidence: 'ev5',
        playerLine:
          'Restauramos a carta que você queimou. O destinatário era NOIRTIER. Por que destruiu uma prova endereçada a Noirtier?',
        intent: 'noirtier',
      },
      {
        label: '📑 O despacho anômalo',
        needsEvidence: 'ev6',
        playerLine:
          'Seu despacho mandou Edmond para isolamento por tempo indeterminado SEM julgamento. Todos os outros casos foram a júri. Explique.',
        intent: 'despacho',
      },
      {
        label: '📄 O caso da denúncia',
        needsEvidence: 'ev1',
        playerLine:
          'Uma denúncia anônima virou prisão perpétua em 24 horas, sem investigação. Isso é a justiça do rei?',
        intent: 'denuncia',
      },
    ],
    offline: {
      greeting:
        'Villefort, procurador do rei. Espero que esta oitiva tenha amparo legal, detetive. Seja objetivo.',
      denial: [
        'Agi estritamente conforme o interesse do Estado. Protegi a ordem pública, nada mais.',
        'Data venia, detetive, o senhor não compreende as razões de Estado envolvidas.',
      ],
      evasion: [
        'Pergunta impertinente e sem fundamento processual. Reformule.',
        'Isso está acobertado por sigilo de Estado. Próximo quesito.',
        'Não cabe a mim especular. Os autos dizem o que dizem.',
      ],
      byIntent: {
        despacho:
          'O despacho seguiu rito sumário previsto para crimes contra a Coroa. Celeridade não é crime; é eficiência processual.',
        denuncia:
          'A denúncia continha indícios gravíssimos de conspiração bonapartista. Agi com o rigor que o cargo exige.',
        mercedes: 'Não conheço as relações pessoais do réu. Isso é irrelevante para os autos.',
      },
      contradictionLine:
        'Noirtier? Eu... hã... não conheço esse Noirtier de que fala, não é meu parente... A carta foi destruída porque... porque meu pai— DIGO, porque o Estado exigia sigilo absoluto! Protegi a ordem!',
      contradictionIntents: ['noirtier'],
      keywords: [
        { pattern: /noirtier|pai|carta|queimad|destinat/i, intent: 'noirtier' },
        { pattern: /despacho|julgamento|isolamento|chateau|castelo|pris[aã]o/i, intent: 'despacho' },
        { pattern: /denunci|anonim|bonapart/i, intent: 'denuncia' },
        { pattern: /merc[eé]d[eè]s/i, intent: 'mercedes' },
      ],
    },
  },
]

export function getSuspect(id: SuspectId): Suspect {
  return SUSPECTS.find((s) => s.id === id)!
}

/** Escolhe a resposta offline para uma fala do jogador. */
export function offlineReply(
  suspect: Suspect,
  playerText: string,
  intentHint: string | null,
  msgCount: number,
): string {
  const off = suspect.offline
  const intent =
    intentHint ?? off.keywords.find((k) => k.pattern.test(playerText))?.intent ?? null

  if (intent && off.contradictionIntents.includes(intent)) return off.contradictionLine
  if (intent && off.byIntent[intent]) return off.byIntent[intent]
  if (msgCount === 0) return off.greeting
  if (/quem|voc[eê]|fez|escreveu|culpad|denunci|prendeu/i.test(playerText)) {
    return off.denial[msgCount % off.denial.length]
  }
  return off.evasion[msgCount % off.evasion.length]
}
