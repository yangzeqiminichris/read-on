const test = require('node:test');
const assert = require('node:assert');
const M = require('../src/lib/marks.js');

const snap = {
  scrollPosition: 500, viewportHeight: 1000, contentHeight: 2000,
  anchorText: 'hello world', strategy: 'page-ratio',
  pageURL: 'https://x.com/doc', pageTitle: 'Doc', scrollContainerSelector: null,
};

test('pageKeyFromURL 用 hostname + pathname，去掉 hash 与 query', () => {
  assert.strictEqual(
    M.pageKeyFromURL('https://python.langchain.com/docs/intro?x=1#section'),
    'python.langchain.com/docs/intro'
  );
});

test('makeDefaultName 生成 "Mark #N"', () => {
  assert.strictEqual(M.makeDefaultName(3), 'Mark #3');
});

test('emptyPageData 初始 nextSeq 为 1', () => {
  const pd = M.emptyPageData('x.com/a');
  assert.deepStrictEqual(pd, { pageKey: 'x.com/a', marks: [], nextSeq: 1 });
});

test('createMark 用默认名并把 nextSeq 自增', () => {
  const pd = M.emptyPageData('x.com/a');
  const { pageData, mark } = M.createMark(pd, { snapshot: snap, id: 'id1', now: 100 });
  assert.strictEqual(mark.name, 'Mark #1');
  assert.strictEqual(mark.id, 'id1');
  assert.strictEqual(mark.createdAt, 100);
  assert.strictEqual(mark.updatedAt, 100);
  assert.strictEqual(mark.note, '');
  assert.strictEqual(mark.scrollPosition, 500);
  assert.strictEqual(pageData.nextSeq, 2);
  assert.strictEqual(pageData.marks.length, 1);
});

test('createMark 接受自定义名（非空才用）', () => {
  const pd = M.emptyPageData('x.com/a');
  const r1 = M.createMark(pd, { name: 'Intro', snapshot: snap, id: 'i', now: 1 });
  assert.strictEqual(r1.mark.name, 'Intro');
  const r2 = M.createMark(pd, { name: '   ', snapshot: snap, id: 'i', now: 1 });
  assert.strictEqual(r2.mark.name, 'Mark #1'); // 空白回退默认名
});

test('nextSeq 单调递增、删除后永不复用', () => {
  let pd = M.emptyPageData('x.com/a');
  pd = M.createMark(pd, { snapshot: snap, id: 'a', now: 1 }).pageData; // #1
  pd = M.createMark(pd, { snapshot: snap, id: 'b', now: 1 }).pageData; // #2
  pd = M.createMark(pd, { snapshot: snap, id: 'c', now: 1 }).pageData; // #3
  pd = M.removeMark(pd, 'a'); // 删 #1，nextSeq 不回退
  assert.strictEqual(pd.nextSeq, 4);
  assert.strictEqual(pd.marks.length, 2);
  const after = M.createMark(pd, { snapshot: snap, id: 'd', now: 1 });
  assert.strictEqual(after.mark.name, 'Mark #4'); // 不复用 #1
});

test('createMark 不修改原 pageData（不可变）', () => {
  const pd = M.emptyPageData('x.com/a');
  M.createMark(pd, { snapshot: snap, id: 'a', now: 1 });
  assert.strictEqual(pd.marks.length, 0);
  assert.strictEqual(pd.nextSeq, 1);
});

test('groupMarksByPage 跳过空组与非 pageData 键', () => {
  const all = {
    'x.com/a': { pageKey: 'x.com/a', marks: [], nextSeq: 1 },
    '_readon_pending_jump': { pageKey: 'x.com/a', mark: {}, ts: 1 },
  };
  assert.deepStrictEqual(M.groupMarksByPage(all), []);
});

test('groupMarksByPage 组内按 createdAt 升序，组间按最近活动倒序', () => {
  function mk(id, created, updated, pk, title, url) {
    return { id: id, name: id, pageKey: pk, pageTitle: title, pageURL: url,
             note: '', createdAt: created, updatedAt: updated,
             scrollPosition: 0, viewportHeight: 1, contentHeight: 2,
             strategy: 'page-ratio', anchorText: '', scrollContainerSelector: null };
  }
  const all = {
    'a.com/p': { pageKey: 'a.com/p', nextSeq: 3, marks: [
      mk('a2', 200, 200, 'a.com/p', 'A new', 'https://a.com/p'),
      mk('a1', 100, 150, 'a.com/p', 'A old', 'https://a.com/p'),
    ] },
    'b.com/q': { pageKey: 'b.com/q', nextSeq: 2, marks: [
      mk('b1', 50, 900, 'b.com/q', 'B', 'https://b.com/q'),
    ] },
  };
  const groups = M.groupMarksByPage(all);
  assert.deepStrictEqual(groups.map(function (g) { return g.pageKey; }), ['b.com/q', 'a.com/p']);
  assert.deepStrictEqual(groups[1].marks.map(function (m) { return m.id; }), ['a1', 'a2']);
  assert.strictEqual(groups[1].pageTitle, 'A new');
  assert.strictEqual(groups[1].pageURL, 'https://a.com/p');
  assert.strictEqual(groups[0].lastActivity, 900);
});

test('normalizeImport 接受 {pages} 与裸 map，拒绝非法', () => {
  const pd = { pageKey: 'x.com/a', nextSeq: 1, marks: [] };
  assert.deepStrictEqual(M.normalizeImport({ pages: { 'x.com/a': pd } }), { 'x.com/a': pd });
  assert.deepStrictEqual(M.normalizeImport({ 'x.com/a': pd }), { 'x.com/a': pd });
  assert.strictEqual(M.normalizeImport(null), null);
  assert.strictEqual(M.normalizeImport({ foo: 1 }), null);
});

test('mergeImport 按 id 去重、并入新页面、nextSeq 取 max、不可变', () => {
  function mk(id) {
    return { id: id, name: id, pageKey: 'x.com/a', pageTitle: 'A', pageURL: 'u', note: '',
             createdAt: 1, updatedAt: 1, scrollPosition: 0, viewportHeight: 1, contentHeight: 2,
             strategy: 'page-ratio', anchorText: '', scrollContainerSelector: null };
  }
  const existing = { 'x.com/a': { pageKey: 'x.com/a', nextSeq: 2, marks: [ mk('a') ] } };
  const imported = {
    'x.com/a': { pageKey: 'x.com/a', nextSeq: 5, marks: [ mk('a'), mk('b') ] },
    'y.com/c': { pageKey: 'y.com/c', nextSeq: 3, marks: [ mk('c') ] },
  };
  const merged = M.mergeImport(existing, imported);
  assert.deepStrictEqual(merged['x.com/a'].marks.map(function (m) { return m.id; }), ['a', 'b']);
  assert.strictEqual(merged['x.com/a'].nextSeq, 5);
  assert.ok(merged['y.com/c']);
  assert.strictEqual(existing['x.com/a'].marks.length, 1);
});

test('buildExport 结构与过滤', () => {
  const all = { 'x.com/a': { pageKey: 'x.com/a', nextSeq: 1, marks: [] }, '_readon_pending_jump': { ts: 1 } };
  const exp = M.buildExport(all, 999);
  assert.strictEqual(exp.version, 1);
  assert.strictEqual(exp.exportedAt, 999);
  assert.ok(exp.pages['x.com/a']);
  assert.strictEqual(exp.pages['_readon_pending_jump'], undefined);
});

test('domainOf 取 hostname', () => {
  assert.strictEqual(M.domainOf('x.com/a/b'), 'x.com');
  assert.strictEqual(M.domainOf('x.com'), 'x.com');
});

test('aliasOr 有值用值、空白/缺失/非串回退', () => {
  assert.strictEqual(M.aliasOr({ a: 'X' }, 'a', 'def'), 'X');
  assert.strictEqual(M.aliasOr({ a: '  ' }, 'a', 'def'), 'def');
  assert.strictEqual(M.aliasOr({}, 'a', 'def'), 'def');
  assert.strictEqual(M.aliasOr(null, 'a', 'def'), 'def');
  assert.strictEqual(M.aliasOr({ a: 5 }, 'a', 'def'), 'def');
});

test('groupMarksByDomain 按域名归并并排序', () => {
  function mk(id, created, updated, pk, title, url) {
    return { id: id, name: id, pageKey: pk, pageTitle: title, pageURL: url, note: '',
             createdAt: created, updatedAt: updated, scrollPosition: 0, viewportHeight: 1, contentHeight: 2,
             strategy: 'page-ratio', anchorText: '', scrollContainerSelector: null };
  }
  const all = {
    'a.com/p1': { pageKey: 'a.com/p1', nextSeq: 2, marks: [ mk('a1', 100, 150, 'a.com/p1', 'P1', 'https://a.com/p1') ] },
    'a.com/p2': { pageKey: 'a.com/p2', nextSeq: 2, marks: [ mk('a2', 120, 120, 'a.com/p2', 'P2', 'https://a.com/p2') ] },
    'b.com/q':  { pageKey: 'b.com/q',  nextSeq: 2, marks: [ mk('b1', 50, 900, 'b.com/q', 'Q', 'https://b.com/q') ] },
  };
  const domains = M.groupMarksByDomain(all);
  assert.deepStrictEqual(domains.map(function (d) { return d.domain; }), ['b.com', 'a.com']);
  const a = domains[1];
  assert.strictEqual(a.markCount, 2);
  assert.deepStrictEqual(a.pages.map(function (p) { return p.pageKey; }), ['a.com/p1', 'a.com/p2']);
});
