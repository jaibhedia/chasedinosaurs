import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, uniqueName, NAME_MAX } from './names';

test('names keep letters in any script, digits, spaces and . _ -', () => {
  assert.equal(cleanName('  Shantanu  '), 'Shantanu');
  assert.equal(cleanName('Rex   the  2nd'), 'Rex the 2nd');
  assert.equal(cleanName('शांतनु'), 'शांतनु');
  assert.equal(cleanName('d.r_x-9'), 'd.r_x-9');
  assert.equal(cleanName('<b>Rex</b>!'), 'bRexb');
  assert.equal(cleanName('Ｒｅｘ'), 'Rex', 'full-width letters fold to plain ones');
});

test('names are 2 to 16 long, and anything else is no name', () => {
  assert.equal(cleanName('A'), '');
  assert.equal(cleanName('🦖🦖'), '');
  assert.equal(cleanName(42), '');
  assert.equal(cleanName(undefined), '');
  assert.equal(cleanName('x'.repeat(40)).length, NAME_MAX);
  assert.equal(cleanName('Fifteen chars a bcd'), 'Fifteen chars a', 'no trailing space after the cut');
});

test('a name another player in the room has gets a number', () => {
  assert.equal(uniqueName('Rex', ['Mia']), 'Rex');
  assert.equal(uniqueName('Rex', ['rex']), 'Rex 2');
  assert.equal(uniqueName('Rex', ['Rex', 'Rex 2']), 'Rex 3');
  const long = 'Sixteen letters!'.replace('!', 's');
  const next = uniqueName(long, [long]);
  assert.equal(next.length <= NAME_MAX, true);
  assert.equal(next.endsWith(' 2'), true);
});
