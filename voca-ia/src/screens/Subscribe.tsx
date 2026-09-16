// VOCA PRO: três planos, pagamento só por Pix.
// O app gera o Pix copia-e-cola (e o QR) direto, sem gateway no meio: o
// dinheiro cai na conta do dono. Ele confere o Pix e libera o plano — por isso
// ninguém consegue se promover sozinho.
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { PLANS, PRO_FEATURES, PAYWALL_ON, isPro, reais, type Plano, type ProFeature } from '../lib/plan'
import { PIX_CONTA, novoTxid, pixConfigurado, pixPayload } from '../lib/pix'
import { registrarPagamento } from '../lib/account'
import { Voca } from '../components/Voca'
import { getMood } from '../content/moods'
import QRCode from 'qrcode'

export function Subscribe({ feature, onExit }: { feature?: ProFeature; onExit: () => void }) {
  const { save } = useStore()
  const mood = getMood(save.profile.mood)
  const pro = isPro(save)
  const [plano, setPlano] = useState<Plano | null>(null)

  if (plano) return <CheckoutPix plano={plano} onVoltar={() => setPlano(null)} onExit={onExit} />

  return (
    <div className="screen subscribe">
      <header className="conv-top">
        <button className="x" onClick={onExit}>✕</button>
        <h2>VOCA PRO</h2>
      </header>

      <div className="sub-hero">
        <Voca state="talking" face={mood.face} color={mood.color} size={110} energy={0.6} />
        <h1>{pro ? 'Você já é PRO' : feature ? PRO_FEATURES[feature].title : 'Libere o Voca por inteiro'}</h1>
        <p className="muted">
          {pro
            ? save.proUntil
              ? `Seu plano vale até ${new Date(save.proUntil).toLocaleDateString('pt-BR')}.`
              : 'Tudo liberado. Bons estudos.'
            : feature
              ? PRO_FEATURES[feature].desc
              : 'As lições, a revisão e os vídeos são de graça para sempre. O que usa IA entra no plano PRO.'}
        </p>
      </div>

      {!PAYWALL_ON && !pro && (
        <p className="free-now">
          🎉 Enquanto estamos em testes, <b>tudo isso está liberado de graça</b>. Assinar agora só
          adianta o seu apoio — nada trava se você não assinar.
        </p>
      )}

      <h3 className="sec">Escolha o plano</h3>
      <div className="plans">
        {PLANS.map((p) => (
          <div key={p.id} className={`plan ${p.destaque ? 'destaque' : ''}`}>
            <div className="plan-head">
              <b>{p.title}</b>
              {p.badge && <span className="pill free">{p.badge}</span>}
            </div>
            <p className="price">{reais(p.price)}</p>
            <p className="per-month">{p.perMonth}</p>
            <p className="per-day">
              {reais(p.price / p.days)} por dia · {p.days === 7 ? '7 dias' : p.days === 30 ? '30 dias' : '365 dias'} de acesso
            </p>
            <ul>
              {p.perks.map((x) => (
                <li key={x}>✓ {x}</li>
              ))}
            </ul>
            <button className="btn primary big" onClick={() => setPlano(p)}>
              pagar com Pix
            </button>
          </div>
        ))}
      </div>

      <h3 className="sec">O que entra no PRO</h3>
      <ul className="perk-list">
        {Object.entries(PRO_FEATURES).map(([id, f]) => (
          <li key={id}>
            <b>{f.title}</b>
            <small>{f.desc}</small>
          </li>
        ))}
      </ul>

      <h3 className="sec">Sempre de graça</h3>
      <ul className="perk-list free">
        <li><b>As lições dos 10 idiomas</b><small>Todos os exercícios, em qualquer dificuldade.</small></li>
        <li><b>Revisão espaçada</b><small>As frases voltam no dia certo para não esquecer.</small></li>
        <li><b>Vídeos de filme e série</b><small>A cena real com a estrutura que você errou.</small></li>
        <li><b>Ofensiva, XP e conquistas</b><small>Tudo que faz voltar todo dia.</small></li>
      </ul>

      <button className="btn ghost big" onClick={onExit}>Voltar</button>
    </div>
  )
}

function CheckoutPix({ plano, onVoltar, onExit }: { plano: Plano; onVoltar: () => void; onExit: () => void }) {
  const { save } = useStore()
  const [txid] = useState(() => novoTxid(plano.id))
  const [qr, setQr] = useState<string>('')
  const [copiado, setCopiado] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const codigo = pixConfigurado
    ? pixPayload({
        ...PIX_CONTA,
        valor: plano.price,
        txid,
        descricao: `VOCA PRO ${plano.title}`,
      })
    : ''

  useEffect(() => {
    if (!codigo) return
    QRCode.toDataURL(codigo, { width: 320, margin: 1, color: { dark: '#0E1116', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [codigo])

  async function jaPaguei() {
    setErro(null)
    if (!save.account) {
      setErro('Entre na sua conta antes de pagar — é nela que o plano é liberado.')
      return
    }
    try {
      await registrarPagamento(save.account.id, {
        plan: plano.id,
        amount: plano.price,
        days: plano.days,
        txid,
        email: save.account.email,
      })
      setEnviado(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'não deu para registrar')
    }
  }

  return (
    <div className="screen checkout">
      <header className="conv-top">
        <button className="x" onClick={onVoltar}>✕</button>
        <h2>Pagar com Pix · {plano.title}</h2>
      </header>

      {!pixConfigurado ? (
        <p className="offline-warn">
          A chave Pix ainda não foi configurada neste servidor. Quem cuida do app precisa definir
          <b> VITE_PIX_KEY</b>, <b>VITE_PIX_NAME</b> e <b>VITE_PIX_CITY</b> para o pagamento aparecer aqui.
        </p>
      ) : enviado ? (
        <div className="pix-ok">
          <span className="limit-emoji">✅</span>
          <h2>Pagamento registrado</h2>
          <p>
            Assim que o Pix cair, seu plano é liberado na conta <b>{save.account?.email}</b> — costuma
            levar poucas horas. Você não precisa pagar de novo.
          </p>
          <p className="muted small">
            Guarde o código do seu pagamento: <b>{txid}</b>
          </p>
          <button className="btn primary big" onClick={onExit}>Voltar a estudar</button>
        </div>
      ) : (
        <>
          <div className="pix-card">
            <p className="pix-valor">{reais(plano.price)}</p>
            <p className="muted">{plano.perMonth}</p>
            {qr && <img className="pix-qr" src={qr} alt="QR code do Pix" />}
            <button
              className="btn primary big"
              onClick={() => {
                navigator.clipboard?.writeText(codigo)
                setCopiado(true)
                setTimeout(() => setCopiado(false), 2500)
              }}
            >
              {copiado ? '✅ código copiado' : '📋 copiar código Pix'}
            </button>
            <details className="pix-code">
              <summary>ver o código copia e cola</summary>
              <p>{codigo}</p>
            </details>
            <p className="muted small">
              Recebedor: <b>{PIX_CONTA.nome}</b> · identificador: <b>{txid}</b>
            </p>
          </div>

          <h3 className="sec">Como funciona</h3>
          <ol className="passos">
            <li>Copie o código (ou leia o QR no app do seu banco).</li>
            <li>Pague o valor exato — o identificador <b>{txid}</b> vai junto e é por ele que encontramos seu pagamento.</li>
            <li>Volte aqui e toque em “já paguei”.</li>
            <li>Assim que o Pix cair, o PRO é liberado na sua conta.</li>
          </ol>

          {!save.account && (
            <p className="offline-warn">
              ⚠️ Você ainda não entrou numa conta. O plano fica preso à conta, então crie a sua antes
              de pagar (Perfil → criar conta).
            </p>
          )}

          <button className="btn primary big" onClick={jaPaguei} disabled={!save.account}>
            já paguei
          </button>
          {erro && <p className="test-fail">❌ {erro}</p>}
          <button className="btn ghost big" onClick={onVoltar}>escolher outro plano</button>
        </>
      )}
    </div>
  )
}
