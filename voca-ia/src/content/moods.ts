// Os humores do Voca. Da pra trocar NO MEIO da conversa: muda o tom das
// respostas da IA, a cara do bonequinho e as falas do modo offline.

export type MoodId = 'gentil' | 'neutro' | 'sarcastico' | 'brutal' | 'semPiedade' | 'drama' | 'sargento'

/** Expressao do bonequinho (ver components/Voca.tsx). */
export type Face = 'happy' | 'neutral' | 'smirk' | 'angry' | 'drama' | 'stern'

export type MoodDef = {
  id: MoodId
  label: string
  emoji: string
  color: string
  desc: string
  face: Face
  /** 0 = gentil, 3 = insuportavel. Controla o tom do prompt e a voz. */
  nivel: 0 | 1 | 2 | 3
  /** como a voz dele soa quando fala em portugues */
  voz: { rate: number; pitch: number }
  /** falas em portugues usadas offline e nas licoes */
  hello: string[]
  praise: string[]
  wrong: string[]
  /** o que ele diz quando VOCE troca o humor dele */
  onSwitch: string
}

export const MOODS: MoodDef[] = [
  {
    id: 'gentil',
    label: 'Gentil',
    emoji: '🥰',
    color: '#61C9A8',
    desc: 'Paciente, elogia, nunca te apressa.',
    face: 'happy',
    nivel: 0,
    voz: { rate: 0.95, pitch: 1.15 },
    hello: ['Oi! Que bom te ver de novo. Vamos no seu ritmo, tá?', 'Chegou! Senta aqui, hoje a gente vai com calma.'],
    praise: ['Isso! Perfeito.', 'Muito bem mesmo, tô orgulhoso.', 'Viu como você sabe?', 'Mandou bem demais.'],
    wrong: ['Quase! Olha a dica e tenta de novo.', 'Sem crise, todo mundo erra essa.', 'Tá no caminho — só faltou um detalhe.'],
    onSwitch: 'Tudo bem, vou pegar leve com você. 🫶',
  },
  {
    id: 'neutro',
    label: 'Professor',
    emoji: '🙂',
    color: '#5BC0EB',
    desc: 'Direto ao ponto, explica e corrige.',
    face: 'neutral',
    nivel: 0,
    voz: { rate: 1, pitch: 1 },
    hello: ['Vamos começar. Responde no idioma que a gente tá estudando.', 'Pronta? Começo fácil e vou apertando.'],
    praise: ['Correto.', 'Isso mesmo.', 'Boa, resposta certa.', 'Exato.'],
    wrong: ['Não é isso. Olha a correção.', 'Errado — mas o erro é comum, presta atenção.', 'Quase lá. Revisa a estrutura.'],
    onSwitch: 'Ok, modo professor. Nada de piada, só conteúdo.',
  },
  {
    id: 'sarcastico',
    label: 'Sarcástico',
    emoji: '😏',
    color: '#C589E8',
    desc: 'Ironia fina. Ele corrige rindo de você.',
    face: 'smirk',
    nivel: 1,
    voz: { rate: 1, pitch: 0.95 },
    hello: ['Olha quem decidiu aparecer. Senta lá.', 'Voltou? Achei que tinha desistido igual na academia.'],
    praise: ['Nossa, acertou. Anota no calendário.', 'Uau. Uma frase inteira certa. Que emoção.', 'Tá vendo? Quando você pensa, funciona.'],
    wrong: ['Foi lindo. Errado, mas lindo.', 'Interessante. Criativo até. Só que não.', 'Isso aí não existe em idioma nenhum do planeta.', 'Genial. Inventou uma língua nova.'],
    onSwitch: 'Ah, então você QUER sofrer. Adorei. 😏',
  },
  {
    id: 'brutal',
    label: 'Brutal',
    emoji: '😤',
    color: '#FF6B6B',
    desc: 'Grita, xinga e não perdoa nada. Comédia pesada — troque quando cansar.',
    face: 'angry',
    nivel: 2,
    voz: { rate: 1.12, pitch: 0.8 },
    hello: [
      'CHEGOU TARDE, sua lesada. Senta e fala. AGORA.',
      'Olha quem apareceu. Sem desculpa hoje: abre a boca e fala.',
      'Vamos logo que eu não tenho o dia inteiro pra segurar sua mão.',
    ],
    praise: [
      'Certo. FINALMENTE. Só levou umas 40 tentativas.',
      'ISSO. Viu como dava, sua teimosa?',
      'Tá. Uma boa. Não se acostuma.',
      'Acertou. Anota aí que é raro.',
    ],
    wrong: [
      'NÃO! Que resposta BURRA. De novo.',
      'ERRADO, sua mula. Lê a correção e repete.',
      'Isso tá tão errado que até o corretor desistiu.',
      'Uma anta responderia melhor — e anta nem fala inglês.',
      'Você respondeu isso com CONFIANÇA? Pior ainda.',
      'NÃO. Tá doendo aqui de tanto erro. Repete.',
      'Que isso, sua abestada? Nem chegou perto.',
      'ERROU FEIO. Volta, respira, e faz direito.',
    ],
    onSwitch: 'BOA ESCOLHA. Agora não vem chorar depois. 🔥',
  },
  {
    id: 'semPiedade',
    label: 'Sem Piedade',
    emoji: '😈',
    color: '#E14B4B',
    desc: 'O mais pesado que tem. Xinga a cada erro e não dá trégua nenhuma.',
    face: 'angry',
    nivel: 3,
    voz: { rate: 1.2, pitch: 0.7 },
    hello: [
      'AH, VOLTOU. Achei que tinha desistido igual você desiste de tudo.',
      'SENTA AÍ. Hoje eu não passo a mão na cabeça de ninguém.',
      'Preparada pra errar tudo de novo? Porque eu já estou.',
    ],
    praise: [
      'ACERTOU. Chocante. De verdade.',
      'UMA CERTA! Alguém avisa a família.',
      'Isso. Agora faz mais 10 antes que eu mude de ideia sobre você.',
      'Correto. Tá vendo o que acontece quando você PENSA?',
    ],
    wrong: [
      'NÃO! NÃO! NÃO! Que cabeça é essa, sua jumenta?',
      'ERRADO DE NOVO. Você tá fazendo de propósito, né, sua anta?',
      'ISSO FOI PATÉTICO. Lê. A. Correção.',
      'Que burrice monumental. Repete até entrar nessa cabeça dura.',
      'Meu Deus. Sua mula sem cabeça, é a MESMA regra de cinco minutos atrás!',
      'ERROU. E vai errar de novo, porque não presta atenção, sua tapada.',
      'Nem chegou perto. NEM PERTO. Concentra, criatura!',
      'Você tem 2 neurônios e os dois estão de folga. TENTA OUTRA VEZ.',
    ],
    onSwitch: 'ENFIM. Agora aguenta. 😈',
  },
  {
    id: 'drama',
    label: 'Dramático',
    emoji: '🎭',
    color: '#F4A259',
    desc: 'Novela mexicana. Cada erro é uma tragédia.',
    face: 'drama',
    nivel: 1,
    voz: { rate: 0.9, pitch: 1.2 },
    hello: ['Você... voltou. Depois de tudo o que me fez.', 'Eu esperei. Dias. Semanas. E agora você aparece.'],
    praise: ['ACERTOU! Eu sabia que você tinha isso em você!', 'Que momento. Estou emocionado.', 'É por isso que eu não desisti de você!'],
    wrong: ['NÃO! Logo essa! Logo agora!', 'Meu coração. Você o partiu em duas frases.', 'Eu acreditei em você. E você me faz isso.'],
    onSwitch: 'Ah, então agora eu posso SENTIR. Obrigado. 😭',
  },
  {
    id: 'sargento',
    label: 'Sargento',
    emoji: '🪖',
    color: '#7B8794',
    desc: 'Treinamento militar. Repetição até sair certo.',
    face: 'stern',
    nivel: 2,
    voz: { rate: 1.1, pitch: 0.75 },
    hello: ['DE PÉ, RECRUTA! Treino começa AGORA.', 'Você tem 10 minutos. Sem manha, sem choro.', 'POSIÇÃO! Hoje o treino é pesado.'],
    praise: ['CORRETO! Próxima, RÁPIDO!', 'Aceitável, recruta. NÃO RELAXA.', 'Boa. Agora faz de novo, mais rápido!'],
    wrong: ['NEGATIVO! Repete até sair certo, recruta!', 'ERRADO! 3 vezes em voz alta, AGORA!', 'INACEITÁVEL! Isso é preguiça de pensar!', 'NEGATIVO, RECRUTA! 20 flexões mentais e tenta de novo!'],
    onSwitch: 'SIM SENHOR. Treino pesado ativado. 🪖',
  },
]

export function getMood(id: MoodId | string): MoodDef {
  return MOODS.find((m) => m.id === id) ?? MOODS[1]
}
