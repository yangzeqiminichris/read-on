const test = require('node:test');
const assert = require('node:assert');
const icons = require('../src/lib/icons.js');

test('icons.data 含所需图标且为非空字符串', () => {
  const ids = ['bookmark', 'plus', 'play', 'rotate-cw', 'bookmark-plus',
               'chevron-down', 'trash-2', 'square-pen', 'globe', 'list',
               'search', 'download', 'upload'];
  for (const id of ids) {
    assert.ok(typeof icons.data[id] === 'string' && icons.data[id].length > 0, id);
  }
});

test('icons.el 是函数', () => {
  assert.strictEqual(typeof icons.el, 'function');
});
