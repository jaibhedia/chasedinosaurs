import { useEffect, useState } from 'react';

const anyPad = () => Array.from(navigator.getGamepads?.() ?? []).some(Boolean);

/** True while a game controller is connected. Browsers only report one after its first button press. */
export function useGamepadConnected(): boolean {
  const [connected, setConnected] = useState(anyPad);
  useEffect(() => {
    const update = () => setConnected(anyPad());
    window.addEventListener('gamepadconnected', update);
    window.addEventListener('gamepaddisconnected', update);
    return () => {
      window.removeEventListener('gamepadconnected', update);
      window.removeEventListener('gamepaddisconnected', update);
    };
  }, []);
  return connected;
}
