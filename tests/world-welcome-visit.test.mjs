import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/scripts/mountain-world/welcome-visit.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function store() {
  const items = new Map();
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
}
function visit(localStorage, sessionStorage) {
  const exports = {};
  runInNewContext(script, { exports, localStorage, sessionStorage });
  return exports;
}
test('a shown welcome carries across new visits in one browser and is independent in a fresh browser profile', () => {
  const profile = store();
  const first = visit(profile, store());
  assert.equal(first.hasSeenWelcome(), false);
  first.rememberWelcome();
  assert.equal(visit(profile, store()).hasSeenWelcome(), true);
  assert.equal(visit(store(), store()).hasSeenWelcome(), false);
});
test('a browser that denies persistent storage still remembers within the session', () => {
  const denied = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  const session = store();
  const first = visit(denied, session);
  first.rememberWelcome();
  assert.equal(visit(denied, session).hasSeenWelcome(), true);
  const isolated = visit(denied, denied);
  assert.equal(isolated.hasSeenWelcome(), false);
  isolated.rememberWelcome();
  assert.equal(isolated.hasSeenWelcome(), true);
});
