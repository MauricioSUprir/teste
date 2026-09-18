// Tela principal: idioma, meta do dia, conversa continua, revisao e a trilha.
import { useMemo } from 'react'
import type { View } from '../App'
import { useStore, levelOf, levelProgress, MAX_HEARTS } from '../state/store'
import { LANGUAGES, getLang, key } from '../content/languages'
import { getMood } from '../content/moods'
import { dueCards } from '../lib/srs'
import { Voca } from '../components/Voca'
import { today } from '../lib/util'
import { canUse } from '../lib/plan'
import { LimitBanner } from '../components/LimitNotice'
import { SubscriptionBanner } from '../components/SubscriptionNotice'
import { desafioDoDia } from '../content/desafios'
import { getSerie } from '../content/series'

export function Home({ go }: { go: (v: View) => void }) {
  const { save, patchProfile, minutesToHeart, resgatarDesafio } = useStore()
  const lang = getLang(save.profile.lang)
  const mood = getMood(save.profile.mood)
  const due = useMemo(
    () => dueCards(save.srs).filter((c) => c.lang === lang.id),
    [save.srs, lang.id],
  )
  const hoje = save.history.find((h) => h.day === today())?.xp ?? 0
  const serie = getSerie(save.profile.schoolYear)
  const metaPct = Math.min(1, hoje / save.profile.dailyGoal)

  // trilha: a licao seguinte so abre quando a anterior termina
  const flat = lang.units.flatMap((u) => u.lessons.map((l) => ({ unit: u, lesson: l })))
  const firstLocked = flat.findIndex(({ lesson }) => !save.lessons[key(lang.id, lesson.id)]?.completed)
  const sequencial = firstLocked === -1 ? flat.length : firstLocked
  // o teste de nivelamento abre tudo que esta no nivel dela ou abaixo
  const ORDEM = ['A1', 'A2', 'B1', 'B2']
  const nivel = save.profile.levels[lang.id]
  const porNivel = nivel
    ? flat.reduce((n, f, i) => (ORDEM.indexOf(f.unit.cefr) <= ORDEM.indexOf(nivel) ? i + 1 : n), 0)
    : 0
  const unlockedUntil = Math.max(sequencial, porNivel)

  return (
    <div className="screen home">
      <header className="topbar">
        <button className="avatar-btn" onClick={() => go({ name: 'perfil' })} aria-label="Perfil">
          <span className="avatar">{save.profile.name.slice(0, 1).toUpperCase() || '•'}</span>
        </button>
        <div className="stats">
          <span className="stat" title="Ofensiva"><i>dias</i><b>{save.streak}</b></span>
          <span className="stat" title="Vidas">
            <i>vidas</i>
            <span className="vidas">
              {Array.from({ length: MAX_HEARTS }, (_, i) => (
                <u key={i} className={i < save.hearts ? 'on' : ''} />
              ))}
            </span>
            {save.hearts < MAX_HEARTS && <small>{minutesToHeart}min</small>}
          </span>
          <span className="stat" title="XP"><i>xp</i><b>{save.xp}</b></span>
        </div>
      </header>

      <LimitBanner />
      <SubscriptionBanner go={go} />

      <div className="lang-strip">
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            className={`lang-pill ${l.id === lang.id ? 'on' : ''}`}
            onClick={() => patchProfile({ lang: l.id, langs: Array.from(new Set([...save.profile.langs, l.id])) })}
            title={l.name}
          >
            <span>{l.flag}</span>
            <small>{l.name}</small>
          </button>
        ))}
      </div>

      <div className="goal-card">
        <div className="goal-ring" style={{ ['--p' as string]: metaPct }}>
          <b>{Math.round(metaPct * 100)}%</b>
        </div>
        <div>
          <h3>Meta de hoje</h3>
          <p>
            {hoje} / {save.profile.dailyGoal} XP · nível {levelOf(save.xp)}
          </p>
          <div className="bar sm">
            <i style={{ width: `${levelProgress(save.xp) * 100}%` }} />
          </div>
        </div>
      </div>

      <Desafio onResgatar={resgatarDesafio} />

      <div className="acoes">
        <button className="acao" onClick={() => go({ name: 'tradutor' })}>
          <b>Tradutor</b>
          <small>traduz e explica a pegadinha</small>
        </button>
        <button className="acao" onClick={() => go({ name: 'ranking' })}>
          <b>Ranking</b>
          <small>quem estuda mais</small>
        </button>
      </div>

      <button
        className="talk-card"
        style={{ ['--mood' as string]: mood.color }}
        onClick={() => go(canUse(save, 'conversa') ? { name: 'conversa' } : { name: 'assinar', feature: 'conversa' })}
      >
        <Voca state="talking" face={mood.face} color={mood.color} size={92} energy={0.6} />
        <div className="talk-text">
          <h2>Conversa contínua</h2>
          <p>
            Falar de verdade em {lang.name}, por voz, sem roteiro. Humor agora:{' '}
            <b>
              {mood.label}
            </b>
          </p>
          <span className="tag">trocar humor no meio da conversa →</span>
        </div>
      </button>

      {!save.profile.placed.includes(lang.id) && (
        <button className="review-card" onClick={() => go({ name: 'nivelamento', langId: lang.id })}>
          <div>
            <h3>Descobrir meu nível em {lang.name}</h3>
            <p>3 minutos e o app já te coloca no ponto certo — sem repetir o que você já sabe.</p>
          </div>
        </button>
      )}

      {due.length > 0 && (
        <button className="review-card" onClick={() => go({ name: 'review' })}>
          <div>
            <h3>Revisar {due.length} {due.length === 1 ? 'frase' : 'frases'}</h3>
            <p>Estão na hora de voltar — é isso que faz não esquecer.</p>
          </div>
        </button>
      )}

      <div className="path">
        {lang.units.map((u) => {
          const feitas = u.lessons.filter((l) => save.lessons[key(lang.id, l.id)]?.completed).length
          return (
            <section key={u.id} className="unit" style={{ ['--c' as string]: u.color }}>
              <div className="unit-head">
                <div>
                  <span className="cefr">{u.cefr}</span>
                  <h2>{u.title}</h2>
                  <p>{u.subtitle}</p>
                </div>
                <span className="unit-count">
                  {feitas}/{u.lessons.length}
                </span>
              </div>
              <div className="lessons">
                {u.lessons.map((l) => {
                  const idx = flat.findIndex((f) => f.lesson.id === l.id)
                  const prog = save.lessons[key(lang.id, l.id)]
                  const locked = idx > unlockedUntil
                  return (
                    <button
                      key={l.id}
                      className={`node ${prog?.completed ? 'done' : ''} ${locked ? 'locked' : ''}`}
                      disabled={locked}
                      onClick={() => go({ name: 'lesson', lessonId: l.id })}
                    >
                      <span className="node-icon">{locked ? '——' : String(idx + 1).padStart(2, '0')}</span>
                      <span className="node-title">{l.title}</span>
                      <span className="stars">
                        {[0, 1, 2].map((i) => <u key={i} className={i < (prog?.stars ?? 0) ? 'on' : ''} />)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <footer className="home-foot">
        <p>
          VOCA IA · {lang.units.reduce((n, u) => n + u.lessons.length, 0)} lições em {lang.name}
          {serie ? ` · trilha do ${serie.label}` : ''}
        </p>
      </footer>
    </div>
  )
}

/** Cartão do desafio do dia, com barra de progresso e resgate do XP. */
function Desafio({ onResgatar }: { onResgatar: () => void }) {
  const { save } = useStore()
  const dia = today()
  const d = desafioDoDia(dia)
  const estado = save.daily && save.daily.day === dia ? save.daily : { day: dia, id: d.id, progresso: 0, resgatado: false }
  const pronto = estado.progresso >= d.meta && !estado.resgatado
  if (estado.resgatado)
    return (
      <div className="desafio">
        <div className="desafio-topo">
          <b>Desafio de hoje concluído</b>
          <span className="desafio-xp">+{d.xp} XP</span>
        </div>
        <p className="muted small">Amanhã tem outro.</p>
      </div>
    )
  return (
    <button className={`desafio ${pronto ? 'pronto' : ''}`} onClick={() => pronto && onResgatar()}>
      <div className="desafio-topo">
        <b>{d.titulo}</b>
        <span className="desafio-xp">+{d.xp} XP</span>
      </div>
      <div className="bar sm">
        <i style={{ width: `${Math.min(100, (estado.progresso / d.meta) * 100)}%` }} />
      </div>
      <p className="muted small">
        {pronto ? 'toque para pegar seu XP' : `${estado.progresso} de ${d.meta}`}
      </p>
    </button>
  )
}
