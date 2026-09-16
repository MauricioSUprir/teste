import { useEffect, useRef, useState } from 'react'
import { useStore } from './state/store'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Lesson } from './screens/Lesson'
import { Conversation } from './screens/Conversation'
import { Profile } from './screens/Profile'
import { Placement } from './screens/Placement'
import { Account } from './screens/Account'
import { Subscribe } from './screens/Subscribe'
import { voicesReady } from './lib/speech'
import { currentSession, merge, pull, push, accountsEnabled } from './lib/account'
import type { ProFeature } from './lib/plan'

export type View =
  | { name: 'home' }
  | { name: 'lesson'; lessonId: string }
  | { name: 'review' }
  | { name: 'conversa' }
  | { name: 'perfil' }
  | { name: 'nivelamento'; langId: string }
  | { name: 'conta' }
  | { name: 'assinar'; feature?: ProFeature }

export function App() {
  const { save, replaceAll } = useStore()
  const [view, setView] = useState<View>({ name: 'home' })
  const sincronizando = useRef(false)

  useEffect(() => {
    voicesReady(() => {})
  }, [])

  // conta: ao abrir, traz o progresso da nuvem e junta com o daqui
  useEffect(() => {
    if (!accountsEnabled || sincronizando.current) return
    sincronizando.current = true
    currentSession().then(async (conta) => {
      if (!conta) return
      const nuvem = await pull()
      const juntos = nuvem?.save ? merge({ ...save, account: conta }, nuvem.save) : { ...save, account: conta }
      replaceAll({
        ...juntos,
        account: conta,
        plan: nuvem?.plan ?? juntos.plan,
        proUntil: nuvem?.proUntil ?? juntos.proUntil,
        syncedAt: Date.now(),
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // salva na nuvem de tempos em tempos, sem atrapalhar o estudo
  useEffect(() => {
    if (!save.account) return
    const t = setTimeout(() => {
      push(save.account!.id, save).catch(() => {
        /* sem rede: tenta na proxima */
      })
    }, 8000)
    return () => clearTimeout(t)
  }, [save])

  if (!save.profile.onboarded) return <Onboarding go={setView} />

  switch (view.name) {
    case 'lesson':
      return <Lesson lessonId={view.lessonId} onExit={() => setView({ name: 'home' })} onPaywall={() => setView({ name: 'assinar', feature: 'explicacao' })} />
    case 'review':
      return <Lesson review onExit={() => setView({ name: 'home' })} onPaywall={() => setView({ name: 'assinar', feature: 'explicacao' })} />
    case 'conversa':
      return <Conversation onExit={() => setView({ name: 'home' })} />
    case 'perfil':
      return <Profile go={setView} onExit={() => setView({ name: 'home' })} />
    case 'nivelamento':
      return <Placement langId={view.langId} onDone={() => setView({ name: 'home' })} />
    case 'conta':
      return <Account onExit={() => setView({ name: 'perfil' })} />
    case 'assinar':
      return <Subscribe feature={view.feature} onExit={() => setView({ name: 'home' })} />
    default:
      return <Home go={setView} />
  }
}
