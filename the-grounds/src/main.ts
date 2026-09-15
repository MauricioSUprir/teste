import './style.css'
import { runSmoke } from './dev/smoke'
import { runCharTest } from './dev/charTest'
import { runPlayTest } from './dev/playTest'

const app = document.getElementById('app')!
const canvas = document.createElement('canvas')
canvas.id = 'view'
app.appendChild(canvas)

const cena = new URLSearchParams(location.search).get('cena') ?? 'jogo'
if (cena === 'personagem') void runCharTest(canvas)
else if (cena === 'cidade') void runSmoke(canvas)
else void runPlayTest(canvas)
