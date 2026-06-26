const test = require('node:test');
const assert = require('node:assert');
const { formatRelativeTime } = require('../src/lib/time.js');

const NOW = new Date(2026, 5, 26, 12, 0, 0).getTime(); // 本地 2026-06-26 12:00
const sec = 1000, min = 60 * sec, hour = 60 * min, day = 24 * hour;

test('小于 1 分钟 → just now', () => {
  assert.strictEqual(formatRelativeTime(NOW - 30 * sec, NOW), 'just now');
});

test('分钟级，单复数正确', () => {
  assert.strictEqual(formatRelativeTime(NOW - 1 * min, NOW), '1 minute ago');
  assert.strictEqual(formatRelativeTime(NOW - 5 * min, NOW), '5 minutes ago');
});

test('小时级，单复数正确', () => {
  assert.strictEqual(formatRelativeTime(NOW - 1 * hour, NOW), '1 hour ago');
  assert.strictEqual(formatRelativeTime(NOW - 3 * hour, NOW), '3 hours ago');
});

test('天级（<7 天），单复数正确', () => {
  assert.strictEqual(formatRelativeTime(NOW - 1 * day, NOW), '1 day ago');
  assert.strictEqual(formatRelativeTime(NOW - 2 * day, NOW), '2 days ago');
  assert.strictEqual(formatRelativeTime(NOW - 6 * day, NOW), '6 days ago');
});

test('≥7 天，同年 → 月日（Jun 19）', () => {
  assert.strictEqual(formatRelativeTime(NOW - 7 * day, NOW), 'Jun 19');
});

test('≥7 天，跨年 → 月日加年', () => {
  const ts = new Date(2025, 5, 12).getTime(); // 本地 2025-06-12
  assert.strictEqual(formatRelativeTime(ts, NOW), 'Jun 12, 2025');
});

test('未来时间（时钟漂移）当作 just now', () => {
  assert.strictEqual(formatRelativeTime(NOW + 10 * sec, NOW), 'just now');
});
