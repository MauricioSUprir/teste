/**
 * Menu principal e telas de apoio (carregar, créditos, pausa).
 *
 * O fundo é a própria cidade renderizada por uma câmera cinematográfica, o que
 * evita imagem estática e mostra o jogo real desde a primeira tela.
 */

import { botao, el, limpar } from './dom'
import { formatarData, formatarDuracao, type ResumoSave } from '../save/save'
import { keyLabel } from '../core/input'
import type { KeyBindings } from '../core/settings'

export interface AcaoMenu {
  id: 'novo' | 'continuar' | 'carregar' | 'personalizar' | 'config' | 'creditos' | 'sair' | 'salvar' | 'voltar'
  titulo: string
  descricao: string
  disponivel: boolean
  motivo?: string
}

export class MainMenu {
  readonly root: HTMLElement
  private lista: HTMLElement

  constructor(
    private readonly aoEscolher: (id: AcaoMenu['id']) => void,
    private readonly versao: string,
  ) {
    this.lista = el('div', { class: 'menu-lista' })
    const marca = el('div', { class: 'marca' }, [
      el('div', { class: 'nome', html: 'THE <em>GROUNDS</em>' }),
      el('div', { class: 'cidade', text: 'Vila Preciosa' }),
      el('div', { class: 'traco' }),
    ])
    const lateral = el('div', { class: 'menu-lateral' }, [
      marca,
      this.lista,
      el('div', { class: 'menu-rodape', text: `Versão ${this.versao} · Projeto original` }),
    ])
    this.root = el('div', { class: 'tela tela-menu' }, [lateral, el('div')])
  }

  definirOpcoes(opcoes: AcaoMenu[]): void {
    limpar(this.lista)
    opcoes.forEach((o, i) => {
      const b = el('button', { class: `menu-item ${o.disponivel ? '' : 'indisponivel'}` })
      b.style.animationDelay = `${i * 45}ms`
      b.append(
        el('span', {}, [
          el('span', { text: o.titulo }),
          el('span', { class: 'sub', text: o.disponivel ? o.descricao : (o.motivo ?? o.descricao) }),
        ]),
      )
      b.disabled = !o.disponivel
      b.addEventListener('click', () => this.aoEscolher(o.id))
      this.lista.append(b)
    })
  }
}

/** Tela de seleção de save. */
export class LoadScreen {
  readonly root: HTMLElement

  constructor(
    resumos: ResumoSave[],
    aoCarregar: (slot: number) => void,
    aoApagar: (slot: number) => void,
    aoFechar: () => void,
  ) {
    const corpo = el('div', { class: 'corpo' })
    for (const r of resumos) {
      const linha = el('div', { class: 'campo' })
      linha.style.gridTemplateColumns = '1fr auto auto'
      const info = el('div')
      if (r.existe) {
        info.append(
          el('div', { text: `Espaço ${r.slot + 1} — ${r.nome}` }),
          el('div', {
            class: 'sub',
            text: `${r.bairro} · ${formatarDuracao(r.tempoJogado)} · ${formatarData(r.atualizadoEm)}`,
          }),
        )
        ;(info.lastChild as HTMLElement).style.cssText = 'font-size:12px;color:#7e8f9e;margin-top:3px'
      } else {
        info.append(el('div', { text: `Espaço ${r.slot + 1} — vazio` }))
        info.style.color = '#5d6b78'
      }
      linha.append(
        info,
        botao('Carregar', () => aoCarregar(r.slot), { desabilitado: !r.existe, classe: 'primario' }),
        botao('Apagar', () => aoApagar(r.slot), { desabilitado: !r.existe, classe: 'perigo' }),
      )
      corpo.append(linha)
    }

    const painel = el('div', { class: 'painel' }, [
      el('header', {}, [el('h2', { text: 'Continuar' }), el('span', { class: 'dica', text: 'Três espaços de salvamento' })]),
      corpo,
      el('footer', {}, [botao('Voltar', aoFechar, { classe: 'primario' })]),
    ])
    this.root = el('div', { class: 'tela tela-painel' }, [painel])
  }
}

/** Créditos e lista de controles. */
export class CreditsScreen {
  readonly root: HTMLElement

  constructor(bindings: KeyBindings, aoFechar: () => void) {
    const tecla = (c: string) => `<b style="color:#eef3f7">${keyLabel(c)}</b>`
    const corpo = el('div', { class: 'corpo' })

    corpo.append(
      el('section', { class: 'secao' }, [
        el('h3', { text: 'A pé' }),
        el('div', {
          class: 'aviso-indisponivel',
          html: `${tecla(bindings.frente)}${tecla(bindings.esquerda)}${tecla(bindings.tras)}${tecla(bindings.direita)} andar · `
            + `${tecla(bindings.correr)} correr · ${tecla(bindings.pular)} pular e transpor · `
            + `${tecla(bindings.agachar)} agachar<br>`
            + `Mouse: olhar · Roda: aproximar a câmera<br>`
            + `${tecla(bindings.interagir)} interagir · ${tecla(bindings.primeiraPessoa)} primeira pessoa · `
            + `${tecla(bindings.trocarCamera)} trocar câmera · ${tecla(bindings.foto)} modo fotografia`,
        }),
      ]),
      el('section', { class: 'secao' }, [
        el('h3', { text: 'Futebol' }),
        el('div', {
          class: 'aviso-indisponivel',
          html: `${tecla(bindings.chutar)} chutar (segurar carrega a força) · ${tecla(bindings.passar)} passar · `
            + `${tecla(bindings.drible)} drible · ${tecla(bindings.carrinho)} carrinho`,
        }),
      ]),
      el('section', { class: 'secao' }, [
        el('h3', { text: 'Ao volante' }),
        el('div', {
          class: 'aviso-indisponivel',
          html: `${tecla(bindings.frente)} acelerar · ${tecla(bindings.tras)} frear e ré · `
            + `${tecla(bindings.esquerda)}${tecla(bindings.direita)} dirigir · ${tecla(bindings.freioMao)} freio de mão · `
            + `${tecla(bindings.buzina)} buzina · ${tecla(bindings.faroisLuz)} faróis · `
            + `${tecla(bindings.trocarCamera)} câmera interna · ${tecla(bindings.interagir)} sair`,
        }),
      ]),
      el('section', { class: 'secao' }, [
        el('h3', { text: 'Como o jogo foi feito' }),
        el('div', {
          class: 'aviso-indisponivel',
          html: 'A cidade, os personagens, os veículos, as animações e todos os sons são <b>gerados por código</b> '
            + 'a partir de sementes determinísticas — não há modelos, animações ou áudios importados.<br><br>'
            + '<b>Materiais fotogramétricos:</b> Poly Haven (CC0 / domínio público), baixados em tempo de execução. '
            + 'Sem internet, o jogo usa as texturas procedurais que já vêm embutidas.<br>'
            + '<b>Renderização:</b> three.js (MIT).<br>'
            + '<b>Inspiração declarada:</b> a liberdade de exploração urbana dos jogos de mundo aberto e o futebol '
            + 'de rua. Nenhum mapa, personagem, marca ou interface de terceiros foi copiado.',
        }),
      ]),
    )

    const painel = el('div', { class: 'painel' }, [
      el('header', {}, [el('h2', { text: 'Créditos e controles' })]),
      corpo,
      el('footer', {}, [botao('Voltar', aoFechar, { classe: 'primario' })]),
    ])
    this.root = el('div', { class: 'tela tela-painel' }, [painel])
  }
}

/** Menu de pausa dentro do jogo. */
export class PauseMenu {
  readonly root: HTMLElement

  constructor(aoEscolher: (id: AcaoMenu['id']) => void, podeSalvar: boolean) {
    const corpo = el('div', { class: 'corpo' })
    const itens: [AcaoMenu['id'], string, string, boolean][] = [
      ['voltar', 'Continuar jogando', 'Fecha a pausa', true],
      ['salvar', 'Salvar', podeSalvar ? 'Grava o progresso no espaço atual' : 'Armazenamento indisponível neste navegador', podeSalvar],
      ['personalizar', 'Personalizar personagem', 'Editar aparência sem sair do jogo', true],
      ['config', 'Configurações', 'Gráficos, áudio, controles', true],
      ['creditos', 'Créditos e controles', 'Referência rápida', true],
      ['sair', 'Sair para o menu', 'O progresso não salvo é perdido', true],
    ]
    for (const [id, titulo, desc, ok] of itens) {
      const b = el('button', { class: `menu-item ${ok ? '' : 'indisponivel'}` })
      b.append(el('span', {}, [el('span', { text: titulo }), el('span', { class: 'sub', text: desc })]))
      b.disabled = !ok
      b.addEventListener('click', () => aoEscolher(id))
      corpo.append(b)
    }

    const painel = el('div', { class: 'painel' }, [
      el('header', {}, [el('h2', { text: 'Pausa' }), el('span', { class: 'dica', text: 'Esc para voltar' })]),
      corpo,
      el('footer', {}, []),
    ])
    painel.style.maxWidth = '520px'
    this.root = el('div', { class: 'tela tela-painel' }, [painel])
  }
}
