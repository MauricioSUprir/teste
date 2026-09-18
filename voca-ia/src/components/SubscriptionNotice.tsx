// Avisos da assinatura. A regra é simples e sem pegadinha: venceu, a pessoa
// ainda tem 7 dias com tudo funcionando, sendo avisada todo dia. Passou disso,
// a assinatura é cancelada — mas o estudo (XP, ofensiva, revisões) fica salvo.
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { DIAS_DE_CARENCIA, diasRestantes, estadoPlano, PAYWALL_ON } from '../lib/plan'
import type { View } from '../App'

const VISTO = 'voca-ia:aviso-plano'

function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function SubscriptionNotice({ go }: { go: (v: View) => void }) {
  const { save } = useStore()
  const estado = estadoPlano(save)
  const dias = diasRestantes(save)
  const [fechado, setFechado] = useState(true)

  useEffect(() => {
    // um aviso por dia, para lembrar sem encher o saco
    try {
      const marca = `${estado}:${hoje()}`
      if ((estado === 'carencia' || estado === 'cancelado' || estado === 'vencendo') && localStorage.getItem(VISTO) !== marca) {
        setFechado(false)
        localStorage.setItem(VISTO, marca)
      }
    } catch {
      /* navegador sem storage */
    }
  }, [estado])

  if (fechado || estado === 'free' || estado === 'ativo') return null

  const textos = {
    vencendo: {
          titulo: `Sua assinatura vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
      corpo: 'Renove pelo Pix para não perder a conversa com o Voca, as explicações e as dicas.',
      botao: 'renovar agora',
    },
    carencia: {
          titulo: `Pagamento não identificado — faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
      corpo: `Não achamos o Pix deste mês. Você continua com tudo liberado por ${DIAS_DE_CARENCIA} dias a partir do vencimento; depois disso a assinatura é cancelada. Se você já pagou, avisa que a gente confere.`,
      botao: 'pagar agora',
    },
    cancelado: {
          titulo: 'Assinatura cancelada',
      corpo: PAYWALL_ON
        ? 'A conversa, as explicações e as dicas do Voca ficaram travadas. Seu progresso, XP e ofensiva continuam salvos — é só assinar de novo para destravar tudo na hora.'
        : 'A assinatura venceu. Como o app ainda está em testes, nada travou — mas quando a cobrança entrar, é aqui que você renova.',
      botao: 'assinar de novo',
    },
  }[estado]

  return (
    <div className="limit-wrap" role="alertdialog">
      <div className={`limit plano-${estado}`}>
                <h2>{textos.titulo}</h2>
        <p>{textos.corpo}</p>
        <button
          className="btn primary big"
          onClick={() => {
            setFechado(true)
            go({ name: 'assinar' })
          }}
        >
          {textos.botao}
        </button>
        <button className="btn ghost" onClick={() => setFechado(true)}>
          agora não
        </button>
      </div>
    </div>
  )
}

/** Faixa fixa no topo da home enquanto a assinatura estiver pendente. */
export function SubscriptionBanner({ go }: { go: (v: View) => void }) {
  const { save } = useStore()
  const estado = estadoPlano(save)
  const dias = diasRestantes(save)
  if (estado === 'free' || estado === 'ativo') return null
  return (
    <button className={`plano-banner ${estado}`} onClick={() => go({ name: 'assinar' })}>
      {estado === 'vencendo' && `Sua assinatura vence em ${dias} ${dias === 1 ? 'dia' : 'dias'} — renovar`}
      {estado === 'carencia' && `Pagamento pendente · ${dias} ${dias === 1 ? 'dia' : 'dias'} até o cancelamento — pagar`}
      {estado === 'cancelado' && 'Assinatura cancelada — assinar de novo'}
    </button>
  )
}
