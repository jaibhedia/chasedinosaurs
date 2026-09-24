import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import App from './App';
import { captureInstallPrompt } from './lib/platform';
import './index.css';

captureInstallPrompt();

// No React.StrictMode — Strict Mode's double-mount causes Phaser's WebGL
// context to throw "Framebuffer Incomplete Attachment" when the first mount
// is torn down and the second fires against the already-destroyed GL context.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
