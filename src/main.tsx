import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { GameProvider } from './game/state'
import { detectQrEntry } from './qr/entry'
import './styles.css'

// Detecta ANTES de renderizar se esta visita chegou pelo QR code
// (?entrada=qr): registra a entrada e marca a sessao.
const viaQr = detectQrEntry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameProvider viaQr={viaQr}>
      <App />
    </GameProvider>
  </React.StrictMode>,
)
