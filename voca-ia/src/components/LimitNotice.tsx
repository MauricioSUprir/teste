// Aviso de "acabou o limite de IA por hoje". Aparece na hora em que as duas
// IAs recusam, e explica o que continua funcionando — nada de erro seco.
import { useEffect, useState } from 'react'
import { limitHitToday, onLimit, tempoAteAmanha } from '../lib/limits'

export function LimitNotice() {
  const [aberto, setAberto] = useState(false)

  useEffect(() => onLimit(() => setAberto(true)), [])

  if (!aberto) return null
  return (
    <div className="limit-wrap" role="alertdialog">
      <div className="limit">
        <h2>Acabou o limite de IA por hoje</h2>
        <p>
          As duas IAs bateram na cota diária delas. Isso volta ao normal{' '}
          <b>em {tempoAteAmanha()}</b>, na virada do dia.
        </p>
        <div className="limit-lists">
          <div>
            <b>Pausado até amanhã</b>
            <ul>
              <li>Conversa contínua com IA</li>
              <li>Explicação do erro</li>
              <li>Chat de dúvidas</li>
              <li>Ajuda do Voca na questão</li>
            </ul>
          </div>
          <div className="ok">
            <b>Continua funcionando</b>
            <ul>
              <li>Todas as lições dos 10 idiomas</li>
              <li>Revisão das frases do dia</li>
              <li>Vídeos de filme e série</li>
              <li>Conversa no modo offline</li>
              <li>XP, ofensiva e conquistas</li>
            </ul>
          </div>
        </div>
        <button className="btn primary big" onClick={() => setAberto(false)}>
          Beleza, vou continuar nas lições
        </button>
      </div>
    </div>
  )
}

/** Faixa discreta que fica no topo enquanto o limite do dia estiver estourado. */
export function LimitBanner() {
  const [ativo, setAtivo] = useState(() => limitHitToday())
  useEffect(() => onLimit(() => setAtivo(true)), [])
  if (!ativo) return null
  return (
    <div className="limit-banner">
      Limite de IA de hoje esgotado — volta em {tempoAteAmanha()}. As lições seguem normais.
    </div>
  )
}
