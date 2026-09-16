// Cenarios da conversa continua. O "situation" e o que o servidor injeta no
// prompt da IA; o resto e interface.
export type Scenario = {
  id: string
  emoji: string
  title: string
  goal: string
  /** descricao do papel da IA, em ingles, para o modelo */
  situation: string
  /** frases-chave que o app sugere como atalho */
  starters: string[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'free',
    emoji: '💬',
    title: 'Papo livre',
    goal: 'Falar sobre qualquer coisa sem roteiro',
    situation: 'Free conversation. You are chatting casually with the learner about their day, hobbies, school, music, series, whatever comes up. Keep asking follow-up questions.',
    starters: ['Hi!', 'How are you?', 'Can we talk about music?'],
  },
  {
    id: 'cafe',
    emoji: '☕',
    title: 'No café',
    goal: 'Pedir, perguntar o preço e pagar',
    situation: 'You are a busy barista at a crowded coffee shop. The learner is the customer. Take their order, ask about size, milk, sugar, and charge them. Push them to be specific.',
    starters: ['Hi, one coffee please.', 'How much is it?', 'Can I pay by card?'],
  },
  {
    id: 'airport',
    emoji: '✈️',
    title: 'Aeroporto',
    goal: 'Check-in, bagagem e um problema no voo',
    situation: 'You are an airline check-in agent. There is a problem with the learner’s booking or luggage. Make them explain, ask for documents, and offer options.',
    starters: ['I have a flight to London.', 'My bag is too heavy?', 'Where is the gate?'],
  },
  {
    id: 'job',
    emoji: '💼',
    title: 'Entrevista de emprego',
    goal: 'Falar de você e responder perguntas difíceis',
    situation: 'You are a hiring manager interviewing the learner for their first job. Ask about strengths, weaknesses, availability, and why they want the job. Follow up on vague answers.',
    starters: ['Hello, nice to meet you.', 'I am a student.', 'I can work in the afternoon.'],
  },
  {
    id: 'doctor',
    emoji: '🏥',
    title: 'Médico / farmácia',
    goal: 'Explicar o que está sentindo',
    situation: 'You are a doctor or pharmacist. The learner is not feeling well. Ask where it hurts, since when, allergies, and give simple advice.',
    starters: ['I don’t feel well.', 'I have a headache.', 'I am allergic to peanuts.'],
  },
  {
    id: 'shop',
    emoji: '🛍️',
    title: 'Compras',
    goal: 'Tamanho, preço e pechincha',
    situation: 'You are a shop assistant. The learner wants to buy clothes. Talk about size, color, price, and resist a little when they ask for a discount.',
    starters: ['Do you have a smaller size?', 'Can I try it on?', 'It is too expensive.'],
  },
  {
    id: 'party',
    emoji: '🎉',
    title: 'Conhecendo alguém',
    goal: 'Puxar assunto numa festa',
    situation: 'You are a friendly stranger at a party. Make small talk with the learner: names, where they are from, music, what they do. Keep the conversation going.',
    starters: ['Hi, I’m Ana.', 'Nice party, right?', 'Where are you from?'],
  },
  {
    id: 'neighbor',
    emoji: '😤',
    title: 'Vizinho barulhento',
    goal: 'Reclamar (educadamente ou não)',
    situation: 'You are the learner’s noisy neighbor who plays loud music at 3am. They came to complain. Defend yourself, make excuses, and make them insist. Stay comedic, never insulting.',
    starters: ['Excuse me, it is too loud.', 'I need to sleep.', 'Please turn it down.'],
  },
  {
    id: 'taxi',
    emoji: '🚕',
    title: 'Táxi / motorista',
    goal: 'Dizer para onde vai e negociar',
    situation: 'You are a chatty taxi driver. Ask where they are going, comment on traffic, talk about the city, and ask them questions about their country.',
    starters: ['To the airport, please.', 'How long does it take?', 'How much is it?'],
  },
  {
    id: 'fandom',
    emoji: '🎤',
    title: 'Série, música, fofoca',
    goal: 'Falar do que você gosta de verdade',
    situation: 'You are a friend obsessed with pop culture. Talk about series, films, music and gossip. Ask their opinion and disagree playfully to make them argue back.',
    starters: ['Did you watch that series?', 'I love this song.', 'That ending was bad.'],
  },
]

export function getScenario(id: string) {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
}
