export type Screen =
  | 'attract'
  | 'register'
  | 'briefing'
  | 'evidence'
  | 'interrogation'
  | 'accusation'
  | 'result'
  | 'admin'

export type EvidenceId = 'ev1' | 'ev2' | 'ev3' | 'ev4' | 'ev5' | 'ev6'

export type SuspectId = 'danglars' | 'fernand' | 'villefort'

export type AccusedId = SuspectId | 'caderousse' | 'mercedes' | 'morrel'

export interface Settings {
  offline: boolean
  minutes: 4 | 6 | 8
  sound: boolean
  voice: boolean
}

export interface EvidenceState {
  done: boolean
  points: number
}

export interface Session {
  name: string
  badge: string
  score: number
  timeLeft: number // segundos
  running: boolean
  evidence: Record<EvidenceId, EvidenceState>
  contradictions: Record<SuspectId, boolean>
  accusationAttempts: number
  solved: boolean
  viaQr: boolean
}

export interface RankEntry {
  name: string
  badge: string
  score: number
  timeUsed: number // segundos gastos
  date: string
  viaQr?: boolean
}

export interface ChatMsg {
  from: 'player' | 'suspect'
  text: string
  contradiction?: boolean
}
