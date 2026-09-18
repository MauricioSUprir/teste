// Configuração da IA. Dá para ligar MAIS DE UM serviço ao mesmo tempo e dizer
// qual manda em quê: um rápido para conversar, um melhor para explicar. Se um
// estourar o limite do plano grátis, o outro assume sozinho.
import { useEffect, useState } from 'react'
import { PROVIDERS, chainFor, configured, getAi, setAi, testAi, resetServerCheck, type AiConfig } from '../lib/api'

export function AiSetup({ langName }: { langName: string }) {
  const [cfg, setCfg] = useState<AiConfig>(() => getAi())
  const [aberto, setAberto] = useState<string | null>(null)
  const [status, setStatus] = useState<'checando' | 'servidor' | 'ligada' | 'desligada'>('checando')
  const [testando, setTestando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; message: string } | null>(null)
  const prontos = configured(cfg)
  const turbo = prontos.length >= 2

  useEffect(() => {
    resetServerCheck()
    fetch('/api/health')
      .then((r) => r.json())
      .then((j) => setStatus(j?.key ? 'servidor' : prontos.length ? 'ligada' : 'desligada'))
      .catch(() => setStatus(prontos.length ? 'ligada' : 'desligada'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg])

  function salvar(next: AiConfig) {
    // garante que sempre existe um preferido válido
    const p = configured(next)
    const fix = { ...next, fast: p.includes(next.fast) ? next.fast : (p[0] ?? ''), smart: p.includes(next.smart) ? next.smart : (p[0] ?? '') }
    setCfg(fix)
    setAi(fix)
    setResultado(null)
  }

  function mudarChave(id: string, apiKey: string) {
    salvar({ ...cfg, slots: { ...cfg.slots, [id]: { model: cfg.slots[id]?.model ?? '', apiKey } } })
  }

  function mudarModelo(id: string, model: string) {
    salvar({ ...cfg, slots: { ...cfg.slots, [id]: { model, apiKey: cfg.slots[id]?.apiKey ?? '' } } })
  }

  function remover(id: string) {
    const slots = { ...cfg.slots }
    delete slots[id]
    salvar({ ...cfg, slots })
  }

  return (
    <div className={`ai-box ${status === 'desligada' ? 'off' : 'on'}`}>
      <p className="ai-status">
        {status === 'checando' && 'verificando…'}
        {status === 'servidor' && 'IA ligada — já configurada no servidor, você não precisa fazer nada.'}
        {status === 'ligada' &&
          (turbo
            ? `Modo turbo: ${prontos.length} serviços ligados, um cobrindo o outro.`
            : `IA ligada com ${PROVIDERS.find((p) => p.id === prontos[0])?.label}.`)}
        {status === 'desligada' && 'Sem IA: a conversa roda no modo offline (perguntas do próprio curso).'}
      </p>

      {status !== 'servidor' && (
        <>
          <p className="muted small">
            Escolha um ou <b>vários</b> serviços. A maioria tem plano grátis: você cria a chave no
            site deles e cola aqui — ela fica salva só neste navegador.
          </p>

          <div className="prov-list">
            {PROVIDERS.map((p) => {
              const ligado = prontos.includes(p.id)
              const expandido = aberto === p.id
              return (
                <div key={p.id} className={`prov ${ligado ? 'on' : ''}`}>
                  <button className="prov-open" onClick={() => setAberto(expandido ? null : p.id)}>
                    <div className="prov-head">
                      <b>
                        {ligado ? '' : ''}
                        {p.label}
                      </b>
                      <span className={p.free.startsWith('Não') ? 'pill paid' : 'pill free'}>
                        {p.free.startsWith('Não') ? 'pago' : 'tem grátis'}
                      </span>
                      <span className="clip-toggle">{expandido ? '−' : '+'}</span>
                    </div>
                    <small>
                      <b>Qualidade:</b> {p.quality}
                    </small>
                    <small>
                      <b>Velocidade:</b> {p.speed}
                    </small>
                  </button>

                  {expandido && (
                    <div className="prov-setup">
                      <p className="muted small">{p.free}</p>
                      <label className="field">
                        <span>
                          Chave
                          {p.id !== 'ollama' && (
                            <>
                              {' · '}
                              <a href={p.signup} target="_blank" rel="noreferrer">
                                pegar a chave aqui
                              </a>
                            </>
                          )}
                        </span>
                        <input
                          type="password"
                          value={cfg.slots[p.id]?.apiKey ?? ''}
                          onChange={(e) => mudarChave(p.id, e.target.value)}
                          placeholder={p.id === 'ollama' ? '(não precisa de chave)' : 'cole a chave aqui'}
                          autoComplete="off"
                        />
                      </label>
                      <label className="field">
                        <span>Modelo</span>
                        <input
                          value={cfg.slots[p.id]?.model ?? ''}
                          onChange={(e) => mudarModelo(p.id, e.target.value)}
                          placeholder={p.model}
                        />
                      </label>
                      {ligado && (
                        <button className="btn ghost sm" onClick={() => remover(p.id)}>
                          remover este serviço
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {turbo && (
            <div className="turbo">
              <b>Modo turbo — quem faz o quê</b>
              <p className="muted small">
                Se o escolhido falhar ou bater no limite do plano grátis, o outro assume na hora,
                sem você perceber.
              </p>
              <label className="field">
                <span>Conversa e dicas (aqui vale a rapidez)</span>
                <select value={cfg.fast} onChange={(e) => salvar({ ...cfg, fast: e.target.value })}>
                  {prontos.map((id) => (
                    <option key={id} value={id}>
                      {PROVIDERS.find((p) => p.id === id)?.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Explicação, dúvidas e relatório (aqui vale acertar)</span>
                <select value={cfg.smart} onChange={(e) => salvar({ ...cfg, smart: e.target.value })}>
                  {prontos.map((id) => (
                    <option key={id} value={id}>
                      {PROVIDERS.find((p) => p.id === id)?.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted small">
                Ordem na conversa: {chainFor('fast', cfg).map((c) => c.provider).join(' → ')}
                {' · '}na explicação: {chainFor('smart', cfg).map((c) => c.provider).join(' → ')}
              </p>
            </div>
          )}

          {prontos.length > 0 && (
            <>
              <button
                className="btn primary"
                disabled={testando}
                onClick={async () => {
                  setTestando(true)
                  setResultado(await testAi(langName))
                  setTestando(false)
                }}
              >
                {testando ? 'testando…' : 'testar conexão'}
              </button>
              {resultado && (
                <p className={resultado.ok ? 'test-ok' : 'test-fail'}>
                  {resultado.ok ? `funcionou — ele respondeu: “${resultado.message}”` : `${resultado.message}`}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
