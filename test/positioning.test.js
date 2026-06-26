const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/lib/positioning.js');

test('pageRatio 返回 0~1 的占整页比例', () => {
  // 滚了 500px，视口 1000，内容 2000 → 可滚 1000 → 0.5
  assert.strictEqual(P.pageRatio(500, 1000, 2000), 0.5);
});

test('pageRatio 在内容不可滚动时返回 0（防除零）', () => {
  assert.strictEqual(P.pageRatio(0, 1000, 800), 0);
  assert.strictEqual(P.pageRatio(0, 1000, 1000), 0);
});

test('pageRatio 把越界比例 clamp 到 0~1', () => {
  assert.strictEqual(P.pageRatio(99999, 1000, 2000), 1);
  assert.strictEqual(P.pageRatio(-50, 1000, 2000), 0);
});

test('viewportRatio 返回往下几屏', () => {
  assert.strictEqual(P.viewportRatio(2000, 1000), 2);
});

test('ratioToScroll page-ratio 把比例还原成像素并 clamp', () => {
  // 0.5 * (2000-1000) = 500
  assert.strictEqual(P.ratioToScroll('page-ratio', 0.5, 1000, 2000), 500);
  // 超界 clamp 到 maxScroll
  assert.strictEqual(P.ratioToScroll('page-ratio', 5, 1000, 2000), 1000);
});

test('ratioToScroll viewport-ratio 用视口高换算', () => {
  // 2 屏 * 1000 = 2000，但 maxScroll=1000 → clamp 到 1000
  assert.strictEqual(P.ratioToScroll('viewport-ratio', 2, 1000, 2000), 1000);
  assert.strictEqual(P.ratioToScroll('viewport-ratio', 0.5, 1000, 3000), 500);
});

test('page-ratio 像素→比例→像素 往返一致', () => {
  const r = P.pageRatio(730, 900, 4000);
  assert.strictEqual(P.ratioToScroll('page-ratio', r, 900, 4000), 730);
});

test('displayPercent 返回 0~100 整数', () => {
  assert.strictEqual(P.displayPercent(930, 1000, 2000), 93);
  assert.strictEqual(P.displayPercent(0, 1000, 2000), 0);
});

test('pickNearestAnchor 选离目标最近的那处', () => {
  assert.strictEqual(P.pickNearestAnchor([100, 800, 1500], 850), 800);
});

test('pickNearestAnchor 空数组返回 null', () => {
  assert.strictEqual(P.pickNearestAnchor([], 500), null);
  assert.strictEqual(P.pickNearestAnchor(undefined, 500), null);
});
