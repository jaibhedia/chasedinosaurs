import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flushLeaderboard, leaderboard, loadLeaderboard, recordMatch } from './leaderboard';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'chase-lb-'));

const stat = (userId: string, heldMs: number, steals: number, points: number) => ({ userId, grabs: 1, steals, heldMs, points });
const ana = { userId: 'lb-ana', name: 'Ana' };
const ben = { userId: 'lb-ben', name: 'Ben' };

test('all-time boards keep the best single match, not the sum', () => {
  recordMatch({ winnerUserId: 'lb-ana', stats: [stat('lb-ana', 50_000, 1, 85), stat('lb-ben', 20_000, 4, 40)] }, [ana, ben]);
  recordMatch({ winnerUserId: 'lb-ben', stats: [stat('lb-ana', 10_000, 2, 20), stat('lb-ben', 30_000, 0, 60)] }, [ana, ben]);

  const hold = leaderboard('hold', 'lb-ben');
  assert.deepEqual(hold.entries.map((e) => [e.name, e.value]), [['Ana', 50_000], ['Ben', 30_000]]);
  assert.deepEqual([hold.me?.rank, hold.me?.you], [2, true]);
  assert.equal(hold.entries[0].you, false);

  assert.deepEqual(leaderboard('steals').entries.map((e) => [e.name, e.value]), [['Ben', 4], ['Ana', 2]]);
  // Wins are a count. Tied on 1 each, so best match points decide: Ana 85, Ben 60.
  assert.deepEqual(leaderboard('wins').entries.map((e) => [e.name, e.value]), [['Ana', 1], ['Ben', 1]]);
});

test('bots and other non-players never get an entry', () => {
  recordMatch({ winnerUserId: 'agent_0', stats: [stat('agent_0', 90_000, 9, 200)] }, [{ userId: 'lb-cat', name: 'Cat' }]);
  const names = leaderboard('hold').entries.map((e) => e.name);
  assert.ok(!names.includes('agent_0'));
  assert.equal(leaderboard('wins', 'lb-cat').me, null, 'Cat played but won nothing');
});

test('Upstash: a failed read never overwrites the board, and a retry merges both sides', async () => {
  // A stand-in for Upstash's REST API: one Redis command per POST, as a JSON array.
  const stored = new Map([['chase:leaderboard', JSON.stringify([
    { userId: 'lb-old', name: 'Old', bestHoldMs: 70_000, bestSteals: 1, bestPoints: 90, wins: 3, matches: 5, updatedAt: 1 },
    { userId: 'lb-ana', name: 'Ana', bestHoldMs: 5_000, bestSteals: 6, bestPoints: 30, wins: 2, matches: 4, updatedAt: 1 },
  ])]]);
  let reachable = false;
  const sets: string[] = [];
  const auth = new Set<string>();
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      auth.add(req.headers.authorization ?? '');
      if (!reachable) { res.writeHead(500).end(JSON.stringify({ error: 'down' })); return; }
      const [cmd, key, value] = JSON.parse(body) as string[];
      if (cmd === 'SET') { stored.set(key, value); sets.push(value); }
      res.writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ result: cmd === 'GET' ? stored.get(key) ?? null : 'OK' }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  try {
    const loading = loadLeaderboard();
    await new Promise((r) => setTimeout(r, 100)); // the first read fails
    await flushLeaderboard();
    assert.equal(sets.length, 0, 'nothing is written before the stored board has been read');

    reachable = true;
    await loading; // the retry, a second later

    // Ana's best hold is still the 50s from this process; her stored wins and matches add up.
    const hold = leaderboard('hold').entries.map((e) => [e.name, e.value]);
    assert.deepEqual(hold.slice(0, 2), [['Old', 70_000], ['Ana', 50_000]]);
    assert.equal(leaderboard('steals').entries[0].name, 'Ana', 'the stored 6 steals beat this run');
    assert.deepEqual(leaderboard('wins').entries.slice(0, 2).map((e) => [e.name, e.value]), [['Old', 3], ['Ana', 3]]);

    await flushLeaderboard();
    assert.equal(sets.length, 1);
    const saved = JSON.parse(sets[0]) as Array<{ userId: string; wins: number; matches: number }>;
    assert.deepEqual(saved.map((e) => e.userId).sort(), ['lb-ana', 'lb-ben', 'lb-cat', 'lb-old']);
    const ana = saved.find((e) => e.userId === 'lb-ana');
    assert.deepEqual([ana?.wins, ana?.matches], [3, 6]);
    assert.deepEqual([...auth], ['Bearer test-token']);
  } finally {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    server.close();
  }
});
