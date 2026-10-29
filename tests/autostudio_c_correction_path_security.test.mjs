import { test } from 'node:test';
import assert from 'node:assert/strict';
const { setByPath } = await import(new URL('../src/services/_internal/utils.ts', import.meta.url));
const marker = '__hirely_autostudio_c_test_only__';
const cleanup = () => { delete Object.prototype[marker]; delete Function.prototype[marker]; };

test('valid: nested CV contact edit', () => {
  const cv = { contact: { full_name: 'Before' } };
  setByPath(cv, 'contact.full_name', 'After');
  assert.equal(cv.contact.full_name, 'After');
});
test('valid: array-index CV experience edit', () => {
  const cv = { experiences: [{ company: 'Before' }] };
  setByPath(cv, 'experiences[0].company', 'After');
  assert.equal(cv.experiences[0].company, 'After');
});
test('valid: create missing nested field', () => {
  const cv = {};
  setByPath(cv, 'contact.full_name', 'After');
  assert.equal(cv.contact.full_name, 'After');
});
for (const path of [`__proto__.${marker}`, `constructor.prototype.${marker}`, `contact.__proto__.${marker}`, `toString.${marker}`]) {
  test(`reject prototype mutation: ${path}`, () => {
    cleanup();
    try {
      const cv = { contact: {} };
      assert.throws(() => setByPath(cv, path, 'INJECTED'));
      assert.equal(Object.prototype[marker], undefined);
      assert.equal(Function.prototype[marker], undefined);
    } finally { cleanup(); }
  });
}
test('reject direct __proto__ replacement', () => {
  const cv = {};
  assert.throws(() => setByPath(cv, '__proto__', { compromised: true }));
  assert.equal(Object.getPrototypeOf(cv), Object.prototype);
});
test('reject empty path (no undefined key)', () => {
  const cv = {};
  assert.throws(() => setByPath(cv, '', 1));
  assert.equal(Object.hasOwn(cv, 'undefined'), false);
});
test('reject malformed path with empty segment', () => {
  const cv = {};
  assert.throws(() => setByPath(cv, 'contact..full_name', 'x'));
  assert.deepEqual(cv, {});
});
test('reject huge array index', () => {
  const cv = { experiences: [] };
  assert.throws(() => setByPath(cv, 'experiences[4294967294].company', 'x'));
  assert.equal(cv.experiences.length, 0);
});
test('reject inherited path without mutation', () => {
  const cv = {};
  assert.throws(() => setByPath(cv, `hasOwnProperty.${marker}`, 'x'));
  assert.equal(Object.prototype[marker], undefined);
});
test('reject traversal into scalar', () => {
  const cv = { contact: { full_name: 'Before' } };
  assert.throws(() => setByPath(cv, 'contact.full_name.first', 'x'));
  assert.equal(cv.contact.full_name, 'Before');
});
test('structuredClone CV follows inherited Object.prototype path', () => {
  cleanup();
  try {
    const cv = structuredClone({ contact: { full_name: 'Synthetic' } });
    assert.throws(() => setByPath(cv, `contact.__proto__.${marker}`, 'INJECTED'));
    assert.equal(Object.prototype[marker], undefined);
  } finally { cleanup(); }
});
test('reject excessive path depth before mutation', () => {
  const cv = {};
  assert.throws(() => setByPath(cv, Array(40).fill('x').join('.'), 'x'));
  assert.deepEqual(cv, {});
});
test('reject oversized correction path', () => {
  const cv = {};
  assert.throws(() => setByPath(cv, 'x'.repeat(300), 'x'));
  assert.deepEqual(cv, {});
});
