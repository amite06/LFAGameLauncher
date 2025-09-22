import React, { useEffect, useRef, useState } from 'react';
import './App.css'

const LAUNCH_DEBOUNCE_MS = 10_000; // 10 seconds
const launchLocks: Map<string, number> = new Map();

function showToast(message: string, duration = 4000) {
  const containerId = 'toast-container';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  // trigger show animation
  // force reflow
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  toast.offsetWidth;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function launchExe(exePath: string) {
  const now = Date.now();
  const last = launchLocks.get(exePath) || 0;
  if (now - last < LAUNCH_DEBOUNCE_MS) {
    const remaining = Math.ceil((LAUNCH_DEBOUNCE_MS - (now - last)) / 1000);
    showToast(`${exePath} is already launching — please wait ${remaining}s`, 3000);
    return;
  }

  // lock this exe for the debounce duration
  launchLocks.set(exePath, now);
  setTimeout(() => launchLocks.delete(exePath), LAUNCH_DEBOUNCE_MS);

  // Use Electron's exposed API if available
  if ((window as any).electronAPI?.launchExe) {
    (window as any).electronAPI.launchExe(exePath);
  } else {
    showToast(`Would launch: ${exePath} — (Requires Electron or backend)`, 4000);
  }
}

const GameButton = React.forwardRef<HTMLButtonElement, { name: string; video: string; exe: string; font?: string; selected?: boolean }>(
  ({ name, video, exe, font, selected = false }, ref) => {
    let headerClass = 'game-header';
    if (selected) headerClass += ' selected';
    // Inline style for font-family from config
    const headerStyle = font ? { fontFamily: `'${font}', Arial, Helvetica, sans-serif` } : undefined;
    return (
      <button
        className={`game-button${selected ? ' selected' : ''}`}
        onClick={() => launchExe(exe)}
        ref={ref}
        tabIndex={selected ? 0 : -1}
        aria-pressed={selected}
      >
        <div className={headerClass} style={headerStyle}>{name}</div>
        <video
          className="game-video"
          src={video}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      </button>
    );
  }
);

function App() {
  const [games, setGames] = useState<Array<{ name: string; video: string; exe: string; font?: string; fontPath?: string }>>([]);
  const [selected, setSelected] = useState(0); // 0: left, 1: right
  const btnRefs = [useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null)];

  // Load config from public/games-config.json
  useEffect(() => {
    fetch('/games-config.json')
      .then((res) => res.json())
      .then((data) => setGames(data.games || []));
  }, []);

  // Inject @font-face rules for each game's font
  useEffect(() => {
    const styleId = 'dynamic-font-faces';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    const fontFaces = games
      .filter(g => g.font && g.fontPath)
      .map(g => `@font-face { font-family: '${g.font}'; src: url('${g.fontPath}') format('opentype'); font-style: normal; font-weight: normal; }`)
      .join('\n');
    styleTag.textContent = fontFaces;
    return () => {
      if (styleTag) styleTag.textContent = '';
    };
  }, [games]);

  // Gamepad support: only allow left if not already on first, right if not already on last
  useEffect(() => {
    let animation: number;
    let lastLeft = false;
    let lastRight = false;
    let lastA = false;
    function pollGamepad() {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0];
      if (gp) {
        const left = gp.buttons[14]?.pressed || gp.axes[0] < -0.5;
        const right = gp.buttons[15]?.pressed || gp.axes[0] > 0.5;
        const a = gp.buttons[0]?.pressed; // A/Cross
        if (left && !lastLeft && selected > 0) {
          setSelected((prev) => prev - 1);
        }
        if (right && !lastRight && selected < games.length - 1) {
          setSelected((prev) => prev + 1);
        }
        if (a && !lastA) {
          btnRefs[selected].current?.click();
        }
        lastLeft = left;
        lastRight = right;
        lastA = a;
      }
      animation = requestAnimationFrame(pollGamepad);
    }
    animation = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animation);
  }, [selected, games]);

  // Keyboard fallback (arrow keys + enter)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setSelected((prev) => (prev > 0 ? prev - 1 : games.length - 1));
      if (e.key === 'ArrowRight') setSelected((prev) => (prev < games.length - 1 ? prev + 1 : 0));
      if (e.key === 'Enter') btnRefs[selected].current?.click();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, games]);

  // Update btnRefs to match games length
  useEffect(() => {
    // @ts-ignore
    btnRefs.length = games.length;
    for (let i = 0; i < games.length; i++) {
      if (!btnRefs[i]) btnRefs[i] = React.createRef();
    }
  }, [games]);

  if (games.length === 0) return <div className="launcher-container">Loading...</div>;

  return (
    <div className="launcher-container">
      {games.map((game, i) => (
        <GameButton
          key={game.name}
          {...game}
          ref={btnRefs[i]}
          selected={selected === i}
        />
      ))}
    </div>
  );
}

export default App
