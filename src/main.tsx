import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { initZoomLockFromStorage } from '@/lib/zoomLock'
import './styles/global.css'

initZoomLockFromStorage()
registerSW({ immediate: true })

const root = document.getElementById('root')
if (!root) {
  throw new Error('No se encontró #root')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
