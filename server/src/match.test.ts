import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match, COUNTDOWN_MS, MATCH_SECONDS } from './match';

const T0 = 1_000_000;
const PLAY = T0 + COUNTDOWN_MS;

function match() {
  const m = new Match(T0);
  return m;
}

test('no claims during the countdown', () => {
  const m = match();
  m.report('a', 100, 100, false, T0 + 1000);
  assert.equal(m.claim('a', 100, 100, T0 + 1000), null);
});

test('first pickup needs to be near the egg', () => {
  const m = match();
  m.report('far', 500, 500, false, PLAY + 10);
  assert.equal(m.claim('far', 100, 100, PLAY + 10), null);
  m.report('near', 120, 110, false, PLAY + 20);
  const got = m.claim('near', 100, 100, PLAY + 20);
  assert.equal(got?.ownerUserId, 'near');
  assert.equal(got?.seq, 1);
});

test('two steals in the same instant: exactly one wins', () => {
  const m = match();
  m.report('h', 100, 100, false, PLAY);
  m.claim('h', 100, 100, PLAY);
  const t = PLAY + 5000;
  m.report('h', 300, 300, false, t);
  m.report('a', 320, 300, false, t);
  m.report('b', 300, 330, false, t);
  const first = m.claim('a', null, null, t);
  const second = m.claim('b', null, null, t);
  assert.equal(first?.ownerUserId, 'a');
  assert.equal(second, null);
  assert.equal(m.owner().ownerUserId, 'a');
});

test('a fresh holder is protected by the grace window', () => {
  const m = match();
  m.report('h', 100, 100, false, PLAY);
  m.claim('h', 100, 100, PLAY);
  m.report('a', 110, 100, false, PLAY + 500);
  m.report('h', 100, 100, false, PLAY + 500);
  assert.equal(m.claim('a', null, null, PLAY + 500), null);
  m.report('a', 110, 100, false, PLAY + 2500);
  m.report('h', 100, 100, false, PLAY + 2500);
  assert.equal(m.claim('a', null, null, PLAY + 2500)?.ownerUserId, 'a');
});

test('steals are rejected when too far, stale, or against a shield', () => {
  const m = match();
  m.report('h', 100, 100, false, PLAY);
  m.claim('h', 100, 100, PLAY);
  const t = PLAY + 5000;
  m.report('h', 100, 100, false, t);
  m.report('far', 400, 100, false, t);
  assert.equal(m.claim('far', null, null, t), null, 'too far');
  m.report('stale', 110, 100, false, t - 4000);
  assert.equal(m.claim('stale', null, null, t), null, 'stale position');
  m.report('h', 100, 100, true, t);
  m.report('near', 110, 100, false, t);
  assert.equal(m.claim('near', null, null, t), null, 'holder shielded');
});

test('finish names the holder at the buzzer and totals time held', () => {
  const m = match();
  m.report('a', 100, 100, false, PLAY);
  m.claim('a', 100, 100, PLAY);
  m.report('a', 100, 100, false, PLAY + 10_000);
  m.report('b', 110, 100, false, PLAY + 10_000);
  m.claim('b', null, null, PLAY + 10_000);
  const end = PLAY + MATCH_SECONDS * 1000;
  const r = m.finish(end + 500);
  assert.equal(r.winnerUserId, 'b');
  const a = r.stats.find((s) => s.userId === 'a');
  const b = r.stats.find((s) => s.userId === 'b');
  assert.deepEqual([a?.grabs, a?.heldMs], [1, 10_000]);
  assert.deepEqual([b?.grabs, b?.heldMs], [1, MATCH_SECONDS * 1000 - 10_000]);
  assert.equal(m.claim('a', null, null, end + 600), null, 'no claims after the end');
});

test('points: a second with the egg, 5 a steal (not the first pickup), 30 for the win', () => {
  const m = match();
  m.report('a', 100, 100, false, PLAY);
  m.claim('a', 100, 100, PLAY);
  m.report('a', 100, 100, false, PLAY + 10_000);
  m.report('b', 110, 100, false, PLAY + 10_000);
  m.claim('b', null, null, PLAY + 10_000);
  // Live: b's current run counts as it happens.
  assert.deepEqual(m.scores(PLAY + 12_500).find((s) => s.userId === 'b'), { userId: 'b', grabs: 1, steals: 1, heldMs: 2_500, points: 2 + 5 });
  const r = m.finish(PLAY + MATCH_SECONDS * 1000);
  const a = r.stats.find((s) => s.userId === 'a');
  const b = r.stats.find((s) => s.userId === 'b');
  assert.deepEqual([a?.steals, a?.points], [0, 10]);
  assert.deepEqual([b?.steals, b?.points], [1, (MATCH_SECONDS - 10) + 5 + 30]);
});

test('nobody touched the egg: no winner', () => {
  const m = match();
  assert.equal(m.finish(PLAY + MATCH_SECONDS * 1000).winnerUserId, null);
});
