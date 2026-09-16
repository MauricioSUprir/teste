import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Lesson } from './screens/Lesson'
import { Conversation } from './screens/Conversation'
import { Profile } from './screens/Profile'
import { voicesReady } from './lib/speech'

export type View =
  | { name: 'home' }
  | { name: 'lesson'; lessonId: string }
  | { name: 'review' }
  | { name: 'conversa' }
  | { name: 'perfil' }

export function App() {
  const { save } = useStore()
  const [view, setView] = useState<View>({ name: 'home' })

  // carrega as vozes do navegador o quanto antes
  useEffect(() => {
    voicesReady(() => {})
  }, [])

  if (!save.profile.onboarded) return <Onboarding />

  switch (view.name) {
    case 'lesson':
      return <Lesson lessonId={view.lessonId} onExit={() => setView({ name: 'home' })} />
    case 'review':
      return <Lesson review onExit={() => setView({ name: 'home' })} />
    case 'conversa':
      return <Conversation onExit={() => setView({ name: 'home' })} />
    case 'perfil':
      return <Profile onExit={() => setView({ name: 'home' })} />
    default:
      return <Home go={setView} />
  }
}
