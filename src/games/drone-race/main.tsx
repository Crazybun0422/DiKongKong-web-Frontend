import { createRoot } from 'react-dom/client';
import DroneLab from './drone-lab';
import './globals.css';
import './ui.css';

// Embedded Android WebViews can report a zero dynamic CSS viewport during rotation.
// Use the measured content viewport, as the native Canvas host does for its drawing area.
const syncViewport = () => {
  if (window.innerHeight > 0) document.documentElement.style.setProperty('--game-height', `${window.innerHeight}px`);
};
syncViewport();
window.addEventListener('resize', syncViewport);
window.visualViewport?.addEventListener('resize', syncViewport);
requestAnimationFrame(syncViewport);

createRoot(document.getElementById('game-root')!).render(<DroneLab />);
