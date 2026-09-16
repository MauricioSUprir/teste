// Clipe didatico que aparece na correcao: uma fala real de filme/serie/desenho
// com a MESMA estrutura que a pessoa acabou de errar.
import { useState } from 'react'
import { youglishUrl, youtubeSearch, type Clip } from '../content/clips'

export function ClipCard({ clip, phrase, lang }: { clip: Clip; phrase: string; lang: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="clip">
      <button className="clip-head" onClick={() => setOpen((o) => !o)}>
        <span className="clip-kind">🎬 {clip.kind}</span>
        <b>{clip.title}</b>
        <span className="clip-toggle">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="clip-body">
          <p className="clip-line">“{clip.line}”</p>
          <p className="clip-pt">{clip.linePt}</p>
          <p className="clip-note">
            <b>O que observar:</b> {clip.note}
          </p>
          <div className="clip-links">
            <a href={youtubeSearch(clip.search)} target="_blank" rel="noreferrer" className="btn ghost sm">
              ▶ Ver a cena
            </a>
            <a href={youglishUrl(phrase, lang)} target="_blank" rel="noreferrer" className="btn ghost sm">
              🎧 Ouvir essa frase em vídeos reais
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
