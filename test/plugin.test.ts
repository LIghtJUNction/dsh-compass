import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, symlink } from 'node:fs/promises';
import { fixture, object, modelCall } from './util.js';
test('fresh repository maps, package metadata, entry points and literal tours', async () => {
  const f = await fixture();
  try {
    await mkdir(`${f.root}/src`);
    await writeFile(`${f.root}/src/index.ts`, 'export function start() {}\nexport class Example {}\n');
    await writeFile(`${f.root}/package.json`, JSON.stringify({ name: 'fixture', scripts: { test: 'node --test' }, dependencies: { example: '1' } }));
    const first = object(await f.host.execute('codebase_map', {}));
    assert.deepEqual(first.entryPoints, ['src/index.ts']);
    assert.match(JSON.stringify(first.packages), /fixture/);
    const tour = object(await f.host.execute('code_tour', { topic: 'src', expectedRevision: first.revision }));
    assert.match(JSON.stringify(tour.steps), /index.ts:1: export function start/);
    await writeFile(`${f.root}/src/new.ts`, 'export const added = true;');
    assert.ok((await f.host.execute('codebase_map', { expectedRevision: first.revision })).isError);
    assert.ok((await f.host.execute('code_tour', { topic: '', expectedRevision: first.revision })).isError);
    const results = await Promise.all(Array.from({ length: 4 }, () => f.host.execute('codebase_map', {})));
    for (const result of results) assert.notEqual(object(result).revision, first.revision);
  } finally { await f.close(); }
});
test('skips hidden/generated/symlink paths; does not execute package scripts', async () => {
  const f = await fixture();
  try {
    await mkdir(`${f.root}/node_modules`);
    await writeFile(`${f.root}/.env`, 'SECRET=hidden');
    await writeFile(`${f.root}/visible.ts`, 'export function yes() {}');
    await symlink('/etc', `${f.root}/outside`);
    await symlink('visible.ts', `${f.root}/linked.ts`);
    assert.deepEqual(object(await f.host.execute('codebase_map', {})).files, ['visible.ts']);
  } finally { await f.close(); }
});
test('offline model sees map results; abort and dispose unregister tools', async () => {
  const f = await fixture();
  try {
    await writeFile(`${f.root}/main.py`, 'def hello():\n  pass\n');
    await modelCall(f.host, 'codebase_map', {});
    assert.match(JSON.stringify(f.host.model.requests[1]), /main.py/);
    const controller = new AbortController(); controller.abort();
    assert.ok((await f.host.execute('codebase_map', {}, controller.signal)).isError);
    await f.fiber.dispose();
    assert.equal(f.host.ctx.tools.get('codebase_map'), undefined);
    assert.equal(f.host.ctx.tools.get('code_tour'), undefined);
  } finally { await f.close(); }
});
