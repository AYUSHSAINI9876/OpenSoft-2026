import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

document.documentElement.classList.remove('theme-light', 'theme-midnight')
document.documentElement.style.colorScheme = 'dark'
localStorage.removeItem('theme')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
