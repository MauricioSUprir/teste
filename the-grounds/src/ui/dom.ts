/**
 * Utilidades mínimas de interface em DOM.
 *
 * A interface do jogo é construída em HTML sobre o canvas: o texto fica nítido
 * em qualquer resolução (inclusive 4K), a acessibilidade do navegador funciona
 * e o custo de desenho é irrelevante perto da cena 3D.
 */

export type El = HTMLElement

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<{ class: string; text: string; html: string; id: string; title: string }> = {},
  filhos: (El | string | null)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (props.class) node.className = props.class
  if (props.id) node.id = props.id
  if (props.title) node.title = props.title
  if (props.text !== undefined) node.textContent = props.text
  if (props.html !== undefined) node.innerHTML = props.html
  for (const f of filhos) {
    if (f === null) continue
    node.append(typeof f === 'string' ? document.createTextNode(f) : f)
  }
  return node
}

export function botao(
  rotulo: string, onClick: () => void,
  opts: { classe?: string; desabilitado?: boolean; dica?: string } = {},
): HTMLButtonElement {
  const b = el('button', { class: `btn ${opts.classe ?? ''}`.trim(), text: rotulo })
  if (opts.dica) b.title = opts.dica
  if (opts.desabilitado) { b.disabled = true; b.classList.add('desabilitado') }
  b.addEventListener('click', (e) => { e.preventDefault(); onClick() })
  return b
}

/** Controle deslizante com rótulo e valor formatado. */
export function slider(
  rotulo: string, min: number, max: number, step: number, valor: number,
  onChange: (v: number) => void,
  formatar: (v: number) => string = (v) => v.toFixed(2),
): El {
  const linha = el('div', { class: 'campo' })
  const lab = el('label', { text: rotulo })
  const val = el('span', { class: 'valor', text: formatar(valor) })
  const input = el('input', { class: 'slider' }) as HTMLInputElement
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.value = String(valor)
  input.addEventListener('input', () => {
    const v = Number(input.value)
    val.textContent = formatar(v)
    onChange(v)
  })
  linha.append(lab, input, val)
  return linha
}

/** Seletor de opções em linha (mais rápido de usar que um <select>). */
export function opcoes<T extends string | number>(
  rotulo: string, itens: { valor: T; texto: string }[], atual: T,
  onChange: (v: T) => void,
): El {
  const linha = el('div', { class: 'campo' })
  const lab = el('label', { text: rotulo })
  const grupo = el('div', { class: 'grupo-opcoes' })
  const botoes: HTMLButtonElement[] = []
  for (const it of itens) {
    const b = el('button', { class: 'opcao', text: it.texto })
    if (it.valor === atual) b.classList.add('ativa')
    b.addEventListener('click', (e) => {
      e.preventDefault()
      for (const o of botoes) o.classList.remove('ativa')
      b.classList.add('ativa')
      onChange(it.valor)
    })
    botoes.push(b)
    grupo.append(b)
  }
  linha.append(lab, grupo)
  return linha
}

export function alternador(rotulo: string, valor: boolean, onChange: (v: boolean) => void): El {
  const linha = el('div', { class: 'campo' })
  const lab = el('label', { text: rotulo })
  const b = el('button', { class: `alternador ${valor ? 'ligado' : ''}`, text: valor ? 'Ligado' : 'Desligado' })
  b.addEventListener('click', (e) => {
    e.preventDefault()
    valor = !valor
    b.classList.toggle('ligado', valor)
    b.textContent = valor ? 'Ligado' : 'Desligado'
    onChange(valor)
  })
  linha.append(lab, b)
  return linha
}

/** Amostra de cor clicável (paleta). */
export function paleta(
  rotulo: string, cores: readonly number[], atual: number, onChange: (c: number) => void,
): El {
  const linha = el('div', { class: 'campo campo-paleta' })
  const lab = el('label', { text: rotulo })
  const grade = el('div', { class: 'paleta' })
  const amostras: HTMLElement[] = []
  for (const c of cores) {
    const a = el('button', { class: 'cor' })
    a.style.background = `#${c.toString(16).padStart(6, '0')}`
    if (c === atual) a.classList.add('ativa')
    a.addEventListener('click', (e) => {
      e.preventDefault()
      for (const o of amostras) o.classList.remove('ativa')
      a.classList.add('ativa')
      onChange(c)
    })
    amostras.push(a)
    grade.append(a)
  }
  linha.append(lab, grade)
  return linha
}

export function secao(titulo: string, filhos: El[]): El {
  return el('section', { class: 'secao' }, [el('h3', { text: titulo }), ...filhos])
}

export function limpar(node: El): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}
