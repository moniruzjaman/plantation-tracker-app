import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { migrateFromLocalStorage } from './lib/db';

// Kick off IndexedDB migration ASAP (non-blocking)
migrateFromLocalStorage().then(() => {
  console.log('[App] IndexedDB ready');
}).catch((err) => {
  console.error('[App] IndexedDB migration failed:', err);
});

const updateSW = registerSW({
  onNeedRefresh() {
    console.log('App updated. Need refresh.');
  },
  onOfflineReady() {
    console.log('Offline ready');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);