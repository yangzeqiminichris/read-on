# ReadOn All Marks 跨页面视图 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 弹窗内新增 All Marks 视图（头部切换、按页面分组、只读 + 笔记预览），支持跨页面跳转续读。

**Architecture:** 复用现有暖色阅读 UI 与定位算法。新增纯函数 `marks.groupMarksByPage` 与存储 `getAllPageData`/待跳转读写（均单测）；跨页面跳转用 storage 里的"待跳转"记录 + 目标页 content script 加载时消费（等高度稳定再定位），无后台 service worker。

**Tech Stack:** 原生 JS + MV3，无构建；UMD；`node:test`。

> 设计依据：`docs/superpowers/specs/2026-06-27-all-marks-cross-page.md`。基线：master `d0fb255`（42 单测）。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/lib/marks.js` | 改 | 新增 `groupMarksByPage(allData)` 纯函数 |
| `test/marks.test.js` | 改 | groupMarksByPage 测试 |
| `src/lib/browser.js` | 改 | 新增 `storageRemove`、`navigateTab` |
| `src/lib/storage.js` | 改 | 新增 `getAllPageData`、`setPendingJump`、`getPendingJump`、`clearPendingJump` |
| `test/storage.test.js` | 改 | 上述 + mock chrome 增加 `remove` |
| `src/lib/icons.js` | 改 | 新增 `globe`、`list` |
| `test/icons.test.js` | 改 | 断言新图标 |
| `manifest.json` | 改 | content_scripts 增载 marks/browser/storage |
| `src/content.js` | 改写 | 加载时消费待跳转（等高度稳定再定位） |
| `src/popup.html` | 改 | 头部 `[+ Mark] [All marks]` + all 图标占位 |
| `src/popup.css` | 改 | 头部按钮组、All marks 激活态、组头、笔记预览 |
| `src/popup.js` | 改写 | 视图切换 + All Marks 渲染 + 跨页面 jumpTo |

---

## Task 1: marks.groupMarksByPage（TDD）

**Files:** Modify `src/lib/marks.js`, `test/marks.test.js`

- [ ] **Step 1: 在 `test/marks.test.js` 末尾追加：**

```js
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
  // b 组最近活动 900 > a 组 200 → b 在前
  assert.deepStrictEqual(groups.map(function (g) { return g.pageKey; }), ['b.com/q', 'a.com/p']);
  // a 组内按 createdAt 升序：a1(100) 在 a2(200) 前
  assert.deepStrictEqual(groups[1].marks.map(function (m) { return m.id; }), ['a1', 'a2']);
  // 组标题/URL 取最近更新的 mark（a 组里 a2 updated 200 > a1 150）
  assert.strictEqual(groups[1].pageTitle, 'A new');
  assert.strictEqual(groups[1].pageURL, 'https://a.com/p');
  assert.strictEqual(groups[0].lastActivity, 900);
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/marks.test.js` — Expected: FAIL（`groupMarksByPage is not a function`）

- [ ] **Step 3: 在 `src/lib/marks.js` 中，把结尾的 `return { ... };` 之前插入函数，并把返回对象加上 `groupMarksByPage`。** 即把：

```js
  function removeMark(pageData, markId) {
    return {
      pageKey: pageData.pageKey,
      marks: pageData.marks.filter(function (m) { return m.id !== markId; }),
      nextSeq: pageData.nextSeq,
    };
  }

  return { pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark };
```

替换为：

```js
  function removeMark(pageData, markId) {
    return {
      pageKey: pageData.pageKey,
      marks: pageData.marks.filter(function (m) { return m.id !== markId; }),
      nextSeq: pageData.nextSeq,
    };
  }

  // 把整个 storage 对象（{[pageKey]: pageData}，可能混入非 pageData 键）整理成
  // 按页面分组、组内 createdAt 升序、组间最近活动(组内 max updatedAt)倒序的数组。
  function groupMarksByPage(allData) {
    const groups = [];
    for (const key in allData) {
      const pd = allData[key];
      if (!pd || !Array.isArray(pd.marks) || pd.marks.length === 0) continue;
      const sorted = pd.marks.slice().sort(function (a, b) { return a.createdAt - b.createdAt; });
      let recent = sorted[0];
      for (const m of sorted) if (m.updatedAt > recent.updatedAt) recent = m;
      groups.push({
        pageKey: pd.pageKey,
        pageTitle: recent.pageTitle,
        pageURL: recent.pageURL,
        marks: sorted,
        lastActivity: recent.updatedAt,
      });
    }
    groups.sort(function (a, b) { return b.lastActivity - a.lastActivity; });
    return groups;
  }

  return {
    pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark, groupMarksByPage,
  };
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/marks.test.js` — Expected: PASS（9 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/marks.js test/marks.test.js
git commit -m "feat: add groupMarksByPage for All Marks grouping"
```

---

## Task 2: browser.js storageRemove + navigateTab

**Files:** Modify `src/lib/browser.js`

> 无独立单测（薄 chrome 包装）；由 Task 3 的 storage 测试与手动验收覆盖。

- [ ] **Step 1: 把 `src/lib/browser.js` 结尾的 return 行：**

```js
  return { storageGet, storageSet, getActiveTab, sendMessageToTab, ensureContentScript };
```

替换为（在其前插入两个函数）：

```js
  async function storageRemove(key) {
    return chrome.storage.local.remove(key);
  }

  async function navigateTab(tabId, url) {
    return chrome.tabs.update(tabId, { url: url });
  }

  return {
    storageGet, storageSet, getActiveTab, sendMessageToTab, ensureContentScript,
    storageRemove, navigateTab,
  };
```

- [ ] **Step 2: 语法自检** — Run: `node -e "require('./src/lib/browser.js'); console.log('ok')"` — Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/lib/browser.js
git commit -m "feat: add browser.storageRemove and navigateTab"
```

---

## Task 3: storage getAllPageData + 待跳转读写（TDD）

**Files:** Modify `src/lib/storage.js`, `test/storage.test.js`

- [ ] **Step 1: 用以下完整内容替换 `test/storage.test.js`**（mock chrome 增加 `remove`，并新增 4 个测试）：

```js
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
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/storage.test.js` — Expected: FAIL（`getAllPageData is not a function`）

- [ ] **Step 3: 在 `src/lib/storage.js` 中，把结尾的 return 块：**

```js
  return {
    getPageData, saveMark, updateMarkPosition, setMarkName, deleteMark, setNote,
  };
```

替换为（在其前插入函数）：

```js
  async function getAllPageData() {
    return browser.storageGet(null);
  }

  const PENDING_KEY = '_readon_pending_jump';

  async function setPendingJump(pageKey, mark, now) {
    const ts = (now === undefined) ? Date.now() : now;
    await browser.storageSet({ [PENDING_KEY]: { pageKey: pageKey, mark: mark, ts: ts } });
  }

  async function getPendingJump() {
    const data = await browser.storageGet([PENDING_KEY]);
    return data[PENDING_KEY] || null;
  }

  async function clearPendingJump() {
    await browser.storageRemove(PENDING_KEY);
  }

  return {
    getPageData, saveMark, updateMarkPosition, setMarkName, deleteMark, setNote,
    getAllPageData, setPendingJump, getPendingJump, clearPendingJump,
  };
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/storage.test.js` — Expected: PASS（10 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.js test/storage.test.js
git commit -m "feat: add getAllPageData and pending-jump storage helpers"
```

---

## Task 4: icons globe + list

**Files:** Modify `src/lib/icons.js`, `test/icons.test.js`

- [ ] **Step 1: 在 `src/lib/icons.js` 的 `data` 对象里，把 `square-pen` 那行后面追加两行**（即把 square-pen 行末到 `};` 之间插入）：

```js
    'square-pen': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    'list': '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  };
```

- [ ] **Step 2: 在 `test/icons.test.js` 的 id 数组里加入 `'globe', 'list'`**，即把：

```js
  const ids = ['bookmark', 'plus', 'play', 'rotate-cw', 'bookmark-plus',
               'chevron-down', 'trash-2', 'square-pen'];
```

替换为：

```js
  const ids = ['bookmark', 'plus', 'play', 'rotate-cw', 'bookmark-plus',
               'chevron-down', 'trash-2', 'square-pen', 'globe', 'list'];
```

- [ ] **Step 3: 运行确认通过** — Run: `node --test test/icons.test.js` — Expected: PASS（2 tests）

- [ ] **Step 4: Commit**

```bash
git add src/lib/icons.js test/icons.test.js
git commit -m "feat: add globe and list icons"
```

---

## Task 5: manifest content_scripts 增载依赖

**Files:** Modify `manifest.json`

- [ ] **Step 1: 把 content_scripts 的 js 行：**

```json
      "js": ["src/lib/positioning.js", "src/content.js"],
```

替换为：

```json
      "js": ["src/lib/positioning.js", "src/lib/marks.js", "src/lib/browser.js", "src/lib/storage.js", "src/content.js"],
```

- [ ] **Step 2: 校验 JSON** — Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json')); console.log('ok')"` — Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "chore: load marks/browser/storage into content script"
```

---

## Task 6: content.js 消费待跳转

**Files:** Modify `src/content.js`

> 目标页加载后，若 storage 有匹配本页且未过期的待跳转记录，等高度稳定后定位。

- [ ] **Step 1: 用以下完整内容替换 `src/content.js`**

```js
(function () {
  'use strict';
  // 防止重复注入（声明式 + 按需注入）导致重复注册监听。
  if (window.__READON_CONTENT_LOADED__) return;
  window.__READON_CONTENT_LOADED__ = true;
  const P = window.ReadOn.positioning;
  const M = window.ReadOn.marks;
  const S = window.ReadOn.storage;

  // 候选元素：含有可读文字的常见块级元素。
  const SELECTOR = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,td,pre,article,section,div';

  // 元素自身或祖先是否 fixed / sticky 定位（粘性头部、悬浮搜索框等）。
  function isPinned(el) {
    let node = el;
    for (let i = 0; node && node !== document.body && i < 8; i++) {
      const pos = getComputedStyle(node).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
      node = node.parentElement;
    }
    return false;
  }

  function getTopAnchorText() {
    const els = document.body.querySelectorAll(SELECTOR);
    let best = null;
    let bestTop = Infinity;
    for (const el of els) {
      const txt = (el.textContent || '').trim();
      if (txt.length < 10) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) continue;
      if (rect.top >= -5 && rect.top < bestTop) {
        if (isPinned(el)) continue;
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

  function findAnchorOffsets(anchorText) {
    if (!anchorText) return [];
    const els = document.body.querySelectorAll(SELECTOR);
    const offsets = [];
    for (const el of els) {
      const txt = (el.textContent || '').trim();
      if (txt.includes(anchorText) && !isPinned(el)) {
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
    const target = P.refineTargetWithAnchors(ratioTarget, offsets, viewportHeight);
    const maxScroll = Math.max(0, contentHeight - viewportHeight);
    window.scrollTo({ top: Math.min(Math.max(target, 0), maxScroll), behavior: 'smooth' });
  }

  // 跨页面跳转：等内容高度稳定（连续 2 次不变或 ~3s 超时）后再回调。
  function waitForStableHeight(cb) {
    let last = -1, stable = 0, tries = 0;
    const iv = setInterval(function () {
      const h = document.documentElement.scrollHeight;
      if (h === last) stable++; else { stable = 0; last = h; }
      tries++;
      if (stable >= 2 || tries > 20) { clearInterval(iv); cb(); }
    }, 150);
  }

  async function consumePendingJump() {
    let rec;
    try { rec = await S.getPendingJump(); } catch (e) { return; }
    if (!rec) return;
    if (rec.pageKey !== M.pageKeyFromURL(location.href)) return;
    await S.clearPendingJump();
    if (Date.now() - rec.ts > 30000) return;
    waitForStableHeight(function () { scrollToMark(rec.mark); });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'READON_PING') {
      sendResponse({ ok: true });
      return true;
    }
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

  consumePendingJump();
})();
```

- [ ] **Step 2: 语法自检** — Run: `node -e "const fs=require('fs');new Function(fs.readFileSync('src/content.js','utf8'));console.log('syntax ok')"` — Expected: `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add src/content.js
git commit -m "feat: content script consumes pending cross-page jump on load"
```

---

## Task 7: popup.html 头部切换

**Files:** Modify `src/popup.html`

- [ ] **Step 1: 用以下完整内容替换 `src/popup.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="theme.css">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <header>
    <div class="brand">
      <span id="brand-icon" class="brand-icon"></span>
      <span class="title">ReadOn</span>
    </div>
    <div class="header-actions">
      <button id="mark-btn"><span id="mark-icon" class="mark-icon"></span>Mark</button>
      <button id="all-btn"><span id="all-icon" class="all-icon"></span>All marks</button>
    </div>
  </header>
  <div id="restricted" class="hidden">This page can't be marked.</div>
  <ul id="mark-list"></ul>
  <div id="empty" class="hidden">
    <span id="empty-icon" class="empty-icon"></span>
    <p>Mark a spot to pick up where you left off.</p>
  </div>
  <div id="toast" class="toast hidden"></div>

  <script src="lib/positioning.js"></script>
  <script src="lib/marks.js"></script>
  <script src="lib/browser.js"></script>
  <script src="lib/storage.js"></script>
  <script src="lib/time.js"></script>
  <script src="lib/icons.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/popup.html
git commit -m "feat: header with Mark + All marks toggle"
```

---

## Task 8: popup.css All Marks 样式

**Files:** Modify `src/popup.css`

- [ ] **Step 1: 在 `src/popup.css` 末尾追加：**

```css
.header-actions { display: flex; align-items: center; gap: 7px; }

#all-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  padding: 6px 10px;
  cursor: pointer;
}
.all-icon { display: inline-flex; }
#all-btn:hover { background: var(--row-hover); }
#all-btn.active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.group-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 14px 6px 6px;
}
.group-head:first-child { padding-top: 4px; }
.group-head svg { color: var(--text-muted); flex-shrink: 0; }
.group-meta { min-width: 0; }
.group-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.group-url {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-preview {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
  min-width: 0;
}
.note-preview svg { flex-shrink: 0; }
.note-preview span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 2: 校验括号配平** — Run: `node -e "const c=require('fs').readFileSync('src/popup.css','utf8'); if((c.match(/{/g)||[]).length!==(c.match(/}/g)||[]).length) throw new Error('brace'); console.log('css ok')"` — Expected: `css ok`

- [ ] **Step 3: Commit**

```bash
git add src/popup.css
git commit -m "feat: All Marks styles (toggle, group head, note preview)"
```

---

## Task 9: popup.js 视图切换 + All Marks + 跨页面跳转

**Files:** Modify `src/popup.js`

- [ ] **Step 1: 用以下完整内容替换 `src/popup.js`**

```js
(function () {
  'use strict';
  const { browser, storage, marks, positioning, time, icons } = window.ReadOn;

  let currentPageKey = null;
  let currentTabId = null;
  let pageMarkable = false;
  let view = 'page';
  const expandedIds = new Set();

  const UNREACHABLE_MSG = "Can't reach this page. Reload it and try again.";

  function showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 1500);
  }

  function showRowToast(markId, text) {
    const row = document.querySelector('.mark-row[data-mark-id="' + markId + '"]');
    if (!row) return;
    const t = document.createElement('div');
    t.className = 'row-toast';
    t.textContent = text;
    row.appendChild(t);
    setTimeout(function () { t.remove(); }, 1500);
  }

  async function capture() {
    await browser.ensureContentScript(currentTabId);
    return browser.sendMessageToTab(currentTabId, { type: 'READON_CAPTURE' });
  }

  function makeIconButton(iconId, className, label) {
    const btn = document.createElement('button');
    btn.className = 'icon-btn ' + className;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.appendChild(icons.el(iconId, 16));
    return btn;
  }

  // 同页面直接滚动；跨页面写待跳转记录并导航当前标签页。
  async function jumpTo(mark) {
    if (pageMarkable && mark.pageKey === currentPageKey) {
      try {
        await browser.ensureContentScript(currentTabId);
        await browser.sendMessageToTab(currentTabId, { type: 'READON_SCROLL_TO', mark: mark });
        window.close();
      } catch (e) {
        showToast(UNREACHABLE_MSG);
      }
    } else {
      await storage.setPendingJump(mark.pageKey, mark);
      await browser.navigateTab(currentTabId, mark.pageURL);
      window.close();
    }
  }

  function buildDetail(mark) {
    const detail = document.createElement('div');
    detail.className = 'row-detail';

    const noteWrap = document.createElement('div');
    noteWrap.className = 'note-wrap';
    const note = document.createElement('textarea');
    note.className = 'note-input';
    note.placeholder = 'Add a note…';
    note.value = mark.note || '';
    note.addEventListener('blur', async function () {
      const value = note.value;
      if (value === (mark.note || '')) return;
      mark.note = value;
      await storage.setNote(currentPageKey, mark.id, value);
    });
    noteWrap.appendChild(note);
    detail.appendChild(noteWrap);

    const del = document.createElement('div');
    del.className = 'row-delete';

    async function doDelete() {
      await storage.deleteMark(currentPageKey, mark.id);
      expandedIds.delete(mark.id);
      await render();
    }

    function renderDeleteDefault() {
      del.innerHTML = '';
      const btn = makeIconButton('trash-2', 'delete', 'Delete this mark');
      btn.onclick = function () {
        if (mark.note && mark.note.trim()) renderDeleteConfirm();
        else doDelete();
      };
      del.appendChild(btn);
    }

    function renderDeleteConfirm() {
      del.innerHTML = '';
      const q = document.createElement('span');
      q.className = 'delete-q';
      q.textContent = 'Delete this mark?';
      const cancel = document.createElement('button');
      cancel.className = 'ghost-btn';
      cancel.textContent = 'Cancel';
      cancel.onclick = renderDeleteDefault;
      const confirm = document.createElement('button');
      confirm.className = 'danger-btn solid';
      confirm.textContent = 'Delete';
      confirm.onclick = doDelete;
      del.appendChild(q);
      del.appendChild(cancel);
      del.appendChild(confirm);
    }

    renderDeleteDefault();
    detail.appendChild(del);

    return detail;
  }

  function barEl(mark) {
    const pctValue = positioning.displayPercent(
      mark.scrollPosition, mark.viewportHeight, mark.contentHeight);
    const barRow = document.createElement('div');
    barRow.className = 'bar-row';
    const track = document.createElement('div');
    track.className = 'track';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = pctValue + '%';
    track.appendChild(fill);
    const pct = document.createElement('span');
    pct.className = 'pct';
    pct.textContent = pctValue + '%';
    barRow.appendChild(track);
    barRow.appendChild(pct);
    return barRow;
  }

  function renderRow(mark, editing) {
    const li = document.createElement('li');
    li.className = 'mark-row';
    li.dataset.markId = mark.id;
    const expanded = expandedIds.has(mark.id);
    if (expanded) li.classList.add('expanded');

    const main = document.createElement('div');
    main.className = 'row-main';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const top = document.createElement('div');
    top.className = 'row-top';

    const timeEl = document.createElement('span');
    timeEl.className = 'time';
    timeEl.textContent = time.formatRelativeTime(mark.updatedAt, Date.now());

    if (editing) {
      const input = document.createElement('input');
      input.className = 'name-input';
      input.value = mark.name;

      let committed = false;
      async function commit() {
        if (committed) return;
        committed = true;
        document.removeEventListener('mousedown', onOutside, true);
        const name = input.value.trim() || mark.name;
        mark.name = name;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = name;
        if (input.parentNode) top.replaceChild(nameSpan, input);
        await storage.setMarkName(currentPageKey, mark.id, name);
      }
      function onOutside(e) { if (e.target !== input) commit(); }

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === 'Escape') commit();
      });
      input.addEventListener('blur', commit);
      document.addEventListener('mousedown', onOutside, true);

      top.appendChild(input);
      top.appendChild(timeEl);
      setTimeout(function () { input.focus(); input.select(); }, 0);
    } else {
      const nameWrap = document.createElement('span');
      nameWrap.className = 'name-wrap';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'name';
      nameSpan.textContent = mark.name;
      nameWrap.appendChild(nameSpan);
      if (!expanded && mark.note) {
        const flag = document.createElement('span');
        flag.className = 'name-note-flag';
        flag.title = 'Has note';
        flag.appendChild(icons.el('square-pen', 12));
        nameWrap.appendChild(flag);
      }
      top.appendChild(nameWrap);
      top.appendChild(timeEl);
    }
    meta.appendChild(top);
    meta.appendChild(barEl(mark));
    main.appendChild(meta);

    const jump = makeIconButton('play', 'jump', 'Jump to this mark');
    jump.onclick = function () { jumpTo(mark); };
    main.appendChild(jump);

    const upd = makeIconButton('rotate-cw', 'update', "Update this mark's position");
    upd.onclick = async function () {
      try {
        const snap = await capture();
        await storage.updateMarkPosition(currentPageKey, mark.id, snap, Date.now());
        await render();
        showRowToast(mark.id, 'Position updated');
      } catch (e) {
        showToast(UNREACHABLE_MSG);
      }
    };
    main.appendChild(upd);

    const exp = makeIconButton('chevron-down', 'expand', expanded ? 'Collapse' : 'Expand');
    exp.onclick = async function () {
      if (expandedIds.has(mark.id)) expandedIds.delete(mark.id);
      else expandedIds.add(mark.id);
      await render();
    };
    main.appendChild(exp);

    li.appendChild(main);
    if (expanded) li.appendChild(buildDetail(mark));

    return li;
  }

  function groupHeadEl(g) {
    const li = document.createElement('li');
    li.className = 'group-head';
    li.appendChild(icons.el('globe', 14));
    const box = document.createElement('div');
    box.className = 'group-meta';
    const t = document.createElement('div');
    t.className = 'group-title';
    t.textContent = g.pageTitle || g.pageKey;
    const u = document.createElement('div');
    u.className = 'group-url';
    u.textContent = g.pageKey;
    box.appendChild(t);
    box.appendChild(u);
    li.appendChild(box);
    return li;
  }

  function allMarkRow(mark) {
    const li = document.createElement('li');
    li.className = 'mark-row';
    li.dataset.markId = mark.id;

    const main = document.createElement('div');
    main.className = 'row-main';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const top = document.createElement('div');
    top.className = 'row-top';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = mark.name;
    const timeEl = document.createElement('span');
    timeEl.className = 'time';
    timeEl.textContent = time.formatRelativeTime(mark.updatedAt, Date.now());
    top.appendChild(nameSpan);
    top.appendChild(timeEl);
    meta.appendChild(top);
    meta.appendChild(barEl(mark));

    if (mark.note && mark.note.trim()) {
      const prev = document.createElement('div');
      prev.className = 'note-preview';
      prev.appendChild(icons.el('square-pen', 12));
      const txt = document.createElement('span');
      txt.textContent = mark.note.split('\n')[0];
      prev.appendChild(txt);
      meta.appendChild(prev);
    }

    main.appendChild(meta);

    const jump = makeIconButton('play', 'jump', 'Jump to this mark');
    jump.onclick = function () { jumpTo(mark); };
    main.appendChild(jump);

    li.appendChild(main);
    return li;
  }

  async function renderPage(list, empty, editId) {
    const pageData = await storage.getPageData(currentPageKey);
    list.innerHTML = '';
    empty.classList.toggle('hidden', pageData.marks.length > 0);
    for (const mark of pageData.marks) {
      list.appendChild(renderRow(mark, mark.id === editId));
    }
  }

  async function renderAll(list, empty) {
    const allData = await storage.getAllPageData();
    const groups = marks.groupMarksByPage(allData);
    list.innerHTML = '';
    empty.classList.toggle('hidden', groups.length > 0);
    for (const g of groups) {
      list.appendChild(groupHeadEl(g));
      for (const mark of g.marks) list.appendChild(allMarkRow(mark));
    }
  }

  function updateToggleUI() {
    document.getElementById('all-btn').classList.toggle('active', view === 'all');
  }

  async function render(editId) {
    updateToggleUI();
    const list = document.getElementById('mark-list');
    const empty = document.getElementById('empty');
    const restricted = document.getElementById('restricted');
    if (view === 'all') {
      restricted.classList.add('hidden');
      await renderAll(list, empty);
    } else if (!pageMarkable) {
      list.innerHTML = '';
      empty.classList.add('hidden');
      restricted.classList.remove('hidden');
    } else {
      restricted.classList.add('hidden');
      await renderPage(list, empty, editId);
    }
  }

  async function onMark() {
    let snap;
    try {
      snap = await capture();
    } catch (e) {
      showToast(UNREACHABLE_MSG);
      return;
    }
    const mark = await storage.saveMark(currentPageKey, {
      snapshot: snap, id: crypto.randomUUID(), now: Date.now(),
    });
    view = 'page';
    await render(mark.id);
  }

  function mountStaticIcons() {
    document.getElementById('brand-icon').appendChild(icons.el('bookmark', 17));
    document.getElementById('mark-icon').appendChild(icons.el('plus', 14));
    document.getElementById('all-icon').appendChild(icons.el('list', 14));
    document.getElementById('empty-icon').appendChild(icons.el('bookmark-plus', 28));
  }

  async function init() {
    mountStaticIcons();
    document.getElementById('all-btn').onclick = function () {
      view = (view === 'all') ? 'page' : 'all';
      render();
    };
    const tab = await browser.getActiveTab();
    currentTabId = tab ? tab.id : null;
    if (tab && /^https?:/.test(tab.url || '')) {
      pageMarkable = true;
      currentPageKey = marks.pageKeyFromURL(tab.url);
      document.getElementById('mark-btn').onclick = onMark;
    } else {
      pageMarkable = false;
      document.getElementById('mark-btn').disabled = true;
    }
    await render();
  }

  init();
})();
```

- [ ] **Step 2: 语法自检** — Run: `node -e "const fs=require('fs');new Function(fs.readFileSync('src/popup.js','utf8'));console.log('syntax ok')"` — Expected: `syntax ok`

- [ ] **Step 3: 全量回归** — Run: `node --test` — Expected: PASS（positioning 13 + marks 9 + storage 10 + browser 2 + time 10 + icons 2 = 46 tests）

- [ ] **Step 4: Commit**

```bash
git add src/popup.js
git commit -m "feat: All Marks view with grouping and cross-page jump"
```

---

## Task 10: 手动验收

**Files:** 无（手动 + 收尾）

- [ ] **Step 1: 重新加载扩展** — `chrome://extensions` → ReadOn ⟳。

- [ ] **Step 2: 准备数据** — 在 2~3 个不同页面各建 1~2 个 mark（其中一页建 2 个、给其中一个写笔记）。

- [ ] **Step 3: 切换** — 点头部 `All marks`：切到全部视图、按钮高亮;再点回本页（按钮恢复）。`+ Mark` 始终可见。

- [ ] **Step 4: 分组/多 mark/笔记预览** — All marks 下：按页面分组（地球图标 + 标题 + 网址）；一页 2 个 mark 显示 2 行；有笔记的行显示灰色笔记预览（✎ + 首行）。组按最近活动倒序。

- [ ] **Step 5: 跨页面跳转** — 在 All marks 里点另一个页面的 mark 的 ▶：当前标签页导航到该页并（加载稳定后）滚到该位置。

- [ ] **Step 6: 同页跳转** — All marks 里点当前页的 mark 的 ▶：直接滚动（不导航）。

- [ ] **Step 7: 懒加载页** — 在内容异步加载的长页跨页跳转，验证等高度稳定后定位仍准。

- [ ] **Step 8: 受限页** — 在 `chrome://` 页打开弹窗：本页视图显示置灰提示，但仍可点 `All marks` 浏览并跨页跳转到正常页面。

- [ ] **Step 9: 浅/深双主题** — 切换系统主题，头部 toggle、组头、笔记预览均正常。

- [ ] **Step 10: 本页功能回归** — 本页视图建/改名/▶/⟳/展开-笔记-删除 全部照旧。

- [ ] **Step 11: 收尾** — 不符按 superpowers:systematic-debugging 处理；全过后 `git commit -m "docs: all-marks manual acceptance passed" --allow-empty`。

---

## 自检对照（计划 vs spec）

- 头部切换 `[+ Mark] [All marks]`、默认本页、toggle 高亮（spec §2）→ Task 7、Task 8、Task 9（init/updateToggleUI）。✓
- All Marks 分组 + 组头 + 只读行 + 笔记预览 + 仅 ▶（spec §3）→ Task 9（renderAll/groupHeadEl/allMarkRow）+ Task 8 样式。✓
- 排序（组间最近活动倒序、组内 createdAt 升序）（spec §3/§5）→ Task 1 `groupMarksByPage`。✓
- 跨页面跳转：同页直接滚 / 跨页写待跳转 + 导航 + content 消费 + 等高度稳定（spec §4）→ Task 9 `jumpTo` + Task 3 待跳转 + Task 6 `consumePendingJump`。✓
- 纯函数/存储可测（spec §7）→ Task 1、Task 3 单测；Task 9 全量回归 46。✓
- chrome.* 收敛 browser.js（新增 storageRemove/navigateTab）（spec §5）→ Task 2。✓
- content_scripts 增载 marks/browser/storage（spec §6）→ Task 5。✓
- 数据模型不变（spec §5）→ 无 schema 改动。✓
- YAGNI：无 SW、无 favicon、无 options 入口（spec §8）→ 计划未引入。✓
