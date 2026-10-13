import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoot } from './app/app-root';

const container = document.getElementById('root');
if (!container) {
  throw new Error('index.html must provide a #root element');
}

createRoot(container).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
