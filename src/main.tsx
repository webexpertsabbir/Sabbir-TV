// Defensive safeguard: ensure window.fetch can be assigned safely without throwing getter-only TypeError
if (typeof window !== 'undefined') {
  try {
    const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (desc && desc.configurable && typeof desc.get === 'function' && typeof desc.set !== 'function') {
      const originalGet = desc.get;
      let overrideFetch: typeof window.fetch;
      let isOverridden = false;
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        enumerable: desc.enumerable ?? true,
        get() {
          return isOverridden ? overrideFetch : originalGet.call(this);
        },
        set(val) {
          overrideFetch = val;
          isOverridden = true;
        },
      });
    }
  } catch {
    // Ignore if not permitted
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
