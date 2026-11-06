import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// world.ts reads its settings on import.
process.env.WORLD_APP_ID = 'app_test';
process.env.WORLD_RP_ID = 'rp_test';
process.env.WORLD_RP_SIGNING_KEY = randomBytes(32).toString('hex');
const { rpContext, verifyProof, worldConfig, worldEnabled, WorldError } = await import('./world');

const proof = (over: Record<string, unknown> = {}, item: Record<string, unknown> = {}) => ({
  protocol_version: '4.0',
  nonce: 'n',
  action: 'chase-leaderboard',
  environment: 'production',
  responses: [{ identifier: 'selfie', signal_hash: '0x0', proof: ['0x1'], nullifier: '0x00ff', sybil_score: 10, ...item }],
  ...over,
});

/** Swap fetch for one test, counting calls. */
function mockFetch(status: number, body: unknown) {
  const real = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = real; } };
}

test('World ID is on with all three settings, and signs requests for the action', () => {
  assert.equal(worldEnabled, true);
  assert.deepEqual(worldConfig(), { app_id: 'app_test', rp_id: 'rp_test', action: 'chase-leaderboard', environment: 'production' });
  const ctx = rpContext();
  assert.equal(ctx.rp_id, 'rp_test');
  assert.ok(ctx.nonce && ctx.signature, 'nonce and signature are set');
  assert.ok(ctx.expires_at > ctx.created_at);
});

test('a proof World accepts returns its nullifier as a decimal', async () => {
  const f = mockFetch(200, { success: true, environment: 'production' });
  try {
    const out = await verifyProof(proof());
    assert.deepEqual(out, { nullifier: '255', credential: 'selfie', sybilScore: 10 });
    assert.deepEqual(f.calls, ['https://developer.world.org/api/v4/verify/rp_test']);
  } finally { f.restore(); }
});

test('proofs for another action, environment or credential never reach World', async () => {
  const f = mockFetch(200, { success: true, environment: 'production' });
  try {
    for (const bad of [proof({ action: 'other' }), proof({ environment: 'staging' }), proof({}, { identifier: 'passport' }), proof({}, { nullifier: undefined }), null]) {
      await assert.rejects(verifyProof(bad), (e) => e instanceof WorldError && e.code === 'invalid');
    }
    assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});

test('a proof World rejects, or one verified for another environment, is refused', async () => {
  for (const [status, body] of [[400, { code: 'invalid_proof' }], [200, { success: true, environment: 'staging' }]] as const) {
    const f = mockFetch(status, body);
    try {
      await assert.rejects(verifyProof(proof()), (e) => e instanceof WorldError && e.code === 'rejected');
    } finally { f.restore(); }
  }
});
