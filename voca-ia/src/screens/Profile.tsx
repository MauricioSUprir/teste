// Perfil: numeros, conquistas e ajustes (voz, meta, humor padrao).
import { useEffect, useState } from 'react'
import { useStore, levelOf, ACHIEVEMENTS } from '../state/store'
import { LANGUAGES, getLang } from '../content/languages'
import { MOODS, getMood } from '../content/moods'
import { voicesFor, voicesReady, speak } from '../lib/speech'
import { mastered } from '../lib/srs'
import { Voca } from '../components/Voca'

export function Profile({ onExit }: { onExit: () => void }) {
  const { save, patchProfile, reset } = useStore()
  const lang = getLang(save.profile.lang)
  const mood = getMood(save.profile.mood)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    voicesReady(() => setVoices(voicesFor(lang.locale)))
    setVoices(voicesFor(lang.locale))
  }, [lang.locale])

  const acc = save.stats.answers ? Math.round((save.stats.correct / save.stats.answers) * 100) : 0

  return (
    <div className="screen profile">
      <header className="conv-top">
        <button className="x" onClick={onExit}>✕</button>
        <h2>Seu perfil</h2>
      </header>

      <div className="prof-hero">
        <Voca state="idle" face={mood.face} color={mood.color} size={120} />
        <div>
          <h1>{save.profile.name || 'você'}</h1>
          <p className="muted">
            nível {levelOf(save.xp)} · {save.xp} XP · 🔥 {save.streak} (recorde {save.bestStreak})
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <div><b>{save.stats.lessonsDone}</b><small>lições</small></div>
        <div><b>{acc}%</b><small>acerto geral</small></div>
        <div><b>{mastered(save.srs)}</b><small>frases firmes</small></div>
        <div><b>{save.stats.conversationTurns}</b><small>falas na conversa</small></div>
        <div><b>{Math.round(save.stats.conversationSeconds / 60)}min</b><small>conversando</small></div>
        <div><b>{save.profile.langs.length}</b><small>idiomas</small></div>
      </div>

      <h3 className="sec">Conquistas</h3>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const got = save.achievements.includes(a.id)
          return (
            <div key={a.id} className={`ach ${got ? 'got' : ''}`} title={a.desc}>
              <span>{got ? a.icon : '🔒'}</span>
              <b>{a.title}</b>
              <small>{a.desc}</small>
            </div>
          )
        })}
      </div>

      <h3 className="sec">Ajustes</h3>
      <label className="field">
        <span>Nome</span>
        <input value={save.profile.name} onChange={(e) => patchProfile({ name: e.target.value })} maxLength={24} />
      </label>

      <label className="field">
        <span>Meta diária: {save.profile.dailyGoal} XP</span>
        <input type="range" min={20} max={200} step={10} value={save.profile.dailyGoal} onChange={(e) => patchProfile({ dailyGoal: Number(e.target.value) })} />
      </label>

      <label className="field">
        <span>Idioma atual</span>
        <select value={save.profile.lang} onChange={(e) => patchProfile({ lang: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>{l.flag} {l.name}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Humor padrão do Voca</span>
        <select value={save.profile.mood} onChange={(e) => patchProfile({ mood: e.target.value })}>
          {MOODS.map((m) => (
            <option key={m.id} value={m.id}>{m.emoji} {m.label} — {m.desc}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Velocidade da voz: {save.profile.voiceRate.toFixed(2)}x</span>
        <input type="range" min={0.6} max={1.3} step={0.05} value={save.profile.voiceRate} onChange={(e) => patchProfile({ voiceRate: Number(e.target.value) })} />
      </label>

      <label className="field">
        <span>Voz ({voices.length} disponíveis para {lang.name})</span>
        <select value={save.profile.voiceName ?? ''} onChange={(e) => patchProfile({ voiceName: e.target.value || null })}>
          <option value="">padrão do sistema</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>{v.name}</option>
          ))}
        </select>
      </label>
      <button className="btn ghost sm" onClick={() => speak(lang.units[0].lessons[0].phrases[0].t, { locale: lang.locale, rate: save.profile.voiceRate, voiceName: save.profile.voiceName })}>
        🔊 testar voz
      </button>

      <h3 className="sec">Zona de perigo</h3>
      {confirmReset ? (
        <div className="danger">
          <p>Isso apaga XP, ofensiva, progresso e revisões deste navegador. Não dá para desfazer.</p>
          <button className="btn danger" onClick={() => { reset(); onExit() }}>Apagar tudo mesmo</button>
          <button className="btn ghost" onClick={() => setConfirmReset(false)}>cancelar</button>
        </div>
      ) : (
        <button className="btn ghost" onClick={() => setConfirmReset(true)}>Apagar meu progresso</button>
      )}

      <p className="muted small">
        Tudo fica salvo só neste navegador. A conversa com IA passa pelo servidor do app apenas para
        falar com a Anthropic — o áudio nunca sai do seu aparelho (a transcrição é feita pelo próprio navegador).
      </p>
    </div>
  )
}
