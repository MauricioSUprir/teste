// Primeira abertura: nome, idioma e humor do Voca.
import { useState } from 'react'
import { useStore } from '../state/store'
import { LANGUAGES } from '../content/languages'
import { MOODS } from '../content/moods'
import { Voca } from '../components/Voca'
import { getMood } from '../content/moods'
import type { View } from '../App'
import type { Difficulty } from '../state/types'

const NIVEIS: { id: Difficulty; emoji: string; title: string; desc: string }[] = [
  { id: 'facil', emoji: '🐣', title: 'Leve', desc: 'Mais escolher e montar do que escrever. Perdoa erro de digitação.' },
  { id: 'medio', emoji: '🔥', title: 'Normal', desc: 'Mistura tudo: escrever, ouvir, montar e falar.' },
  { id: 'dificil', emoji: '💀', title: 'Pesado', desc: 'Escrever do zero e falar. Errou uma letra, errou. Vale mais XP.' },
]

export function Onboarding({ go }: { go: (v: View) => void }) {
  const { patchProfile } = useStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [lang, setLang] = useState('en')
  const [mood, setMood] = useState('brutal')
  const [dif, setDif] = useState<Difficulty>('medio')
  const m = getMood(mood)

  function entrar(comTeste: boolean) {
    patchProfile({
      name: name.trim() || 'você',
      lang,
      langs: [lang],
      mood,
      difficulty: dif,
      onboarded: true,
    })
    if (comTeste) go({ name: 'nivelamento', langId: lang })
  }

  return (
    <div className="screen onboarding">
      <div className="ob-art">
        <Voca state="idle" face={m.face} color={m.color} size={170} />
      </div>

      {step === 0 && (
        <div className="ob-step">
          <h1 className="logo">VOCA<span>IA</span></h1>
          <p className="ob-lead">
            10 idiomas, lições curtas e uma conversa contínua por voz com uma IA que
            muda de humor — inclusive para o modo <b>sem paciência nenhuma</b>.
          </p>
          <label className="field">
            <span>Como você quer ser chamada?</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="seu nome"
              maxLength={24}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(1)}
            />
          </label>
          <button className="btn primary big" disabled={!name.trim()} onClick={() => setStep(1)}>
            Começar
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="ob-step">
          <h2>Qual idioma primeiro?</h2>
          <p className="ob-lead">Dá para trocar quando quiser — e estudar vários ao mesmo tempo.</p>
          <div className="lang-grid">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                className={`lang-card ${lang === l.id ? 'on' : ''}`}
                onClick={() => setLang(l.id)}
              >
                <span className="flag">{l.flag}</span>
                <b>{l.name}</b>
                <small>{l.native}</small>
              </button>
            ))}
          </div>
          <button className="btn primary big" onClick={() => setStep(2)}>
            Continuar
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="ob-step">
          <h2>E o humor do Voca?</h2>
          <p className="ob-lead">
            Isso muda como ele conversa e corrige você. Dá para trocar <b>no meio da conversa</b>.
          </p>
          <div className="mood-grid">
            {MOODS.map((x) => (
              <button key={x.id} className={`mood-card ${mood === x.id ? 'on' : ''}`} onClick={() => setMood(x.id)} style={{ borderColor: mood === x.id ? x.color : undefined }}>
                <span className="emoji">{x.emoji}</span>
                <b>{x.label}</b>
                <small>{x.desc}</small>
              </button>
            ))}
          </div>
          <p className="disclaimer">
            Os humores bravos são <b>piada de professor rígido</b>: ele grita e chama você de
            burra, mula, anta — sempre pelo <b>erro</b> que você cometeu, nunca por quem você é, e
            sem palavrão. Cansou? Troca o humor em um toque, no topo da tela.
          </p>
          <button className="btn primary big" onClick={() => setStep(3)}>
            Continuar
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="ob-step">
          <h2>Quanto ele deve pegar no seu pé?</h2>
          <p className="ob-lead">Isso muda o tipo de exercício e o quanto ele perdoa. Dá para trocar depois.</p>
          <div className="mood-grid">
            {NIVEIS.map((n) => (
              <button key={n.id} className={`mood-card ${dif === n.id ? 'on' : ''}`} onClick={() => setDif(n.id)}>
                <span className="emoji">{n.emoji}</span>
                <b>{n.title}</b>
                <small>{n.desc}</small>
              </button>
            ))}
          </div>
          <button className="btn primary big" onClick={() => setStep(4)}>
            Continuar
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="ob-step">
          <h2>Vamos descobrir seu nível</h2>
          <p className="ob-lead">
            Um teste rápido, sem vidas e sem pressa: ele vai subindo de dificuldade até você travar.
            Assim você começa no ponto certo em vez de repetir o que já sabe.
          </p>
          <ul className="perk-list">
            <li><b>Leva uns 3 minutos</b><small>Umas 15 questões, e para assim que fica difícil demais.</small></li>
            <li><b>Não tem como ir mal</b><small>Se não souber, responde "não sei" — é isso que o teste quer saber.</small></li>
            <li><b>Abre as lições do seu nível</b><small>Nada de começar do "oi, tudo bem" se você já passou disso.</small></li>
          </ul>
          <button className="btn primary big" onClick={() => entrar(true)}>
            Fazer o teste de nível
          </button>
          <button className="btn ghost big" onClick={() => entrar(false)}>
            Pular e começar do começo
          </button>
        </div>
      )}
    </div>
  )
}
