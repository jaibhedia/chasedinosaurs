/**
 * World ID: one human, one row on the all-time leaderboard.
 *
 * The trust moment is getting onto the board. Without it a second browser profile is a
 * second player, so one person can fill the board, or farm wins in a private room against
 * their own tabs. With World ID on, only verified humans rank, and each World ID backs one
 * player profile: the proof's nullifier is the same every time one person proves this
 * action, so a second profile from the same person is turned away. Playing never needs it.
 *
 * Credential: Selfie Check, the proportionate one for a free board. It needs only World
 * App and the phone's camera (no Orb visit), and it's unique per person per action. Proof
 * of Human (the Orb) is accepted too, and is the step up if cash is ever attached.
 *
 * Off unless WORLD_APP_ID, WORLD_RP_ID and WORLD_RP_SIGNING_KEY are set; the board then
 * shows everyone, as before.
 */
import { signRequest } from '@worldcoin/idkit-core/signing';

const APP_ID = process.env.WORLD_APP_ID || '';
const RP_ID = process.env.WORLD_RP_ID || '';
const SIGNING_KEY = process.env.WORLD_RP_SIGNING_KEY || '';
const ACTION = process.env.WORLD_ACTION || 'chase-leaderboard';
/** "production" for real World App users; "staging" only with World's simulator. */
const ENVIRONMENT: 'production' | 'staging' = process.env.WORLD_ENVIRONMENT === 'staging' ? 'staging' : 'production';
/** Credentials that put a player on the board. */
const ACCEPTED = new Set(['selfie', 'proof_of_human']);

export const worldEnabled = Boolean(APP_ID && RP_ID && SIGNING_KEY);

if (APP_ID && !worldEnabled) {
  console.warn('[world] WORLD_APP_ID is set but WORLD_RP_ID or WORLD_RP_SIGNING_KEY is missing, so World ID stays off.');
} else if (worldEnabled) {
  console.log(`[world] World ID on: action "${ACTION}", ${ENVIRONMENT}`);
}

/** What the browser needs to open the widget. None of it is secret. */
export function worldConfig(): { app_id: string; rp_id: string; action: string; environment: string } | null {
  return worldEnabled ? { app_id: APP_ID, rp_id: RP_ID, action: ACTION, environment: ENVIRONMENT } : null;
}

/** A freshly signed request context, so World App knows the request comes from this game. */
export function rpContext(): { rp_id: string; nonce: string; created_at: number; expires_at: number; signature: string } {
  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex: SIGNING_KEY, action: ACTION });
  return { rp_id: RP_ID, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig };
}

export class WorldError extends Error {
  constructor(readonly code: 'invalid' | 'rejected' | 'unreachable', message: string) {
    super(message);
  }
}

interface ProofItem { identifier?: string; nullifier?: string; sybil_score?: number }

/**
 * Check an IDKit result with World's Developer Portal. Returns the nullifier as a decimal
 * string: World advises comparing nullifiers as numbers, since hex casing can differ.
 */
export async function verifyProof(result: unknown): Promise<{ nullifier: string; credential: string; sybilScore?: number }> {
  const r = result as { action?: string; environment?: string; responses?: ProofItem[] } | null;
  const item = r?.responses?.[0];
  // Our action, our environment and an accepted credential, before asking World.
  if (!r || r.action !== ACTION || r.environment !== ENVIRONMENT || !item?.nullifier || !ACCEPTED.has(item.identifier ?? '')) {
    throw new WorldError('invalid', 'not a proof for this action, environment and credential');
  }
  let nullifier: string;
  try {
    nullifier = BigInt(item.nullifier).toString();
  } catch {
    throw new WorldError('invalid', 'malformed nullifier');
  }

  let res: Response;
  try {
    // The IDKit result goes to World as-is; their guide says no remapping.
    res = await fetch(`https://developer.world.org/api/v4/verify/${encodeURIComponent(RP_ID)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new WorldError('unreachable', (err as Error).message);
  }
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; environment?: string; code?: string; detail?: string };
  if (!res.ok || body.success !== true || body.environment !== ENVIRONMENT) {
    throw new WorldError('rejected', body.code || body.detail || `HTTP ${res.status}`);
  }
  return { nullifier, credential: item.identifier as string, sybilScore: item.sybil_score };
}
