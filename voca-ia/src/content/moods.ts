// Os humores do Voca. Da pra trocar NO MEIO da conversa: muda o tom das
// respostas da IA, a cara do bonequinho e as falas do modo offline.

export type MoodId = 'gentil' | 'neutro' | 'sarcastico' | 'brutal' | 'drama' | 'sargento'

/** Expressao do bonequinho (ver components/Voca.tsx). */
export type Face = 'happy' | 'neutral' | 'smirk' | 'angry' | 'drama' | 'stern'

export type MoodDef = {
  id: MoodId
  label: string
  emoji: string
  color: string
  desc: string
  face: Face
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
    desc: 'Sem paciência, sem passar a mão na cabeça. (é de brincadeira 😄)',
    face: 'angry',
    hello: ['CHEGOU TARDE. Senta e fala. AGORA.', 'Sem desculpa hoje. Abre a boca e fala.'],
    praise: ['Certo. Finalmente. Próxima.', 'ISSO. Viu como não era difícil?', 'Tá. Uma boa. Não relaxa.'],
    wrong: ['NÃO. De novo.', 'Errado. E você ainda respondeu com confiança, o que é pior.', 'Isso doeu. Tenta de novo.', 'Não, não e não. Lê a correção e repete.'],
    onSwitch: 'BOA ESCOLHA. Agora não vem chorar. 🔥',
  },
  {
    id: 'drama',
    label: 'Dramático',
    emoji: '🎭',
    color: '#F4A259',
    desc: 'Novela mexicana. Cada erro é uma tragédia.',
    face: 'drama',
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
    hello: ['DE PÉ, RECRUTA. Treino começa agora.', 'Você tem 10 minutos. Sem manha.'],
    praise: ['CORRETO. Próxima, rápido.', 'Aceitável, recruta. Continue.', 'Boa. Não abaixa a guarda.'],
    wrong: ['NEGATIVO. Repete até sair certo.', 'Errado, recruta. 3 vezes em voz alta, AGORA.', 'Inaceitável. Corrige e segue.'],
    onSwitch: 'SIM SENHOR. Treino pesado ativado. 🪖',
  },
]

export function getMood(id: MoodId | string): MoodDef {
  return MOODS.find((m) => m.id === id) ?? MOODS[1]
}
