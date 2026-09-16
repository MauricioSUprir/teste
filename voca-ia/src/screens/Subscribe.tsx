// Página de assinatura. A cobrança ainda NÃO está ligada: enquanto
// PAYWALL_ON for falso, tudo continua liberado e esta tela só apresenta os
// planos. Quando ligar, basta apontar CHECKOUT_URL para o pagamento.
import { useStore } from '../state/store'
import { CHECKOUT_URL, PAYWALL_ON, PLANS, PRO_FEATURES, isPro, type ProFeature } from '../lib/plan'
import { Voca } from '../components/Voca'
import { getMood } from '../content/moods'

export function Subscribe({ feature, onExit }: { feature?: ProFeature; onExit: () => void }) {
  const { save } = useStore()
  const mood = getMood(save.profile.mood)
  const pro = isPro(save)

  return (
    <div className="screen subscribe">
      <header className="conv-top">
        <button className="x" onClick={onExit}>✕</button>
        <h2>VOCA PRO</h2>
      </header>

      <div className="sub-hero">
        <Voca state="talking" face={mood.face} color={mood.color} size={120} energy={0.6} />
        <h1>{pro ? 'Você já é PRO' : feature ? PRO_FEATURES[feature].title : 'Libere o Voca por inteiro'}</h1>
        <p className="muted">
          {pro
            ? 'Tudo liberado. Bons estudos.'
            : feature
              ? PRO_FEATURES[feature].desc
              : 'As lições, a revisão e os vídeos são de graça para sempre. O que usa IA entra no plano PRO.'}
        </p>
      </div>

      {!PAYWALL_ON && (
        <p className="free-now">
          🎉 Enquanto estamos em testes, <b>tudo isso está liberado de graça</b>. Esta página é só
          para você ver o que vem por aí.
        </p>
      )}

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

      <h3 className="sec">Planos</h3>
      <div className="plans">
        {PLANS.map((p) => (
          <div key={p.id} className="plan">
            <div className="plan-head">
              <b>{p.title}</b>
              {p.badge && <span className="pill free">{p.badge}</span>}
            </div>
            <p className="price">
              {p.price}
              <small>{p.period}</small>
            </p>
            <ul>
              {p.perks.map((x) => (
                <li key={x}>✓ {x}</li>
              ))}
            </ul>
            {CHECKOUT_URL ? (
              <a className="btn primary big" href={`${CHECKOUT_URL}?plano=${p.id}`} target="_blank" rel="noreferrer">
                assinar
              </a>
            ) : (
              <button className="btn primary big" disabled title="pagamento ainda não ativado">
                em breve
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="muted small">
        O pagamento ainda não está ativo — nenhuma cobrança é feita. Quando estiver, o plano fica
        preso à sua conta, então vale criar uma agora para não perder o progresso.
      </p>
      <button className="btn ghost big" onClick={onExit}>Voltar</button>
    </div>
  )
}
