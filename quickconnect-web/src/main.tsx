import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Prompt mode (see vite.config): no silent reload — avoids losing in-memory state / surprise "logouts"
registerSW({
  onNeedRefresh() {
    // Non-blocking: full-page reload only if the user opts in (avoids auth race with forced reload)
    const apply = window.confirm(
      'A new version of QuickConnect is ready. Reload now to update? You may need to sign in again if you cancel and reload later.'
    )
    if (apply) {
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
