/**
 * Admin sign-in for the spectator view. Identity is an allowlisted email for now (a wallet
 * address once the Web3 layer is back) plus the server's passcode. Held in memory only,
 * never in storage, and replayed after a reconnect so a spectator survives a network blip.
 */
import type { Socket } from 'socket.io-client';

type Ack = { ok: boolean; error?: string };

let creds: { email: string; passcode: string } | null = null;

export function adminLogin(socket: Socket, email: string, passcode: string): Promise<Ack> {
  return new Promise((resolve) => {
    socket.timeout(5000).emit('admin-login', { email, passcode }, (err: unknown, res?: Ack) => {
      if (err || !res) { resolve({ ok: false, error: "The server didn't answer. Try again." }); return; }
      if (res.ok) creds = { email, passcode };
      resolve(res);
    });
  });
}

export const isAdminSignedIn = () => creds !== null;

export function adminSignOut(): void {
  creds = null;
}

/** A reconnect gives a fresh socket the server knows nothing about: sign in again and re-join the room. */
export async function resumeSpectating(socket: Socket, roomCode: string): Promise<void> {
  if (!creds) return;
  const res = await adminLogin(socket, creds.email, creds.passcode);
  if (res.ok) socket.emit('spectate', { roomCode }, () => { /* the scene re-syncs itself */ });
}
