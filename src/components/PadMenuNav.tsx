import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGamepadConnected } from '@/hooks/useGamepadConnected';
import { startPadNav } from '@/lib/padNav';

/** Lets a controller move through every menu while one is connected (src/lib/padNav.ts). */
export default function PadMenuNav() {
  const connected = useGamepadConnected();
  const { pathname } = useLocation();
  const route = useRef(pathname);
  route.current = pathname;

  useEffect(() => {
    if (!connected) return;
    return startPadNav(() => route.current === '/game');
  }, [connected]);

  return null;
}
