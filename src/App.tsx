import { useEffect } from 'react'
import { useGame } from './game/state'
import { Attract } from './screens/Attract'
import { Register } from './screens/Register'
import { Briefing } from './screens/Briefing'
import { EvidenceRoom } from './screens/EvidenceRoom'
import { Interrogation } from './screens/Interrogation'
import { Accusation } from './screens/Accusation'
import { Result } from './screens/Result'
import { Admin } from './screens/Admin'

export default function App() {
  const { state, goto } = useGame()

  // rota /admin via hash (#/admin) + atalho de teclado Ctrl+Shift+A
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#/admin') goto('admin')
    }
    checkHash()
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') goto('admin')
    }
    window.addEventListener('hashchange', checkHash)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('hashchange', checkHash)
      window.removeEventListener('keydown', onKey)
    }
  }, [goto])

  switch (state.screen) {
    case 'attract':
      return <Attract />
    case 'register':
      return <Register />
    case 'briefing':
      return <Briefing />
    case 'evidence':
      return <EvidenceRoom />
    case 'interrogation':
      return <Interrogation />
    case 'accusation':
      return <Accusation />
    case 'result':
      return <Result />
    case 'admin':
      return <Admin />
  }
}
