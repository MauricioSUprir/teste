// Ranking entre quem usa o app. Só aparece nome e pontos — o resto é privado.
// Existe por um motivo simples: competir faz voltar amanhã.
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { accountsEnabled, buscarRanking, minhaPosicao, type LinhaRanking } from '../lib/account'
import type { View } from '../App'

export function Ranking({ onExit, go }: { onExit: () => void; go: (v: View) => void }) {
  const { save } = useStore()
  const [linhas, setLinhas] = useState<LinhaRanking[]>([])
  const [minha, setMinha] = useState<{ posicao: number; total: number } | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    Promise.all([buscarRanking(20), minhaPosicao()]).then(([r, m]) => {
      setLinhas(r)
      setMinha(m)
      setCarregando(false)
    })
  }, [])

  return (
    <div className="screen">
      <header className="conv-top">
        <button className="x" onClick={onExit}>✕</button>
        <h2>Ranking</h2>
      </header>

      {!accountsEnabled || !save.account ? (
        <div className="acc-box">
          <p className="ai-status">O ranking precisa de conta</p>
          <p className="muted small">
            É a conta que guarda seu XP na nuvem — sem ela não dá para comparar com ninguém. Leva
            um minuto para criar.
          </p>
          <button className="btn primary" onClick={() => go({ name: 'conta' })}>criar conta / entrar</button>
        </div>
      ) : carregando ? (
        <p className="muted">carregando…</p>
      ) : (
        <>
          {minha && minha.posicao > 0 && (
            <div className="meu-lugar">
              Você está em <b>{minha.posicao}º</b> de {minha.total} — {save.xp} XP
            </div>
          )}
          <ol className="rank">
            {linhas.map((l) => (
              <li key={`${l.posicao}-${l.nome}`} className={l.eu ? 'eu' : ''}>
                <span className="pos">{`${l.posicao}º`}</span>
                <span className="nome">{l.nome}</span>
                <span className="of">{l.ofensiva}d</span>
                <b>{l.xp} XP</b>
              </li>
            ))}
          </ol>
          {linhas.length === 0 && <p className="muted center">Ninguém pontuou ainda. Seja a primeira.</p>}
        </>
      )}
    </div>
  )
}
