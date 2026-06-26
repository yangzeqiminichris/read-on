# ReadOn MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出一个可"加载已解压扩展"运行的 MV3 Chrome 扩展最小可用版：在当前页面建 mark、跳回 mark 位置、就地更新 mark 位置（轻量党续读闭环）。

**Architecture:** 四层解耦——纯函数库（定位算法 / mark 模型，node:test 全覆盖）→ 浏览器 wrapper（唯一接触 `chrome.*` 的地方）→ content script（抓快照 / 执行滚动）→ popup（UI）。所有共享 JS 用轻量 UMD 包装，使同一份文件能在 Node（`module.exports`）、content script（`window.ReadOn.*` 全局）、popup（classic `<script>` 全局）三种环境复用，**全程无构建步骤**。

**Tech Stack:** 原生 JS + Chrome MV3；测试用 Node 自带 `node:test` + `node:assert`，无第三方依赖。

> 范围边界（本计划**不做**，留给后续计划）：笔记、行展开 `⌄`、删除 UI、All Marks 跨页面视图、导入/导出、options 全屏管理页、Firefox polyfill。本计划只覆盖单页面续读闭环。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `package.json` | 声明 `npm test` → `node --test`；无依赖 |
| `manifest.json` | MV3 清单：action popup + content script |
| `src/lib/positioning.js` | 纯函数：比例换算、像素↔比例、显示百分比、重复锚点选最近。UMD |
| `src/lib/marks.js` | 纯函数：pageKey、默认名、createMark/nextSeq、removeMark。UMD |
| `src/lib/browser.js` | `chrome.*` 唯一封装：storage / tabs / 消息。UMD |
| `src/lib/storage.js` | 数据层：读写 pageData，建/更新 mark，改名。依赖 browser + marks。UMD |
| `src/content.js` | content script：抓快照、执行定位滚动。classic（非 module） |
| `src/popup.html` | popup 结构 + 按顺序加载 classic 脚本 |
| `src/popup.css` | popup 样式 |
| `src/popup.js` | popup 逻辑：渲染当前页 marks、Mark/跳转/更新、就地改名 |
| `test/positioning.test.js` | positioning 单测 |
| `test/marks.test.js` | marks 单测 |
| `test/storage.test.js` | storage + browser 集成单测（mock chrome） |

**UMD 包装模板**（每个 `src/lib/*.js` 都用它，按各自键名挂载）：

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(/* 依赖见各文件 */);
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.<KEY> = factory(/* 依赖见各文件 */);
  }
})(typeof self !== 'undefined' ? self : this, function (/* deps */) {
  'use strict';
  // ...函数定义...
  return { /* 导出 */ };
});
```

---

## Task 1: 项目骨架（package.json + manifest + 目录）

**Files:**
- Create: `package.json`
- Create: `manifest.json`
- Create: `src/lib/.gitkeep`（占位，确保目录入 git）

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "readon",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: 创建 `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "ReadOn",
  "version": "0.1.0",
  "description": "Bookmark a scroll position on any page and pick up reading where you left off.",
  "permissions": ["storage", "tabs"],
  "action": {
    "default_popup": "src/popup.html",
    "default_title": "ReadOn"
  },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["src/lib/positioning.js", "src/content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 3: 创建占位文件确保目录存在**

创建空文件 `src/lib/.gitkeep`（内容留空）。

- [ ] **Step 4: 验证 `npm test` 可运行（暂无测试）**

Run: `npm test`
Expected: node 报告 0 tests / 退出码 0（"tests 0"），不报错。

- [ ] **Step 5: Commit**

```bash
git add package.json manifest.json src/lib/.gitkeep
git commit -m "chore: scaffold ReadOn MV3 extension skeleton"
```

---

## Task 2: positioning.js 纯函数库

**Files:**
- Create: `src/lib/positioning.js`
- Test: `test/positioning.test.js`

- [ ] **Step 1: 写失败的测试**

Create `test/positioning.test.js`:

```js
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
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test test/positioning.test.js`
Expected: FAIL —— `Cannot find module '../src/lib/positioning.js'`

- [ ] **Step 3: 写最小实现**

Create `src/lib/positioning.js`:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.positioning = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function pageRatio(scrollPosition, viewportHeight, contentHeight) {
    const scrollable = contentHeight - viewportHeight;
    if (scrollable <= 0) return 0;
    return clamp(scrollPosition / scrollable, 0, 1);
  }

  function viewportRatio(scrollPosition, viewportHeight) {
    if (viewportHeight <= 0) return 0;
    return scrollPosition / viewportHeight;
  }

  function ratioToScroll(strategy, ratio, viewportHeight, contentHeight) {
    const maxScroll = Math.max(0, contentHeight - viewportHeight);
    let target;
    if (strategy === 'viewport-ratio') {
      target = ratio * viewportHeight;
    } else {
      target = ratio * maxScroll;
    }
    return clamp(target, 0, maxScroll);
  }

  function displayPercent(scrollPosition, viewportHeight, contentHeight) {
    return Math.round(pageRatio(scrollPosition, viewportHeight, contentHeight) * 100);
  }

  function pickNearestAnchor(candidateOffsets, targetOffset) {
    if (!candidateOffsets || candidateOffsets.length === 0) return null;
    let best = candidateOffsets[0];
    let bestDist = Math.abs(best - targetOffset);
    for (let i = 1; i < candidateOffsets.length; i++) {
      const d = Math.abs(candidateOffsets[i] - targetOffset);
      if (d < bestDist) { best = candidateOffsets[i]; bestDist = d; }
    }
    return best;
  }

  return { clamp, pageRatio, viewportRatio, ratioToScroll, displayPercent, pickNearestAnchor };
});
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test test/positioning.test.js`
Expected: PASS（10 tests passing）

- [ ] **Step 5: Commit**

```bash
git add src/lib/positioning.js test/positioning.test.js
git commit -m "feat: add positioning pure-function library with tests"
```

---

## Task 3: marks.js 纯函数库（mark 模型 + nextSeq）

**Files:**
- Create: `src/lib/marks.js`
- Test: `test/marks.test.js`

- [ ] **Step 1: 写失败的测试**

Create `test/marks.test.js`:

```js
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
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test test/marks.test.js`
Expected: FAIL —— `Cannot find module '../src/lib/marks.js'`

- [ ] **Step 3: 写最小实现**

Create `src/lib/marks.js`:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.marks = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pageKeyFromURL(url) {
    const u = new URL(url);
    return u.hostname + u.pathname;
  }

  function makeDefaultName(seq) {
    return 'Mark #' + seq;
  }

  function emptyPageData(pageKey) {
    return { pageKey: pageKey, marks: [], nextSeq: 1 };
  }

  function createMark(pageData, opts) {
    const snapshot = opts.snapshot;
    const seq = pageData.nextSeq;
    const name = (opts.name && opts.name.trim()) || makeDefaultName(seq);
    const mark = {
      id: opts.id,
      name: name,
      pageKey: pageData.pageKey,
      pageURL: snapshot.pageURL,
      pageTitle: snapshot.pageTitle,
      note: '',
      createdAt: opts.now,
      updatedAt: opts.now,
      scrollPosition: snapshot.scrollPosition,
      viewportHeight: snapshot.viewportHeight,
      contentHeight: snapshot.contentHeight,
      strategy: snapshot.strategy || 'page-ratio',
      anchorText: snapshot.anchorText || '',
      scrollContainerSelector: snapshot.scrollContainerSelector || null,
    };
    const next = {
      pageKey: pageData.pageKey,
      marks: pageData.marks.concat([mark]),
      nextSeq: seq + 1,
    };
    return { pageData: next, mark: mark };
  }

  function removeMark(pageData, markId) {
    return {
      pageKey: pageData.pageKey,
      marks: pageData.marks.filter(function (m) { return m.id !== markId; }),
      nextSeq: pageData.nextSeq,
    };
  }

  return { pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark };
});
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test test/marks.test.js`
Expected: PASS（7 tests passing）

- [ ] **Step 5: Commit**

```bash
git add src/lib/marks.js test/marks.test.js
git commit -m "feat: add marks model with monotonic nextSeq and tests"
```

---

## Task 4: browser.js（chrome.* 唯一封装）

**Files:**
- Create: `src/lib/browser.js`

> 说明：`browser.js` 只是把 `chrome.*` 异步 API 收敛到一处（未来移植 Firefox 的唯一改动点）。它本身无业务逻辑，将在 Task 5 的 storage 测试中通过 mock chrome 间接验证，故本任务不单独写测试。

- [ ] **Step 1: 写实现**

Create `src/lib/browser.js`:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.browser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // MV3 (Chrome 88+) 的 chrome.storage / chrome.tabs 原生返回 Promise。
  async function storageGet(keys) {
    return chrome.storage.local.get(keys);
  }

  async function storageSet(obj) {
    return chrome.storage.local.set(obj);
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  async function sendMessageToTab(tabId, message) {
    return chrome.tabs.sendMessage(tabId, message);
  }

  return { storageGet, storageSet, getActiveTab, sendMessageToTab };
});
```

- [ ] **Step 2: 语法自检（Node 能 require 不报错）**

Run: `node -e "require('./src/lib/browser.js'); console.log('ok')"`
Expected: 打印 `ok`（无 SyntaxError；此处不调用任何函数，故不需要 chrome）。

- [ ] **Step 3: Commit**

```bash
git add src/lib/browser.js
git commit -m "feat: add chrome.* wrapper (browser.js)"
```

---

## Task 5: storage.js 数据层（依赖 browser + marks）

**Files:**
- Create: `src/lib/storage.js`
- Test: `test/storage.test.js`

- [ ] **Step 1: 写失败的测试**

Create `test/storage.test.js`:

```js
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
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test test/storage.test.js`
Expected: FAIL —— `Cannot find module '../src/lib/storage.js'`

- [ ] **Step 3: 写最小实现**

Create `src/lib/storage.js`:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./browser.js'), require('./marks.js'));
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.storage = factory(root.ReadOn.browser, root.ReadOn.marks);
  }
})(typeof self !== 'undefined' ? self : this, function (browser, marks) {
  'use strict';

  async function getPageData(pageKey) {
    const data = await browser.storageGet([pageKey]);
    return data[pageKey] || marks.emptyPageData(pageKey);
  }

  async function saveMark(pageKey, opts) {
    const pageData = await getPageData(pageKey);
    const result = marks.createMark(pageData, opts);
    await browser.storageSet({ [pageKey]: result.pageData });
    return result.mark;
  }

  async function updateMarkPosition(pageKey, markId, snapshot, now) {
    const pageData = await getPageData(pageKey);
    const updated = pageData.marks.map(function (m) {
      if (m.id !== markId) return m;
      return Object.assign({}, m, {
        scrollPosition: snapshot.scrollPosition,
        viewportHeight: snapshot.viewportHeight,
        contentHeight: snapshot.contentHeight,
        anchorText: snapshot.anchorText,
        strategy: snapshot.strategy || m.strategy,
        scrollContainerSelector:
          snapshot.scrollContainerSelector != null
            ? snapshot.scrollContainerSelector
            : m.scrollContainerSelector,
        updatedAt: now,
      });
    });
    await browser.storageSet({ [pageKey]: Object.assign({}, pageData, { marks: updated }) });
  }

  async function setMarkName(pageKey, markId, name) {
    const pageData = await getPageData(pageKey);
    const updated = pageData.marks.map(function (m) {
      return m.id === markId ? Object.assign({}, m, { name: name }) : m;
    });
    await browser.storageSet({ [pageKey]: Object.assign({}, pageData, { marks: updated }) });
  }

  return { getPageData, saveMark, updateMarkPosition, setMarkName };
});
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test test/storage.test.js`
Expected: PASS（5 tests passing）

- [ ] **Step 5: 跑全部测试确认无回归**

Run: `npm test`
Expected: PASS（positioning 10 + marks 7 + storage 5 = 22 tests passing）

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.js test/storage.test.js
git commit -m "feat: add storage data layer over browser+marks with tests"
```

---

## Task 6: content.js（抓快照 + 执行定位滚动）

**Files:**
- Create: `src/content.js`

> 说明：content script 直接操作 DOM/滚动，不做单元测试（纯函数已在 positioning 覆盖），用 Task 8 手动验收清单验证。content.js 在 manifest 里排在 `positioning.js` 之后加载，故可用 `window.ReadOn.positioning`。

- [ ] **Step 1: 写实现**

Create `src/content.js`:

```js
(function () {
  'use strict';
  const P = window.ReadOn.positioning;

  // 候选元素：含有可读文字的常见块级元素。
  const SELECTOR = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,td,pre,article,section,div';

  // 取当前视口顶部最近的、文字足够长的元素的 textContent 片段（最多 200 字符）。
  function getTopAnchorText() {
    const els = document.body.querySelectorAll(SELECTOR);
    let best = null;
    let bestTop = Infinity;
    for (const el of els) {
      const txt = (el.textContent || '').trim();
      if (txt.length < 10) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) continue;
      // 顶边在视口顶部附近（允许略高 5px），取最靠上的。
      if (rect.top >= -5 && rect.top < bestTop) {
        bestTop = rect.top;
        best = el;
      }
    }
    if (!best) return '';
    return (best.textContent || '').trim().slice(0, 200);
  }

  function snapshot() {
    return {
      scrollPosition: window.scrollY,
      viewportHeight: window.innerHeight,
      contentHeight: document.documentElement.scrollHeight,
      anchorText: getTopAnchorText(),
      strategy: 'page-ratio',
      pageURL: location.href,
      pageTitle: document.title,
      scrollContainerSelector: null,
    };
  }

  // 找出所有 textContent 含 anchorText 的元素的绝对 offsetTop。
  function findAnchorOffsets(anchorText) {
    if (!anchorText) return [];
    const els = document.body.querySelectorAll(SELECTOR);
    const offsets = [];
    for (const el of els) {
      const txt = (el.textContent || '').trim();
      if (txt.includes(anchorText)) {
        offsets.push(el.getBoundingClientRect().top + window.scrollY);
      }
    }
    return offsets;
  }

  function scrollToMark(mark) {
    const contentHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const ratio = P.pageRatio(mark.scrollPosition, mark.viewportHeight, mark.contentHeight);
    const ratioTarget = P.ratioToScroll(mark.strategy, ratio, viewportHeight, contentHeight);
    const offsets = findAnchorOffsets(mark.anchorText);
    const nearest = P.pickNearestAnchor(offsets, ratioTarget);
    const target = nearest != null ? nearest : ratioTarget;
    const maxScroll = Math.max(0, contentHeight - viewportHeight);
    window.scrollTo({ top: Math.min(Math.max(target, 0), maxScroll), behavior: 'smooth' });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'READON_CAPTURE') {
      sendResponse(snapshot());
      return true;
    }
    if (msg && msg.type === 'READON_SCROLL_TO') {
      scrollToMark(msg.mark);
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
})();
```

- [ ] **Step 2: 语法自检**

Run: `node -e "const fs=require('fs');new Function(fs.readFileSync('src/content.js','utf8'));console.log('syntax ok')"`
Expected: 打印 `syntax ok`（仅验证可解析，不执行；运行时 DOM/chrome 在浏览器里才有）。

- [ ] **Step 3: Commit**

```bash
git add src/content.js
git commit -m "feat: add content script for snapshot capture and scroll restore"
```

---

## Task 7: popup（UI：渲染当前页 marks + Mark/跳转/更新/就地改名）

**Files:**
- Create: `src/popup.html`
- Create: `src/popup.css`
- Create: `src/popup.js`

> 脚本加载顺序很重要：`positioning → marks → browser → storage → popup`（storage 依赖前面挂好的 `ReadOn.browser`/`ReadOn.marks`）。全部用 classic `<script>`（非 module），共享 `window.ReadOn` 命名空间。

- [ ] **Step 1: 写 `src/popup.html`**

Create `src/popup.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <header>
    <span class="title">ReadOn</span>
    <button id="mark-btn">Mark</button>
  </header>
  <div id="restricted" class="hidden">This page can't be marked.</div>
  <ul id="mark-list"></ul>
  <div id="empty" class="hidden">No marks on this page yet.</div>
  <div id="toast" class="toast hidden"></div>

  <script src="lib/positioning.js"></script>
  <script src="lib/marks.js"></script>
  <script src="lib/browser.js"></script>
  <script src="lib/storage.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: 写 `src/popup.css`**

Create `src/popup.css`:

```css
body { width: 320px; margin: 0; font: 13px/1.4 system-ui, sans-serif; color: #1a1a1a; }
header { display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid #eee; }
.title { font-weight: 600; }
#mark-btn { font: inherit; padding: 4px 12px; border: 1px solid #2563eb;
  background: #2563eb; color: #fff; border-radius: 6px; cursor: pointer; }
#mark-btn:disabled { opacity: .5; cursor: default; }
ul { list-style: none; margin: 0; padding: 0; }
li { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-bottom: 1px solid #f3f3f3; }
li .meta { flex: 1; min-width: 0; }
li .name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
li .name-input { font: inherit; width: 100%; box-sizing: border-box; }
li .pct { color: #888; font-size: 12px; }
li button { font: inherit; border: none; background: none; cursor: pointer;
  padding: 4px; border-radius: 4px; }
li button:hover { background: #f0f0f0; }
.hidden { display: none; }
#restricted, #empty { padding: 16px 12px; color: #888; text-align: center; }
.toast { position: fixed; left: 50%; bottom: 12px; transform: translateX(-50%);
  background: #1a1a1a; color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 12px; }
```

- [ ] **Step 3: 写 `src/popup.js`**

Create `src/popup.js`:

```js
(function () {
  'use strict';
  const { browser, storage, marks, positioning } = window.ReadOn;

  let currentPageKey = null;
  let currentTabId = null;

  function showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 1500);
  }

  async function capture() {
    return browser.sendMessageToTab(currentTabId, { type: 'READON_CAPTURE' });
  }

  function renderRow(mark, editing) {
    const li = document.createElement('li');

    const meta = document.createElement('div');
    meta.className = 'meta';

    if (editing) {
      const input = document.createElement('input');
      input.className = 'name-input';
      input.value = mark.name;
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') input.blur();
      });
      input.addEventListener('blur', async function () {
        const name = input.value.trim() || mark.name;
        await storage.setMarkName(currentPageKey, mark.id, name);
        await render();
      });
      meta.appendChild(input);
      setTimeout(function () { input.focus(); input.select(); }, 0);
    } else {
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = mark.name;
      meta.appendChild(name);
    }

    const pct = document.createElement('div');
    pct.className = 'pct';
    pct.textContent =
      positioning.displayPercent(mark.scrollPosition, mark.viewportHeight, mark.contentHeight) +
      '% scrolled';
    meta.appendChild(pct);
    li.appendChild(meta);

    const jump = document.createElement('button');
    jump.textContent = '▶';
    jump.title = 'Jump to this mark';
    jump.onclick = async function () {
      await browser.sendMessageToTab(currentTabId, { type: 'READON_SCROLL_TO', mark: mark });
      window.close();
    };
    li.appendChild(jump);

    const upd = document.createElement('button');
    upd.textContent = '⟳';
    upd.title = "Update this mark's position";
    upd.onclick = async function () {
      const snap = await capture();
      await storage.updateMarkPosition(currentPageKey, mark.id, snap, Date.now());
      await render();
      showToast('Position updated');
    };
    li.appendChild(upd);

    return li;
  }

  async function render(editId) {
    const pageData = await storage.getPageData(currentPageKey);
    const list = document.getElementById('mark-list');
    list.innerHTML = '';
    document.getElementById('empty').classList.toggle('hidden', pageData.marks.length > 0);
    for (const mark of pageData.marks) {
      list.appendChild(renderRow(mark, mark.id === editId));
    }
  }

  async function onMark() {
    const snap = await capture();
    const mark = await storage.saveMark(currentPageKey, {
      snapshot: snap, id: crypto.randomUUID(), now: Date.now(),
    });
    await render(mark.id); // 渲染时让新行进入改名编辑态
  }

  async function init() {
    const tab = await browser.getActiveTab();
    if (!tab || !/^https?:/.test(tab.url || '')) {
      document.getElementById('restricted').classList.remove('hidden');
      document.getElementById('mark-btn').disabled = true;
      return;
    }
    currentTabId = tab.id;
    currentPageKey = marks.pageKeyFromURL(tab.url);
    document.getElementById('mark-btn').onclick = onMark;
    await render();
  }

  init();
})();
```

- [ ] **Step 4: 语法自检（三处脚本）**

Run: `node -e "const fs=require('fs');for(const f of ['src/popup.js']){new Function(fs.readFileSync(f,'utf8'))};console.log('syntax ok')"`
Expected: 打印 `syntax ok`

- [ ] **Step 5: Commit**

```bash
git add src/popup.html src/popup.css src/popup.js
git commit -m "feat: add popup UI for current-page marks (mark/jump/update/rename)"
```

---

## Task 8: 手动验收（在真实长文档上跑续读闭环）

**Files:** 无（仅手动验证 + 收尾 commit）

> content script 注入只对**加载扩展之后新打开/刷新**的页面生效。验收前先刷新目标标签页一次。

- [ ] **Step 1: 加载扩展**

打开 Chrome → `chrome://extensions` → 打开右上角"开发者模式" → "加载已解压的扩展程序" → 选择仓库根目录 `C:\Code\REPO\readOn`。确认无错误、ReadOn 图标出现在工具栏。

- [ ] **Step 2: 轻量党续读闭环**

打开一篇长文档（建议 LangChain 官方 doc 任一长页），**刷新一次**。滚到中间某段 → 点 ReadOn 图标 → 点 `Mark` → 出现 `Mark #1` 行并进入改名输入框 → 输入名字按 Enter（或直接失焦用默认名）。
Expected: 列表出现该 mark，显示 `NN% scrolled` 百分比与当前滚动位置相符。

- [ ] **Step 3: 跳转验证**

滚回页面顶部 → 打开 popup → 点该 mark 的 `▶`。
Expected: 页面平滑滚动回到当初标记的那段附近，popup 关闭。

- [ ] **Step 4: update 验证**

滚到另一个位置 → 打开 popup → 点该 mark 的 `⟳`。
Expected: 出现 "Position updated" toast，百分比更新为新位置；再点 `▶` 跳到新位置。

- [ ] **Step 5: 抗漂移验证（文字锚点）**

在标记位置**上方**展开一段原本折叠的内容（或浏览器缩放改变布局使像素位置偏移）→ 点 `▶`。
Expected: 仍能定位到当初标记的那段文字附近（文字锚点纠正了比例漂移），而非单纯回到旧像素值。

- [ ] **Step 6: 受限页面验证**

在 `chrome://extensions` 标签页打开 popup。
Expected: 显示 "This page can't be marked."，`Mark` 按钮置灰。

- [ ] **Step 7: 记录验收结果并收尾**

若某步未达预期，按 superpowers:systematic-debugging 处理后再继续。全部通过后：

```bash
git add -A
git commit -m "docs: ReadOn MVP manual acceptance passed" --allow-empty
```

---

## 自检对照（计划 vs 设计文档）

- 数据模型（设计§4）→ Task 3 `createMark` 字段齐全；`nextSeq` 单调递增永不复用有专门测试。✓
- 定位算法 比例+文字锚点（设计§5）→ Task 2 纯函数 + Task 6 content script `findAnchorOffsets`/`pickNearestAnchor` 退回纯比例。✓
- 新建 mark + 就地改名（设计§6①）→ Task 7 `onMark` + 编辑态行。✓
- update（设计§6③）→ Task 7 `⟳` + Task 5 `updateMarkPosition` 只改定位字段。✓
- 本页跳转（设计§6④本页）→ Task 7 `▶` + Task 6 `scrollToMark`。✓
- 受限页面置灰（设计§7）→ Task 7 `init` 的 `https?` 校验。✓
- 页面变短 clamp（设计§7）→ Task 2 `ratioToScroll` + Task 6 `scrollTo` 双重 clamp。✓
- chrome.* 收敛单一文件（设计§2）→ Task 4 `browser.js`，其余模块零直接 `chrome.*`（content.js 的 `chrome.runtime.onMessage` 为 content script 固有入口，属可接受例外）。✓
- 纯函数 node:test（设计§8）→ Task 2/3/5 共 22 个单测。✓

**本计划明确未覆盖（设计中属后续计划）**：笔记、行展开 `⌄`、删除 UI、All Marks 跨页面视图与跨页面跳转、导入/导出、options 全屏页。
