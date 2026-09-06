import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ShareApp } from './ShareApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShareApp />
  </StrictMode>,
);
