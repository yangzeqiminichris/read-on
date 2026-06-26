const test = require('node:test');
const assert = require('node:assert');

// ——内存版 chrome.storage.local mock——
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
