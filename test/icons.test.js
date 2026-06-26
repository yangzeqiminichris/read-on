const test = require('node:test');
const assert = require('node:assert');
const icons = require('../src/lib/icons.js');

test('icons.data 含 MVP 所需图标且为非空字符串', () => {
  for (const id of ['bookmark', 'plus', 'play', 'rotate-cw', 'bookmark-plus']) {
    assert.ok(typeof icons.data[id] === 'string' && icons.data[id].length > 0, id);
  }
});

test('icons.el 是函数', () => {
  assert.strictEqual(typeof icons.el, 'function');
});
