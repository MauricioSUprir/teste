// Conta: guarda o progresso na nuvem para não perder ao trocar de aparelho.
// Sem conta o app funciona igual — só fica preso àquele navegador.
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { accountsEnabled, currentSession, merge, pull, push, signIn, signOut, signUp } from '../lib/account'
import { Voca } from '../components/Voca'
import { getMood } from '../content/moods'

export function Account({ onExit }: { onExit: () => void }) {
  const { save, replaceAll } = useStore()
  const mood = getMood(save.profile.mood)
  const [modo, setModo] = useState<'entrar' | 'criar'>(save.account ? 'entrar' : 'criar')
  const [email, setEmail] = useState(save.account?.email ?? '')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    currentSession().then((s) => {
      if (s && !save.account) patchProfileAccount(s)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function patchProfileAccount(s: { id: string; email: string }) {
    replaceAll({ ...save, account: s })
  }

  async function sincronizar(conta: { id: string; email: string }) {
    const nuvem = await pull()
    const juntos = nuvem?.save ? merge({ ...save, account: conta }, nuvem.save) : { ...save, account: conta }
    const final = {
      ...juntos,
      account: conta,
      plan: nuvem?.plan ?? juntos.plan,
      proUntil: nuvem?.proUntil ?? juntos.proUntil,
      syncedAt: Date.now(),
    }
    replaceAll(final)
    await push(conta.id, final)
  }

  async function entrar() {
    setErro(null)
    setOcupado(true)
    try {
      const conta = await signIn(email.trim(), senha)
      await sincronizar(conta)
      setAviso('Pronto! Seu progresso está salvo na conta.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'não deu certo')
    }
    setOcupado(false)
  }

  async function criar() {
    setErro(null)
    setOcupado(true)
    try {
      const conta = await signUp(email.trim(), senha, save.profile.name)
      if (!conta) {
        setAviso('Conta criada! Confirme o e-mail que acabamos de enviar e depois entre aqui.')
        setModo('entrar')
      } else {
        await sincronizar(conta)
        setAviso('Conta criada e progresso salvo.')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'não deu certo')
    }
    setOcupado(false)
  }

  async function sair() {
    await signOut()
    replaceAll({ ...save, account: null, syncedAt: null })
    setAviso('Você saiu. O progresso continua salvo neste aparelho.')
  }

  if (!accountsEnabled)
    return (
      <div className="screen">
        <header className="conv-top">
          <button className="x" onClick={onExit}>✕</button>
          <h2>Conta</h2>
        </header>
        <p className="offline-warn">
          Este servidor está sem banco de contas configurado. O progresso continua salvo neste
          navegador normalmente.
        </p>
      </div>
    )

  return (
    <div className="screen account">
      <header className="conv-top">
        <button className="x" onClick={onExit}>✕</button>
        <h2>Sua conta</h2>
      </header>

      <div className="acc-hero">
        <Voca state="idle" face={mood.face} color={mood.color} size={110} />
        <p className="muted">
          Com conta, seu XP, ofensiva e revisões ficam guardados na nuvem — dá para continuar no
          celular de onde parou no computador.
        </p>
      </div>

      {save.account ? (
        <div className="acc-box">
          <p className="ai-status">✅ conectada como <b>{save.account.email}</b></p>
          <p className="muted small">
            {save.syncedAt ? `última sincronização: ${new Date(save.syncedAt).toLocaleString('pt-BR')}` : 'ainda não sincronizou'}
            {' · '}plano: <b>{save.plan === 'pro' ? 'PRO' : 'grátis'}</b>
          </p>
          <div className="row">
            <button
              className="btn primary"
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true)
                try {
                  await sincronizar(save.account!)
                  setAviso('Progresso salvo na nuvem.')
                } catch (e) {
                  setErro(e instanceof Error ? e.message : 'falhou')
                }
                setOcupado(false)
              }}
            >
              salvar agora
            </button>
            <button className="btn ghost" onClick={sair}>sair da conta</button>
          </div>
        </div>
      ) : (
        <div className="acc-box">
          <div className="tabs">
            <button className={modo === 'criar' ? 'on' : ''} onClick={() => setModo('criar')}>criar conta</button>
            <button className={modo === 'entrar' ? 'on' : ''} onClick={() => setModo('entrar')}>já tenho conta</button>
          </div>
          <label className="field">
            <span>E-mail</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="voce@email.com" />
          </label>
          <label className="field">
            <span>Senha {modo === 'criar' && <small className="muted">(mínimo 6 caracteres)</small>}</span>
            <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} />
          </label>
          <button
            className="btn primary big"
            disabled={ocupado || !email.trim() || senha.length < 6}
            onClick={modo === 'criar' ? criar : entrar}
          >
            {ocupado ? 'um instante…' : modo === 'criar' ? 'criar minha conta' : 'entrar'}
          </button>
        </div>
      )}

      {erro && <p className="test-fail">❌ {erro}</p>}
      {aviso && <p className="test-ok">{aviso}</p>}

      <p className="muted small">
        Guardamos só o que o app precisa: seu nome, e-mail e o progresso do estudo. Nada de áudio,
        nada de conversa — isso nunca sai do seu aparelho.
      </p>
    </div>
  )
}
