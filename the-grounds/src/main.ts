import './style.css'
import { runSmoke } from './dev/smoke'

const app = document.getElementById('app')!
const canvas = document.createElement('canvas')
canvas.id = 'view'
app.appendChild(canvas)
void runSmoke(canvas)
