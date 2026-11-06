import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { leaderboard, recordMatch } from './leaderboard';

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
