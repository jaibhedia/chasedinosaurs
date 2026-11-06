/**
 * World ID calls to the game server. The server holds the signing key and checks every
 * proof with World, so the browser needs no settings of its own (see server/src/world.ts).
 */
import { resolveSocketUrl } from '@/config';

export interface WorldConfig {
  app_id: `app_${string}`;
  rp_id: string;
  action: string;
  environment: 'production' | 'staging';
}

export interface RpContext { rp_id: string; nonce: string; created_at: number; expires_at: number; signature: string }

/** The widget's settings, or null when World ID is off on the server. */
export async function fetchWorldConfig(): Promise<WorldConfig | null> {
  const r = await fetch(`${resolveSocketUrl()}/world/config`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as WorldConfig | null;
}

/** A freshly signed request context. Each one expires, so fetch it per attempt. */
export async function fetchRpContext(): Promise<RpContext> {
  const r = await fetch(`${resolveSocketUrl()}/world/rp-context`, { method: 'POST' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as RpContext;
}

/** Hand World's proof to the server, which verifies it and marks this player as human. */
export async function submitProof(userId: string, result: unknown): Promise<'ok' | 'already-linked' | 'failed'> {
  try {
    const r = await fetch(`${resolveSocketUrl()}/world/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, result }),
    });
    if (r.ok) return 'ok';
    return r.status === 409 ? 'already-linked' : 'failed';
  } catch {
    return 'failed';
  }
}
