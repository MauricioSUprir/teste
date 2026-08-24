// Vozes dos suspeitos com speechSynthesis (pt-BR), com toggle liga/desliga.
import type { SuspectId } from '../game/types'

let enabled = false

export function setVoiceEnabled(v: boolean) {
  enabled = v
  if (!v) stopSpeaking()
}

export function isVoiceEnabled() {
  return enabled
}

const PROFILES: Record<SuspectId, { rate: number; pitch: number }> = {
  danglars: { rate: 0.95, pitch: 0.7 }, // frio, calculista
  fernand: { rate: 1.15, pitch: 1.1 }, // explosivo
  villefort: { rate: 0.9, pitch: 0.85 }, // pomposo
}

function ptVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? []
  return (
    voices.find((v) => v.lang === 'pt-BR') ||
    voices.find((v) => v.lang?.toLowerCase().startsWith('pt'))
  )
}

export function speak(text: string, suspect: SuspectId) {
  if (!enabled || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-BR'
    const v = ptVoice()
    if (v) u.voice = v
    u.rate = PROFILES[suspect].rate
    u.pitch = PROFILES[suspect].pitch
    window.speechSynthesis.speak(u)
  } catch {
    /* sem suporte */
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* ok */
  }
}
