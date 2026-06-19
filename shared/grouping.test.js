import { test } from 'node:test';
import assert from 'node:assert';
import { groupConsecutive } from './grouping.js';

const actorOf = e => e.actor;
const kindOf = e => e.kind;

test('collapses a run of same actor + kind', () => {
  const list = [
    { id: 1, actor: 'a', kind: 'usage' },
    { id: 2, actor: 'a', kind: 'usage' },
    { id: 3, actor: 'a', kind: 'usage' },
  ];
  const groups = groupConsecutive(list, actorOf, kindOf);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].entries.length, 3);
  assert.equal(groups[0].key, 1);
});

test('breaks a run on actor change', () => {
  const list = [
    { id: 1, actor: 'a', kind: 'usage' },
    { id: 2, actor: 'b', kind: 'usage' },
    { id: 3, actor: 'a', kind: 'usage' },
  ];
  const groups = groupConsecutive(list, actorOf, kindOf);
  assert.deepEqual(groups.map(g => g.entries.length), [1, 1, 1]);
});

test('breaks a run on kind change', () => {
  const list = [
    { id: 1, actor: 'a', kind: 'usage' },
    { id: 2, actor: 'a', kind: 'add' },
    { id: 3, actor: 'a', kind: 'add' },
  ];
  const groups = groupConsecutive(list, actorOf, kindOf);
  assert.deepEqual(groups.map(g => g.entries.length), [1, 2]);
  assert.deepEqual(groups.map(g => g.kind), ['usage', 'add']);
});

test('a falsy kind never groups, even back-to-back same actor', () => {
  const list = [
    { id: 1, actor: 'a', kind: null },
    { id: 2, actor: 'a', kind: null },
  ];
  const groups = groupConsecutive(list, actorOf, kindOf);
  assert.equal(groups.length, 2);
});

test('bucketOf breaks a run across buckets (e.g. different days)', () => {
  const list = [
    { id: 1, actor: 'a', kind: 'like', day: '2026-06-19' },
    { id: 2, actor: 'a', kind: 'like', day: '2026-06-19' },
    { id: 3, actor: 'a', kind: 'like', day: '2026-06-18' },
  ];
  const groups = groupConsecutive(list, actorOf, kindOf, e => e.day);
  assert.deepEqual(groups.map(g => g.entries.length), [2, 1]);
});

test('prefers entry.key for the group key, falls back to id', () => {
  const groups = groupConsecutive(
    [{ key: 'use-9', actor: 'a', kind: 'usage' }],
    actorOf,
    kindOf,
  );
  assert.equal(groups[0].key, 'use-9');
});

test('empty list yields no groups', () => {
  assert.deepEqual(groupConsecutive([], actorOf, kindOf), []);
});
