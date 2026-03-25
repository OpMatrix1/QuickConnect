import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Auto-update the SW; prompt user when a new version is waiting
registerSW({
  onNeedRefresh() {
    if (confirm('A new version of QuickConnect is available. Reload to update?')) {
      window.location.reload()
    }
  },
  onOfflineReady() {
    console.log('QuickConnect is ready to work offline')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
