import './style.css'
import { App } from './app'
import { runSmoke } from './dev/smoke'
import { runCharTest } from './dev/charTest'
import { runPlayTest } from './dev/playTest'

const raiz = document.getElementById('app')!
const canvas = document.createElement('canvas')
canvas.id = 'view'
raiz.appendChild(canvas)

const cena = new URLSearchParams(location.search).get('cena')
if (cena === 'personagem') void runCharTest(canvas)
else if (cena === 'cidade') void runSmoke(canvas)
else if (cena === 'jogo') void runPlayTest(canvas)
else void new App(canvas, raiz).iniciar()
