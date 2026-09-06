import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { OAuthApp } from './OAuthApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OAuthApp />
  </StrictMode>,
)
