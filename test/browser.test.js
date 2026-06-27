const test = require('node:test');
const assert = require('node:assert');

// ——chrome mock：可控制 ping 是否失败——
function installChrome(opts) {
  const calls = { sent: [], executeScript: [] };
  global.chrome = {
    tabs: {
      async sendMessage(tabId, msg) {
        calls.sent.push({ tabId: tabId, msg: msg });
        if (msg.type === 'READON_PING' && opts.pingFails) {
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        return { ok: true };
      },
    },
    scripting: {
      async executeScript(arg) {
        calls.executeScript.push(arg);
        return [];
      },
    },
  };
  return calls;
}

const browser = require('../src/lib/browser.js');

test('ensureContentScript: 内容脚本已在（ping 成功）则不注入', async () => {
  const calls = installChrome({ pingFails: false });
  await browser.ensureContentScript(7);
  assert.strictEqual(calls.executeScript.length, 0);
  assert.deepStrictEqual(calls.sent[0], { tabId: 7, msg: { type: 'READON_PING' } });
});

test('ensureContentScript: ping 失败则注入全部依赖 + content', async () => {
  const calls = installChrome({ pingFails: true });
  await browser.ensureContentScript(7);
  assert.strictEqual(calls.executeScript.length, 1);
  assert.deepStrictEqual(calls.executeScript[0], {
    target: { tabId: 7 },
    files: ['src/lib/positioning.js', 'src/lib/marks.js', 'src/lib/browser.js', 'src/lib/storage.js', 'src/content.js'],
  });
});
