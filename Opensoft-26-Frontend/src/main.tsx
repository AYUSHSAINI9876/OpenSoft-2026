import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

document.documentElement.classList.remove('theme-light', 'theme-midnight')
document.documentElement.style.colorScheme = 'dark'
localStorage.removeItem('theme')

const container = document.getElementById('root')!

// createRoot clears the container on mount, but removing the pre-render splash
// explicitly keeps the transition deterministic across React versions.
document.getElementById('app-splash')?.remove()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
