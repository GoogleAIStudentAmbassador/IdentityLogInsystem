import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { HomeApp } from './HomeApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomeApp />
  </StrictMode>,
)
