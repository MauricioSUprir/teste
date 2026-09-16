// Tradutor com explicação. Não é o Google Tradutor: além da frase, ele diz a
// pegadinha (ordem das palavras, falso amigo, formalidade) e dá para guardar a
// frase na revisão com um toque.
import { useState } from 'react'
import { useStore } from '../state/store'
import { getLang } from '../content/languages'
import { getMood } from '../content/moods'
import { contextoDaSerie } from '../content/series'
import { translate, type Traducao } from '../lib/tutor'
import { speak, speakPt } from '../lib/speech'
import { Voca } from '../components/Voca'

export function Translator({ onExit }: { onExit: () => void }) {
  const { save, addConversationCard, addXp } = useStore()
  const lang = getLang(save.profile.lang)
  const mood = getMood(save.profile.mood)
  const [texto, setTexto] = useState('')
  const [direcao, setDirecao] = useState<'pt-alvo' | 'alvo-pt'>('pt-alvo')
  const [r, setR] = useState<Traducao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  async function traduzir() {
    if (!texto.trim()) return
    setCarregando(true)
    setErro(null)
    setR(null)
    setSalvo(false)
    try {
      const out = await translate({
        text: texto,
        langName: lang.name,
        direcao,
        level: save.profile.levels[lang.id] ?? 'A1',
        serie: contextoDaSerie(save.profile.schoolYear),
      })
      setR(out)
      if (direcao === 'pt-alvo') speak(out.translation, { locale: lang.locale, rate: save.profile.voiceRate })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'não deu')
    }
    setCarregando(false)
  }

  return (
    <div className="screen tradutor">
      <header className="conv-top">
        <button className="x" onClick={onExit}>✕</button>
        <h2>Tradutor do Voca</h2>
      </header>

      <div className="tr-dir">
        <button className={direcao === 'pt-alvo' ? 'on' : ''} onClick={() => setDirecao('pt-alvo')}>
          🇧🇷 português → {lang.flag} {lang.name}
        </button>
        <button className={direcao === 'alvo-pt' ? 'on' : ''} onClick={() => setDirecao('alvo-pt')}>
          {lang.flag} {lang.name} → 🇧🇷 português
        </button>
      </div>

      <textarea
        autoFocus
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={direcao === 'pt-alvo' ? 'escreva em português…' : `escreva em ${lang.name}…`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            traduzir()
          }
        }}
      />
      <button className="btn primary big" disabled={!texto.trim() || carregando} onClick={traduzir}>
        {carregando ? 'traduzindo…' : 'traduzir'}
      </button>

      {erro && <p className="test-fail">❌ {erro} — sem IA agora, tente de novo em instantes.</p>}

      {r && (
        <div className="tr-out">
          <div className="tr-main">
            <p className="tr-text" lang={direcao === 'pt-alvo' ? lang.locale : 'pt-BR'} dir={lang.rtl && direcao === 'pt-alvo' ? 'rtl' : 'ltr'}>
              {r.translation}
            </p>
            <button
              className="mini-speak"
              onClick={() =>
                direcao === 'pt-alvo'
                  ? speak(r.translation, { locale: lang.locale, rate: save.profile.voiceRate, voiceName: save.profile.voiceName })
                  : speakPt(r.translation, { nivel: 0, semIa: !save.profile.naturalVoice, voiceId: save.profile.naturalVoiceId })
              }
            >
              🔊
            </button>
          </div>

          {r.literal && (
            <p className="tr-literal">
              ao pé da letra seria “{r.literal}” — e é por isso que não se fala assim.
            </p>
          )}

          <p className="tr-note">
            <b>Fique de olho:</b> {r.note}
          </p>

          {r.alternatives && r.alternatives.length > 0 && (
            <>
              <h4 className="sec">outros jeitos de dizer</h4>
              <ul className="tr-alts">
                {r.alternatives.map((a, i) => (
                  <li key={i}>
                    <button
                      className="mini-speak"
                      onClick={() => direcao === 'pt-alvo' && speak(a, { locale: lang.locale, rate: save.profile.voiceRate })}
                    >
                      🔊
                    </button>
                    {a}
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            className="btn ghost big"
            disabled={salvo}
            onClick={() => {
              const alvo = direcao === 'pt-alvo' ? r.translation : texto
              const pt = direcao === 'pt-alvo' ? texto : r.translation
              addConversationCard({ t: alvo, pt, tip: r.note }, lang.id)
              addXp(2)
              setSalvo(true)
            }}
          >
            {salvo ? '✅ guardado na revisão' : '📌 guardar na minha revisão'}
          </button>
        </div>
      )}

      {!r && !carregando && (
        <div className="tr-vazio">
          <Voca state="idle" face={mood.face} color={mood.color} size={110} />
          <p className="muted center">
            Escreva qualquer frase e ele traduz <b>do jeito que se fala</b> — e ainda explica a
            pegadinha. O que você traduzir aqui pode virar cartão de revisão.
          </p>
        </div>
      )}
    </div>
  )
}
