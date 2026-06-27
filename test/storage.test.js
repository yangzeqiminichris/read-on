const test = require('node:test');
const assert = require('node:assert');

function installFakeChrome() {
  const store = {};
  global.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (keys == null) return { ...store };
          const arr = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of arr) if (k in store) out[k] = store[k];
          return out;
        },
        async set(obj) { Object.assign(store, obj); },
        async remove(key) { delete store[key]; },
      },
    },
  };
  return store;
}

const storage = require('../src/lib/storage.js');

const snap = {
  scrollPosition: 500, viewportHeight: 1000, contentHeight: 2000,
  anchorText: 'alpha', strategy: 'page-ratio',
  pageURL: 'https://x.com/a', pageTitle: 'A', scrollContainerSelector: null,
};

test('getPageData 在无数据时返回空 pageData', async () => {
  installFakeChrome();
  const pd = await storage.getPageData('x.com/a');
  assert.deepStrictEqual(pd, { pageKey: 'x.com/a', marks: [], nextSeq: 1 });
});

test('saveMark 持久化并返回新 mark', async () => {
  const store = installFakeChrome();
  const mark = await storage.saveMark('x.com/a', { snapshot: snap, id: 'id1', now: 100 });
  assert.strictEqual(mark.name, 'Mark #1');
  assert.strictEqual(store['x.com/a'].marks.length, 1);
  assert.strictEqual(store['x.com/a'].nextSeq, 2);
});

test('saveMark 连续两次 nextSeq 递增', async () => {
  installFakeChrome();
  const m1 = await storage.saveMark('x.com/a', { snapshot: snap, id: 'a', now: 1 });
  const m2 = await storage.saveMark('x.com/a', { snapshot: snap, id: 'b', now: 2 });
  assert.strictEqual(m1.name, 'Mark #1');
  assert.strictEqual(m2.name, 'Mark #2');
});

test('updateMarkPosition 只改定位字段与 updatedAt，不动 name/note/createdAt', async () => {
  const store = installFakeChrome();
  await storage.saveMark('x.com/a', { name: 'Keep', snapshot: snap, id: 'id1', now: 100 });
  const newSnap = { ...snap, scrollPosition: 1234, anchorText: 'beta' };
  await storage.updateMarkPosition('x.com/a', 'id1', newSnap, 999);
  const m = store['x.com/a'].marks[0];
  assert.strictEqual(m.name, 'Keep');
  assert.strictEqual(m.createdAt, 100);
  assert.strictEqual(m.updatedAt, 999);
  assert.strictEqual(m.scrollPosition, 1234);
  assert.strictEqual(m.anchorText, 'beta');
});

test('setMarkName 只改名字', async () => {
  const store = installFakeChrome();
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'id1', now: 1 });
  await storage.setMarkName('x.com/a', 'id1', 'Chapter 2');
  assert.strictEqual(store['x.com/a'].marks[0].name, 'Chapter 2');
});

test('deleteMark 删除指定 mark，nextSeq 不变（不复用）', async () => {
  const store = installFakeChrome();
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'a', now: 1 });
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'b', now: 2 });
  await storage.deleteMark('x.com/a', 'a');
  assert.strictEqual(store['x.com/a'].marks.length, 1);
  assert.strictEqual(store['x.com/a'].marks[0].id, 'b');
  assert.strictEqual(store['x.com/a'].nextSeq, 3);
});

test('setNote 只改 note，不动 name/createdAt/updatedAt', async () => {
  const store = installFakeChrome();
  await storage.saveMark('x.com/a', { name: 'Keep', snapshot: snap, id: 'id1', now: 100 });
  await storage.setNote('x.com/a', 'id1', 'my note');
  const m = store['x.com/a'].marks[0];
  assert.strictEqual(m.note, 'my note');
  assert.strictEqual(m.name, 'Keep');
  assert.strictEqual(m.createdAt, 100);
  assert.strictEqual(m.updatedAt, 100);
});

test('setNote 可清空笔记', async () => {
  const store = installFakeChrome();
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'id1', now: 1 });
  await storage.setNote('x.com/a', 'id1', 'x');
  await storage.setNote('x.com/a', 'id1', '');
  assert.strictEqual(store['x.com/a'].marks[0].note, '');
});

test('getAllPageData 返回整个存储（多页）', async () => {
  installFakeChrome();
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'a', now: 1 });
  await storage.saveMark('y.com/b', { snapshot: snap, id: 'b', now: 2 });
  const all = await storage.getAllPageData();
  assert.ok(all['x.com/a'] && all['y.com/b']);
});

test('setPendingJump/getPendingJump/clearPendingJump 往返', async () => {
  installFakeChrome();
  assert.strictEqual(await storage.getPendingJump(), null);
  await storage.setPendingJump('x.com/a', { id: 'm1' }, 12345);
  const rec = await storage.getPendingJump();
  assert.deepStrictEqual(rec, { pageKey: 'x.com/a', mark: { id: 'm1' }, ts: 12345 });
  await storage.clearPendingJump();
  assert.strictEqual(await storage.getPendingJump(), null);
});

test('deleteMarks 跨页批量删除，nextSeq 不变', async () => {
  const store = installFakeChrome();
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'a1', now: 1 });
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'a2', now: 2 });
  await storage.saveMark('y.com/b', { snapshot: snap, id: 'b1', now: 3 });
  await storage.deleteMarks([{ pageKey: 'x.com/a', id: 'a1' }, { pageKey: 'y.com/b', id: 'b1' }]);
  assert.deepStrictEqual(store['x.com/a'].marks.map(function (m) { return m.id; }), ['a2']);
  assert.strictEqual(store['x.com/a'].nextSeq, 3);
  assert.strictEqual(store['y.com/b'].marks.length, 0);
});

test('importMerge 合并写回并返回新增数', async () => {
  const store = installFakeChrome();
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'a', now: 1 });
  const a = store['x.com/a'].marks[0];
  const imported = {
    'x.com/a': { pageKey: 'x.com/a', nextSeq: 1, marks: [ a, Object.assign({}, a, { id: 'b' }) ] },
    'y.com/c': { pageKey: 'y.com/c', nextSeq: 1, marks: [ Object.assign({}, a, { id: 'c', pageKey: 'y.com/c' }) ] },
  };
  const added = await storage.importMerge(imported);
  assert.strictEqual(added, 2);
  assert.deepStrictEqual(store['x.com/a'].marks.map(function (m) { return m.id; }), ['a', 'b']);
  assert.ok(store['y.com/c']);
});
