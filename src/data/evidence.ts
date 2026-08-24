import type { EvidenceId } from '../game/types'

export interface EvidenceMeta {
  id: EvidenceId
  code: string
  title: string
  game: string
  icon: string
  aiAnalysis: string
  docSummary: string
}

export const EVIDENCES: EvidenceMeta[] = [
  {
    id: 'ev1',
    code: 'EV-01',
    title: 'A denúncia anônima',
    game: 'Estilometria',
    icon: '📄',
    docSummary:
      'Denúncia anônima acusa Edmond Dantès de ser agente bonapartista e portar uma carta da ilha de Elba.',
    aiAnalysis:
      'IA forense: padrão de escrita compatível com DANGLARS (87% de similaridade). Vocabulário contábil e inclinação idêntica.',
  },
  {
    id: 'ev2',
    code: 'EV-02',
    title: 'Registro de promoção',
    game: 'Siga o dinheiro',
    icon: '💰',
    docSummary:
      'Ata da Companhia Morrel: com Dantès preso, DANGLARS é indicado para o posto de capitão do Pharaon.',
    aiAnalysis:
      'IA forense: beneficiário direto da prisão identificado — Danglars herda o cargo e o soldo de capitão.',
  },
  {
    id: 'ev3',
    code: 'EV-03',
    title: 'Geolocalização',
    game: 'A taberna',
    icon: '🗺️',
    docSummary:
      'A denúncia foi postada perto do porto, na taberna de Caderousse. Presentes: Danglars, Fernand e Caderousse.',
    aiAnalysis:
      'IA forense: triangulação confirma a taberna como origem. Fernand levou o papel ao correio.',
  },
  {
    id: 'ev4',
    code: 'EV-04',
    title: 'O triângulo amoroso',
    game: 'Quadro de vínculos',
    icon: '💌',
    docSummary:
      'Fernand é pretendente rejeitado de Mercédès, noiva de Edmond. Motivo passional estabelecido.',
    aiAnalysis:
      'IA forense: análise de vínculos indica ciúme como motivação de Fernand contra Edmond.',
  },
  {
    id: 'ev5',
    code: 'EV-05',
    title: 'A carta desaparecida',
    game: 'Restaurar o queimado',
    icon: '🔥',
    docSummary:
      'Carta parcialmente queimada. Destinatário restaurado: NOIRTIER — pai do procurador Villefort.',
    aiAnalysis:
      'IA forense: reconstrução digital revela que Villefort destruiu prova que incriminava o próprio pai.',
  },
  {
    id: 'ev6',
    code: 'EV-06',
    title: 'O despacho',
    game: 'Ache a anomalia',
    icon: '📑',
    docSummary:
      'Entre 4 despachos judiciais, só o de Dantès pula o julgamento: “isolamento por tempo indeterminado”. Assinado: Villefort.',
    aiAnalysis:
      'IA forense: anomalia processual grave — prisão sem júri, sem defesa e sem prazo. Padrão de abuso de poder.',
  },
]

export function getEvidence(id: EvidenceId): EvidenceMeta {
  return EVIDENCES.find((e) => e.id === id)!
}
