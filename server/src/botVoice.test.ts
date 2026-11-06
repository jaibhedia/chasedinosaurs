import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

// A stand-in for the 0G Compute Router's /v1/chat/completions, receipt included.
const TRACE = { request_id: '0852f405-6c56-40c2-a800-e6fd70785065', provider: '0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C' };
const router = createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      id: 'chatcmpl-1', object: 'chat.completion', created: 0, model: 'glm-5.2',
      choices: [{ index: 0, message: { role: 'assistant', content: '"Thirty seconds of glory, zero at the buzzer"' }, finish_reason: 'stop' }],
      x_0g_trace: TRACE,
    }));
  });
});
await new Promise<void>((r) => router.listen(0, '127.0.0.1', r));
after(() => router.close());

// provider.ts reads these on import.
process.env.AI_BASE_URL = `http://127.0.0.1:${(router.address() as AddressInfo).port}/v1`;
process.env.AI_API_KEY = 'sk-test';
process.env.AI_MODEL = 'glm-5.2';
const { matchRoast } = await import('./botVoice');
const { receiptOf, recentReceipts } = await import('./ai/receipts');

test('a roast served by the 0G Router comes back with its receipt', async () => {
  const out = await matchRoast([{ name: 'You', you: true, grabs: 2, heldS: 30 }], 'Tard');
  assert.equal(out?.line, 'Thirty seconds of glory, zero at the buzzer');
  assert.deepEqual([out?.receipt?.requestId, out?.receipt?.provider, out?.receipt?.kind], [TRACE.request_id, TRACE.provider, 'roast']);
  assert.equal(recentReceipts(1)[0].requestId, TRACE.request_id, 'kept for /ai/receipts');
});

test('responses from other providers carry no receipt', () => {
  assert.equal(receiptOf({ id: 'chatcmpl-2', choices: [] }, 'line'), null);
  assert.equal(receiptOf({ x_0g_trace: { request_id: '' } }, 'line'), null);
  assert.equal(receiptOf(null, 'line'), null);
});
