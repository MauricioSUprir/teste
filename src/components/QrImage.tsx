import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Renderiza um QR code gerado localmente (funciona offline). */
export function QrImage({ value, size = 132, label }: { value: string; size?: number; label?: string }) {
  const [src, setSrc] = useState<string>('')

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2,
      color: { dark: '#14171C', light: '#EDE7DA' },
    })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''))
    return () => {
      alive = false
    }
  }, [value, size])

  if (!src) return null
  return (
    <div className="qr-box">
      <img src={src} alt="QR code" style={{ width: size, height: size }} />
      {label && <span>{label}</span>}
    </div>
  )
}
