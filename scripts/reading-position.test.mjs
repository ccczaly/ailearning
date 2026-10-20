import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberReadingSection, restoreReadingSection } from '../src/reading-position.ts';

function replaceStorage(t, descriptor) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { ...descriptor, configurable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
}
function storage(t) {
  const records = new Map();
  replaceStorage(t, { value: {
    getItem(key) { return records.get(key) ?? null; },
    setItem(key, value) { records.set(key, value); },
  } });
  return records;
}

test('refresh and course reentry restore the same lesson while a valid URL wins', t => {
  storage(t);
  const lessons = [{ id: 11 }, { id: 12 }, { id: 13 }];
  rememberReadingSection(7, 'llm-basics', 13);
  assert.equal(restoreReadingSection(7, 'llm-basics', lessons, undefined), 13);
  assert.equal(restoreReadingSection(7, 'llm-basics', lessons, '12'), 12);
});

test('reading locations are isolated by user and course', t => {
  storage(t);
  rememberReadingSection(7, 'llm-basics', 13);
  rememberReadingSection(8, 'llm-basics', 12);
  rememberReadingSection(7, 'rag', 12);
  const lessons = [{ id: 11 }, { id: 12 }, { id: 13 }];
  assert.equal(restoreReadingSection(7, 'llm-basics', lessons), 13);
  assert.equal(restoreReadingSection(8, 'llm-basics', lessons), 12);
  assert.equal(restoreReadingSection(7, 'rag', lessons), 12);
  assert.equal(restoreReadingSection(9, 'llm-basics', lessons), 11);
});

test('hidden or removed sections and malformed query values never override visible lessons', t => {
  storage(t);
  rememberReadingSection(7, 'llm-basics', 99);
  const lessons = [{ id: 11 }, { id: 12 }];
  for (const query of ['99', '-12', '1e1', ['12'], '9007199254740993'])
    assert.equal(restoreReadingSection(7, 'llm-basics', lessons, query), 11);
  assert.equal(restoreReadingSection(7, 'llm-basics', [], '12'), undefined);
});

test('blocked browser storage does not break reading or explicit lesson links', t => {
  replaceStorage(t, { get() { throw new Error('blocked'); } });
  assert.doesNotThrow(() => rememberReadingSection(7, 'llm-basics', 12));
  assert.equal(restoreReadingSection(7, 'llm-basics', [{ id: 11 }, { id: 12 }]), 11);
  assert.equal(restoreReadingSection(7, 'llm-basics', [{ id: 11 }, { id: 12 }], '12'), 12);
});
