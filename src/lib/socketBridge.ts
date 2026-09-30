import type { Socket } from 'socket.io-client';

// Bridges the React-owned socket to the Phaser scene (which lives outside React),
// so the scene can wire multiplayer netcode without any mount/connect race.
let current: Socket | null = null;

export const setGameSocket = (s: Socket | null) => {
  current = s;
};

export const getGameSocket = (): Socket | null => current;

/**
 * Server clock minus this device's clock, in ms. The match clock is the server's, and a
 * phone whose clock is a few seconds off would otherwise show a different countdown and
 * end the round at a different moment from everyone else.
 */
let serverOffset = 0;
let bestRtt = Infinity;

export const getServerOffset = () => serverOffset;

/** Keep the sample with the lowest round trip: its midpoint estimate is the tightest. */
export function recordTimeSample(sentAt: number, serverNow: number, receivedAt: number) {
  const rtt = receivedAt - sentAt;
  if (rtt < 0 || rtt > bestRtt) return;
  bestRtt = rtt;
  serverOffset = serverNow + rtt / 2 - receivedAt;
}

/** A new connection may be to a different server instance; start measuring again. */
export function resetTimeSync() {
  bestRtt = Infinity;
}
