// 备份导入 / 媒体删除的安全边界：导入时拒绝危险字段，删除时再做一次路径兜底。
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { once } = require('events');
const { PassThrough } = require('stream');
const archiver = require('archiver');
const { buildVault, loadVault } = require('../src/user-data');
const { transferRouter, validateBackupJson } = require('../src/routes/transfer');
const { memoriesRouter, safeVaultPath } = require('../src/routes/content');

async function zipBuffer(files) {
  const archive = archiver('zip');
  const sink = new PassThrough();
  const chunks = [];
  sink.on('data', (chunk) => chunks.push(chunk));
  const done = once(sink, 'end');
  archive.pipe(sink);
  for (const [name, value] of Object.entries(files)) archive.append(value, { name });
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
}

async function withVault(routerFactory, run) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'moonbox-import-sec-'));
  const vault = buildVault(path.join(root, 'vault'));
  await loadVault(vault);
  const app = express();
  app.use((req, res, next) => { req.vault = vault; next(); });
  app.use('/', routerFactory(vault));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    return await run(`http://127.0.0.1:${server.address().port}`, vault, root);
  } finally {
    server.close();
    await once(server, 'close');
    await fsp.rm(root, { recursive: true, force: true });
  }
}

const importZip = (origin, buf) => {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/zip' }), 'backup.zip');
  return fetch(origin + '/import', { method: 'POST', body: fd });
};

test('导入校验接受正常的照片记录', () => {
  assert.doesNotThrow(() => validateBackupJson('memories.json', [
    { id: 'abc', type: 'photo', filename: 'abc.png' },
    { id: 'd5f8a2b0-1111-4111-8111-111111111111', type: 'video', filename: 'd5f8a2b0-1111-4111-8111-111111111111.mp4', motion: { filename: 'd5f8a2b0-1111-4111-8111-111111111111-motion.mp4' } }
  ]));
});

test('导入校验拒绝 motion.filename / id / filename 中的路径穿越', () => {
  const base = { id: 'abc', type: 'photo', filename: 'abc.png' };
  assert.throws(
    () => validateBackupJson('memories.json', [{ ...base, motion: { filename: '../../../../etc/passwd' } }]),
    /动态照片文件名/
  );
  assert.throws(
    () => validateBackupJson('memories.json', [{ ...base, id: '../../server' }]),
    /照片记录 id/
  );
  assert.throws(
    () => validateBackupJson('memories.json', [{ ...base, filename: '../../config.json' }]),
    /媒体文件名/
  );
  assert.throws(
    () => validateBackupJson('memories.json', [{ ...base, filename: 'evil.html' }]),
    /媒体文件名/
  );
});

test('导入含恶意 motion.filename 的备份被拒绝，且不会写入目标保险库', async () => {
  const buf = await zipBuffer({
    'config.json': '{}',
    'memories.json': JSON.stringify([{
      id: 'abc', type: 'photo', filename: 'abc.png',
      motion: { filename: '../../../../etc/passwd' }
    }])
  });
  await withVault(
    (vault) => transferRouter(() => vault),
    async (origin, vault) => {
      const response = await importZip(origin, buf);
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /动态照片文件名/);
      assert.equal(vault.memories.list().length, 0);
    }
  );
});

test('safeVaultPath 只允许落在目标目录内的扁平文件名', () => {
  const dir = path.join(os.tmpdir(), 'moonbox-vault-media');
  assert.equal(safeVaultPath(dir, '../../server.js'), null);
  assert.equal(safeVaultPath(dir, 'nested/abc.png'), null);
  assert.equal(safeVaultPath(dir, 'abc\u0000.png'), null);
  assert.equal(safeVaultPath(dir, ''), null);
  assert.equal(safeVaultPath(dir, undefined), null);
  assert.equal(safeVaultPath(dir, 'abc.png'), path.resolve(dir, 'abc.png'));
});

test('历史脏记录也不会让永久删除越出保险库目录', async () => {
  await withVault(
    (vault) => memoriesRouter(() => vault.memories).router,
    async (origin, vault, root) => {
      const outside = path.join(root, 'sentinel.txt');
      await fsp.writeFile(outside, 'keep me');
      await vault.memories.add({
        id: 'evil', type: 'photo', filename: 'ok.png',
        motion: { filename: '../../sentinel.txt' }
      });
      const response = await fetch(origin + '/evil?permanent=1', { method: 'DELETE' });
      assert.equal(response.status, 200, await response.text());
      assert.equal(await fsp.readFile(outside, 'utf8'), 'keep me');
      assert.equal(vault.memories.get('evil'), null);
    }
  );
});
