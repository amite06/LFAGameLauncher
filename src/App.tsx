import React, { useEffect, useRef, useState } from 'react';
import './App.css'

function launchExe(exePath: string) {
  // Use Electron's exposed API if available
  if ((window as any).electronAPI?.launchExe) {
    (window as any).electronAPI.launchExe(exePath);
  } else {
    alert(`Would launch: ${exePath}\n(Requires Electron or backend)`);
  }
}

const GameButton = React.forwardRef<HTMLButtonElement, { name: string; video: string; exe: string; selected?: boolean }>(
  ({ name, video, exe, selected = false }, ref) => {
    // Add a special class for Vision After Earth
    let headerClass =
      name === 'Visions After Earth'
        ? 'game-header vision-after-earth'
        : name === 'DALSHI'
          ? 'game-header dalshi'
          : 'game-header';
    if (selected) headerClass += ' selected';
    return (
      <button
        className={`game-button${selected ? ' selected' : ''}`}
        onClick={() => launchExe(exe)}
        ref={ref}
        tabIndex={selected ? 0 : -1}
        aria-pressed={selected}
      >
        <div className={headerClass}>{name}</div>
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
  const [games, setGames] = useState<Array<{ name: string; video: string; exe: string }>>([]);
  const [selected, setSelected] = useState(0); // 0: left, 1: right
  const btnRefs = [useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null)];

  // Load config from public/games-config.json
  useEffect(() => {
    fetch('/games-config.json')
      .then((res) => res.json())
      .then((data) => setGames(data.games || []));
  }, []);

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
