import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { OrganizerApp } from './OrganizerApp.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OrganizerApp />
  </StrictMode>,
);
