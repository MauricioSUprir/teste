// Primeira abertura: nome, idioma e humor do Voca.
import { useState } from 'react'
import { useStore } from '../state/store'
import { LANGUAGES } from '../content/languages'
import { MOODS } from '../content/moods'
import { Voca } from '../components/Voca'
import { getMood } from '../content/moods'

export function Onboarding() {
  const { patchProfile } = useStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [lang, setLang] = useState('en')
  const [mood, setMood] = useState('brutal')
  const m = getMood(mood)

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
            Os humores bravos são <b>piada</b>: o Voca implica com o erro, nunca com você — e
            volta a ser gentil na hora se você pedir.
          </p>
          <button
            className="btn primary big"
            onClick={() =>
              patchProfile({ name: name.trim() || 'você', lang, langs: [lang], mood, onboarded: true })
            }
          >
            Entrar no app
          </button>
        </div>
      )}
    </div>
  )
}
