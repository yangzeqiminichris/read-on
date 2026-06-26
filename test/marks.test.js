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
