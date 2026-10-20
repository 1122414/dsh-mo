import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const pkg = JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('built client registers one inert lazy factory with matching package id', () => {
  let entry;
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load(v){entry=v;}}}});
  assert.equal(entry.id,pkg.name);const plugin=entry.factory();
  assert.equal(typeof plugin.apply,'function');assert.deepEqual([...plugin.inject],['uiSession','connection']);
});
test('bundle/host entries exist and no install-time executable scripts are required', () => {
  assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml');assert.equal(pkg.exports['./client'],'./lib/client.js');
  assert.ok(readFileSync(new URL('../lib/index.js',import.meta.url),'utf8').includes('export function apply'));
  assert.equal(pkg.scripts.postinstall,undefined);assert.equal(pkg.dependencies,undefined);
});
