import './style.css'
import { runSmoke } from './dev/smoke'
import { runCharTest } from './dev/charTest'

const app = document.getElementById('app')!
const canvas = document.createElement('canvas')
canvas.id = 'view'
app.appendChild(canvas)

const cena = new URLSearchParams(location.search).get('cena') ?? 'cidade'
if (cena === 'personagem') void runCharTest(canvas)
else void runSmoke(canvas)
