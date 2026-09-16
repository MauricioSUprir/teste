// Pix "copia e cola" (BR Code / EMV) gerado aqui mesmo, sem depender de
// gateway nenhum: a chave é sua, o dinheiro cai direto na sua conta.
// Formato oficial do Banco Central: campos id + tamanho + valor, com CRC16 no fim.

function campo(id: string, valor: string) {
  return id + String(valor.length).padStart(2, '0') + valor
}

/** Tira acento e o que o BR Code não aceita. */
function limpo(s: string, max: number) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, '')
    .trim()
    .slice(0, max)
}

function crc16(payload: string) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export type PixInfo = {
  chave: string
  nome: string
  cidade: string
  valor: number
  /** identificador do pagamento — é por ele que você confere quem pagou */
  txid: string
  descricao?: string
}

export function pixPayload({ chave, nome, cidade, valor, txid, descricao }: PixInfo) {
  const conta =
    campo('00', 'br.gov.bcb.pix') +
    campo('01', chave.trim()) +
    (descricao ? campo('02', limpo(descricao, 40)) : '')

  const corpo =
    campo('00', '01') + // versão do formato
    campo('26', conta) +
    campo('52', '0000') + // categoria do comércio
    campo('53', '986') + // moeda: real
    (valor > 0 ? campo('54', valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpo(nome, 25) || 'RECEBEDOR') +
    campo('60', limpo(cidade, 15) || 'SAO PAULO') +
    campo('62', campo('05', limpo(txid, 25) || '***'))

  const semCrc = corpo + '6304'
  return semCrc + crc16(semCrc)
}

/** Código curto e legível, usado para achar o pagamento depois. */
export function novoTxid(planoId: string) {
  const aleatorio = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `VOCA${planoId.slice(0, 3).toUpperCase()}${aleatorio}`
}

/** Dados da sua conta, vindos das variáveis de ambiente do build. */
export const PIX_CONTA = {
  chave: import.meta.env.VITE_PIX_KEY ?? '',
  nome: import.meta.env.VITE_PIX_NAME ?? '',
  cidade: import.meta.env.VITE_PIX_CITY ?? '',
}

export const pixConfigurado = !!PIX_CONTA.chave
