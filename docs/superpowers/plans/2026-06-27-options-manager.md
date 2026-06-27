# ReadOn options 全屏管理页 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增全屏管理页（域名›页面›marks 层级、搜索、批量删除、查看/编辑笔记、打开）+ 导入/导出 JSON。

**Architecture:** 复用 theme.css/icons.js/storage/marks/time/positioning 与跨页面跳转机制。新增纯函数（分层/合并/导出，单测）+ storage 批量删除/导入写入；新文件 options.html/css/js（独立入口，组件 CSS 自包含以隔离 popup）；manifest 加 options_ui。

**Tech Stack:** 原生 JS + MV3，无构建；UMD；`node:test`。

> 设计依据：`docs/superpowers/specs/2026-06-27-options-manager.md`。基线：master `91a7f82`（46 单测）。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/lib/marks.js` | 改 | `domainOf`、`groupMarksByDomain`、`normalizeImport`、`mergeImport`、`buildExport` |
| `test/marks.test.js` | 改 | 上述测试 |
| `src/lib/storage.js` | 改 | `deleteMarks`、`importMerge` |
| `test/storage.test.js` | 改 | 上述测试 |
| `src/lib/browser.js` | 改 | `openOptionsPage` |
| `src/lib/icons.js` | 改 | `search`、`download`、`upload` |
| `test/icons.test.js` | 改 | 断言新图标 |
| `manifest.json` | 改 | `options_ui` |
| `src/options.html` | 建 | 管理页结构 |
| `src/options.css` | 建 | 管理页样式（含自包含组件） |
| `src/options.js` | 建 | 渲染/搜索/批量/笔记/导入导出 |
| `src/popup.js` | 改 | All Marks 底部"Open full manager"链接 |
| `src/popup.css` | 改 | 该链接样式 |

---

## Task 1: marks.domainOf + groupMarksByDomain（TDD）

**Files:** Modify `src/lib/marks.js`, `test/marks.test.js`

- [ ] **Step 1: 在 `test/marks.test.js` 末尾追加：**

```js
test('domainOf 取 hostname', () => {
  assert.strictEqual(M.domainOf('x.com/a/b'), 'x.com');
  assert.strictEqual(M.domainOf('x.com'), 'x.com');
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
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/marks.test.js` — Expected: FAIL（`domainOf is not a function`）

- [ ] **Step 3: 在 `src/lib/marks.js` 中把结尾 return 块替换**（在其前插入两个函数）：

把
```js
  return {
    pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark, groupMarksByPage,
  };
```
替换为
```js
  function domainOf(pageKey) {
    const i = pageKey.indexOf('/');
    return i === -1 ? pageKey : pageKey.slice(0, i);
  }

  function groupMarksByDomain(allData) {
    const pageGroups = groupMarksByPage(allData);
    const byDomain = {};
    const order = [];
    for (const g of pageGroups) {
      const d = domainOf(g.pageKey);
      if (!byDomain[d]) { byDomain[d] = { domain: d, markCount: 0, lastActivity: 0, pages: [] }; order.push(d); }
      const entry = byDomain[d];
      entry.pages.push(g);
      entry.markCount += g.marks.length;
      if (g.lastActivity > entry.lastActivity) entry.lastActivity = g.lastActivity;
    }
    const domains = order.map(function (d) { return byDomain[d]; });
    for (const e of domains) e.pages.sort(function (a, b) { return b.lastActivity - a.lastActivity; });
    domains.sort(function (a, b) { return b.lastActivity - a.lastActivity; });
    return domains;
  }

  return {
    pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark, groupMarksByPage,
    domainOf, groupMarksByDomain,
  };
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/marks.test.js` — Expected: PASS（11 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/marks.js test/marks.test.js
git commit -m "feat: add domainOf and groupMarksByDomain"
```

---

## Task 2: marks.normalizeImport + mergeImport + buildExport（TDD）

**Files:** Modify `src/lib/marks.js`, `test/marks.test.js`

- [ ] **Step 1: 在 `test/marks.test.js` 末尾追加：**

```js
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
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/marks.test.js` — Expected: FAIL（`normalizeImport is not a function`）

- [ ] **Step 3: 在 `src/lib/marks.js` 中把 Task 1 写好的 return 块再次替换**（在其前插入这些函数）：

把
```js
  return {
    pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark, groupMarksByPage,
    domainOf, groupMarksByDomain,
  };
```
替换为
```js
  function isPageData(v) {
    return v && Array.isArray(v.marks) && typeof v.pageKey === 'string';
  }

  function onlyPages(obj) {
    const out = {};
    for (const k in obj) if (isPageData(obj[k])) out[k] = obj[k];
    return out;
  }

  function normalizeImport(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    const src = (parsed.pages && typeof parsed.pages === 'object') ? parsed.pages : parsed;
    const pages = onlyPages(src);
    return Object.keys(pages).length ? pages : null;
  }

  function mergeImport(existingAll, importedPages) {
    const out = {};
    const existingPages = onlyPages(existingAll);
    for (const k in existingPages) {
      out[k] = { pageKey: existingPages[k].pageKey, nextSeq: existingPages[k].nextSeq, marks: existingPages[k].marks.slice() };
    }
    for (const k in importedPages) {
      const imp = importedPages[k];
      if (!isPageData(imp)) continue;
      const cur = out[k] || { pageKey: imp.pageKey, nextSeq: 1, marks: [] };
      const ids = {};
      for (const m of cur.marks) ids[m.id] = true;
      for (const m of imp.marks) if (!ids[m.id]) { cur.marks.push(m); ids[m.id] = true; }
      cur.nextSeq = Math.max(cur.nextSeq || 1, imp.nextSeq || 1);
      out[k] = cur;
    }
    return out;
  }

  function buildExport(allData, now) {
    return { version: 1, exportedAt: now, pages: onlyPages(allData) };
  }

  return {
    pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark, groupMarksByPage,
    domainOf, groupMarksByDomain, normalizeImport, mergeImport, buildExport,
  };
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/marks.test.js` — Expected: PASS（14 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/marks.js test/marks.test.js
git commit -m "feat: add import normalize/merge and export builder"
```

---

## Task 3: storage.deleteMarks + importMerge（TDD）

**Files:** Modify `src/lib/storage.js`, `test/storage.test.js`

- [ ] **Step 1: 在 `test/storage.test.js` 末尾追加：**

```js
test('deleteMarks 跨页批量删除，nextSeq 不变', async () => {
  const store = installFakeChrome();
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'a1', now: 1 });
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'a2', now: 2 });
  await storage.saveMark('y.com/b', { snapshot: snap, id: 'b1', now: 3 });
  await storage.deleteMarks([{ pageKey: 'x.com/a', id: 'a1' }, { pageKey: 'y.com/b', id: 'b1' }]);
  assert.deepStrictEqual(store['x.com/a'].marks.map(function (m) { return m.id; }), ['a2']);
  assert.strictEqual(store['x.com/a'].nextSeq, 3);
  assert.strictEqual(store['y.com/b'].marks.length, 0);
});

test('importMerge 合并写回并返回新增数', async () => {
  const store = installFakeChrome();
  await storage.saveMark('x.com/a', { snapshot: snap, id: 'a', now: 1 });
  const a = store['x.com/a'].marks[0];
  const imported = {
    'x.com/a': { pageKey: 'x.com/a', nextSeq: 1, marks: [ a, Object.assign({}, a, { id: 'b' }) ] },
    'y.com/c': { pageKey: 'y.com/c', nextSeq: 1, marks: [ Object.assign({}, a, { id: 'c', pageKey: 'y.com/c' }) ] },
  };
  const added = await storage.importMerge(imported);
  assert.strictEqual(added, 2);
  assert.deepStrictEqual(store['x.com/a'].marks.map(function (m) { return m.id; }), ['a', 'b']);
  assert.ok(store['y.com/c']);
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/storage.test.js` — Expected: FAIL（`deleteMarks is not a function`）

- [ ] **Step 3: 在 `src/lib/storage.js` 中把结尾 return 块替换**（在其前插入函数）：

把
```js
  return {
    getPageData, saveMark, updateMarkPosition, setMarkName, deleteMark, setNote,
    getAllPageData, setPendingJump, getPendingJump, clearPendingJump,
  };
```
替换为
```js
  async function deleteMarks(refs) {
    const byPage = {};
    for (const r of refs) { (byPage[r.pageKey] = byPage[r.pageKey] || []).push(r.id); }
    for (const pageKey in byPage) {
      const pageData = await getPageData(pageKey);
      const idset = {};
      for (const id of byPage[pageKey]) idset[id] = true;
      const kept = pageData.marks.filter(function (m) { return !idset[m.id]; });
      await browser.storageSet({ [pageKey]: Object.assign({}, pageData, { marks: kept }) });
    }
  }

  function countMarks(all) {
    let n = 0;
    for (const k in all) { const pd = all[k]; if (pd && Array.isArray(pd.marks)) n += pd.marks.length; }
    return n;
  }

  async function importMerge(importedPages) {
    const existing = await getAllPageData();
    const before = countMarks(existing);
    const merged = marks.mergeImport(existing, importedPages);
    await browser.storageSet(merged);
    return countMarks(merged) - before;
  }

  return {
    getPageData, saveMark, updateMarkPosition, setMarkName, deleteMark, setNote,
    getAllPageData, setPendingJump, getPendingJump, clearPendingJump,
    deleteMarks, importMerge,
  };
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/storage.test.js` — Expected: PASS（12 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.js test/storage.test.js
git commit -m "feat: add storage.deleteMarks and importMerge"
```

---

## Task 4: browser.openOptionsPage

**Files:** Modify `src/lib/browser.js`

- [ ] **Step 1: 把 `src/lib/browser.js` 结尾 return 块替换**（在其前插入函数）：

把
```js
  return {
    storageGet, storageSet, getActiveTab, sendMessageToTab, ensureContentScript,
    storageRemove, navigateTab, openTab,
  };
```
替换为
```js
  async function openOptionsPage() {
    return chrome.runtime.openOptionsPage();
  }

  return {
    storageGet, storageSet, getActiveTab, sendMessageToTab, ensureContentScript,
    storageRemove, navigateTab, openTab, openOptionsPage,
  };
```

- [ ] **Step 2: 语法自检** — Run: `node -e "require('./src/lib/browser.js'); console.log('ok')"` — Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/lib/browser.js
git commit -m "feat: add browser.openOptionsPage"
```

---

## Task 5: icons search + download + upload

**Files:** Modify `src/lib/icons.js`, `test/icons.test.js`

- [ ] **Step 1: 在 `src/lib/icons.js` 的 `data` 对象 `list` 那行后追加三行**（在 `};` 之前）：

```js
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
```

- [ ] **Step 2: 在 `test/icons.test.js` 的 ids 数组末尾补上 `'search', 'download', 'upload'`**，即把：

```js
  const ids = ['bookmark', 'plus', 'play', 'rotate-cw', 'bookmark-plus',
               'chevron-down', 'trash-2', 'square-pen', 'globe', 'list'];
```
替换为
```js
  const ids = ['bookmark', 'plus', 'play', 'rotate-cw', 'bookmark-plus',
               'chevron-down', 'trash-2', 'square-pen', 'globe', 'list',
               'search', 'download', 'upload'];
```

- [ ] **Step 3: 运行确认通过** — Run: `node --test test/icons.test.js` — Expected: PASS（2 tests）

- [ ] **Step 4: Commit**

```bash
git add src/lib/icons.js test/icons.test.js
git commit -m "feat: add search, download, upload icons"
```

---

## Task 6: manifest options_ui

**Files:** Modify `manifest.json`

- [ ] **Step 1: 在 `manifest.json` 的 `"action": { ... },` 块之后、`"content_scripts"` 之前插入：**

```json
  "options_ui": {
    "page": "src/options.html",
    "open_in_tab": true
  },
```

- [ ] **Step 2: 校验 JSON** — Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json')); console.log('ok')"` — Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "chore: register options_ui full-page manager"
```

---

## Task 7: options.html

**Files:** Create `src/options.html`

- [ ] **Step 1: 创建 `src/options.html`，内容：**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="theme.css">
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <main class="wrap">
    <header class="opt-header">
      <div class="brand"><span id="brand-icon" class="brand-icon"></span><span class="opt-title">ReadOn · Manage</span></div>
      <div class="opt-actions">
        <button id="import-btn" class="pill-btn"><span id="import-icon" class="i"></span>Import</button>
        <button id="export-btn" class="pill-btn"><span id="export-icon" class="i"></span>Export</button>
      </div>
    </header>
    <div class="search-box">
      <span id="search-icon" class="i"></span>
      <input id="search" type="text" placeholder="Search marks, notes, pages…">
    </div>
    <div id="batchbar" class="batchbar hidden"></div>
    <ul id="list"></ul>
    <div id="empty" class="hidden">
      <span id="empty-icon" class="empty-icon"></span>
      <p>No marks yet. Mark a spot while reading to see it here.</p>
    </div>
    <input id="file-input" type="file" accept=".json,application/json" class="hidden">
    <div id="toast" class="toast hidden"></div>
  </main>

  <script src="lib/positioning.js"></script>
  <script src="lib/marks.js"></script>
  <script src="lib/browser.js"></script>
  <script src="lib/storage.js"></script>
  <script src="lib/time.js"></script>
  <script src="lib/icons.js"></script>
  <script src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/options.html
git commit -m "feat: add options.html manager page shell"
```

---

## Task 8: options.css

**Files:** Create `src/options.css`

> 组件样式（mark 行/进度条/图标按钮/笔记/危险按钮等）在此自包含，与 popup.css 隔离（无构建、独立入口；不动 popup 避免回归）。

- [ ] **Step 1: 创建 `src/options.css`，内容：**

```css
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font-sans); font-size: 13px; line-height: 1.4; }
.wrap { max-width: 680px; margin: 0 auto; padding: 24px 16px 64px; }
.i { display: inline-flex; }

.opt-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: 9px; }
.brand-icon { display: inline-flex; color: var(--accent); }
.opt-title { font-size: 18px; font-weight: 500; }
.opt-actions { display: flex; gap: 8px; }
.pill-btn { display: inline-flex; align-items: center; gap: 5px; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--text-secondary); background: none; border: 1px solid var(--border-strong); border-radius: 9px; padding: 7px 12px; cursor: pointer; }
.pill-btn:hover { background: var(--row-hover); }

.search-box { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; margin-top: 14px; }
.search-box .i { color: var(--text-muted); }
#search { flex: 1; border: none; background: none; outline: none; font-family: inherit; font-size: 13px; color: var(--text); }

.batchbar { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 8px 12px; background: var(--field); border: 1px solid var(--border); border-radius: 10px; }
.batch-count { font-size: 13px; font-weight: 500; flex: 1; }

ul#list { list-style: none; margin: 0; padding: 0; }

.domain-head { display: flex; align-items: center; gap: 9px; padding: 16px 2px 8px; border-bottom: 1px solid var(--border); }
.domain-head .i, .domain-head > svg { color: var(--text-secondary); flex-shrink: 0; }
.domain-name { font-size: 14px; font-weight: 500; }
.domain-count { font-size: 11px; color: var(--text-muted); }

.page-head { font-size: 12px; color: var(--text-secondary); padding: 12px 0 6px 26px; }
.page-path { color: var(--text-muted); }

.mark-row { margin: 0 0 6px 26px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; }
.mark-row:hover { border-color: var(--border-strong); }
.row-main { display: flex; align-items: center; gap: 10px; }
.row-check, .domain-check { width: 15px; height: 15px; flex-shrink: 0; accent-color: var(--accent); cursor: pointer; }

.meta { flex: 1; min-width: 0; }
.row-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.time { font-size: 11px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
.bar-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.track { flex: 1; height: 4px; background: var(--track); border-radius: var(--radius-pill); overflow: hidden; }
.fill { height: 100%; background: var(--accent); border-radius: var(--radius-pill); }
.pct { font-size: 11px; color: var(--text-muted); min-width: 26px; text-align: right; }
.note-preview { display: flex; align-items: center; gap: 5px; margin-top: 6px; font-size: 11px; color: var(--text-muted); min-width: 0; }
.note-preview svg { flex-shrink: 0; }
.note-preview span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.icon-btn { display: inline-flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px; }
.icon-btn:hover { background: var(--track); }
.icon-btn.jump { color: var(--accent); }
.icon-btn.delete { color: var(--danger); }
.icon-btn.expand { color: var(--text-muted); }
.mark-row.expanded .icon-btn.expand svg { transform: rotate(180deg); }

.row-detail { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
.note-wrap { background: var(--field); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.note-wrap:focus-within { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
.note-input { display: block; width: 100%; box-sizing: border-box; font-family: inherit; font-size: 12px; color: var(--text); background: transparent; border: none; padding: 7px 9px; resize: none; min-height: 64px; max-height: 200px; overflow: auto; }
.note-input:focus { outline: none; }

.danger-btn { display: inline-flex; align-items: center; font-family: inherit; font-size: 12px; border-radius: 7px; cursor: pointer; }
.danger-btn.solid { background: var(--danger); color: var(--danger-on); border: none; padding: 4px 12px; }
.ghost-btn { font-family: inherit; font-size: 12px; background: none; border: 1px solid var(--border-strong); color: var(--text-secondary); border-radius: 7px; padding: 4px 12px; cursor: pointer; }

#empty { text-align: center; padding: 48px 16px; }
.empty-icon { display: inline-flex; color: var(--text-muted); }
#empty p { margin: 8px 0 0; color: var(--text-secondary); }

.hidden { display: none; }

.toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); background: var(--accent); color: var(--accent-on); padding: 8px 16px; border-radius: var(--radius-button); font-size: 13px; }
```

- [ ] **Step 2: 校验括号配平** — Run: `node -e "const c=require('fs').readFileSync('src/options.css','utf8'); if((c.match(/{/g)||[]).length!==(c.match(/}/g)||[]).length) throw new Error('brace'); console.log('css ok')"` — Expected: `css ok`

- [ ] **Step 3: Commit**

```bash
git add src/options.css
git commit -m "feat: add options.css manager styles"
```

---

## Task 9: options.js

**Files:** Create `src/options.js`

- [ ] **Step 1: 创建 `src/options.js`，内容：**

```js
(function () {
  'use strict';
  const { browser, storage, marks, time, positioning, icons } = window.ReadOn;

  const expandedIds = new Set();
  const selectedIds = new Set();
  let query = '';
  let allData = {};

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 2000);
  }

  function iconBtn(iconId, cls, label) {
    const b = document.createElement('button');
    b.className = 'icon-btn ' + cls;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.appendChild(icons.el(iconId, 16));
    return b;
  }

  function filteredData() {
    if (!query.trim()) return allData;
    const q = query.trim().toLowerCase();
    const out = {};
    for (const key in allData) {
      const pd = allData[key];
      if (!pd || !Array.isArray(pd.marks)) continue;
      const kept = pd.marks.filter(function (m) {
        return (m.name || '').toLowerCase().includes(q)
          || (m.note || '').toLowerCase().includes(q)
          || (m.pageTitle || '').toLowerCase().includes(q)
          || key.toLowerCase().includes(q);
      });
      if (kept.length) out[key] = Object.assign({}, pd, { marks: kept });
    }
    return out;
  }

  function findMark(id) {
    for (const key in allData) {
      const pd = allData[key];
      if (!pd || !Array.isArray(pd.marks)) continue;
      for (const m of pd.marks) if (m.id === id) return m;
    }
    return null;
  }

  function domainMarkIds(group) {
    const ids = [];
    for (const p of group.pages) for (const m of p.marks) ids.push(m.id);
    return ids;
  }

  async function reload() {
    allData = await storage.getAllPageData();
    render();
  }

  // —— batch ——
  function renderBatchBar() {
    const bar = document.getElementById('batchbar');
    bar.innerHTML = '';
    if (selectedIds.size === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const label = document.createElement('span');
    label.className = 'batch-count';
    label.textContent = selectedIds.size + ' selected';
    const del = document.createElement('button');
    del.className = 'danger-btn solid';
    del.textContent = 'Delete';
    del.onclick = onBatchDelete;
    const clear = document.createElement('button');
    clear.className = 'ghost-btn';
    clear.textContent = 'Clear';
    clear.onclick = function () { selectedIds.clear(); render(); };
    bar.appendChild(label);
    bar.appendChild(del);
    bar.appendChild(clear);
  }

  async function onBatchDelete() {
    if (!window.confirm('Delete ' + selectedIds.size + ' marks?')) return;
    const refs = [];
    for (const id of selectedIds) {
      const m = findMark(id);
      if (m) refs.push({ pageKey: m.pageKey, id: id });
    }
    await storage.deleteMarks(refs);
    selectedIds.clear();
    await reload();
  }

  async function onSingleDelete(mark) {
    if (mark.note && mark.note.trim()) {
      if (!window.confirm('Delete this mark? Its note will be lost.')) return;
    }
    await storage.deleteMark(mark.pageKey, mark.id);
    selectedIds.delete(mark.id);
    expandedIds.delete(mark.id);
    await reload();
  }

  // —— rows ——
  function domainHead(group) {
    const li = document.createElement('li');
    li.className = 'domain-head';
    const ids = domainMarkIds(group);
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'domain-check';
    cb.checked = ids.length > 0 && ids.every(function (id) { return selectedIds.has(id); });
    cb.onchange = function () {
      for (const id of ids) { if (cb.checked) selectedIds.add(id); else selectedIds.delete(id); }
      render();
    };
    li.appendChild(cb);
    li.appendChild(icons.el('globe', 16));
    const name = document.createElement('span');
    name.className = 'domain-name';
    name.textContent = group.domain;
    const count = document.createElement('span');
    count.className = 'domain-count';
    count.textContent = group.markCount + (group.markCount === 1 ? ' mark' : ' marks');
    li.appendChild(name);
    li.appendChild(count);
    return li;
  }

  function pageHead(p) {
    const li = document.createElement('li');
    li.className = 'page-head';
    const t = document.createElement('span');
    t.className = 'page-title';
    t.textContent = p.pageTitle || '';
    const path = document.createElement('span');
    path.className = 'page-path';
    const slash = p.pageKey.indexOf('/');
    path.textContent = ' · ' + (slash === -1 ? '/' : p.pageKey.slice(slash));
    li.appendChild(t);
    li.appendChild(path);
    return li;
  }

  function markRow(mark) {
    const li = document.createElement('li');
    li.className = 'mark-row';
    li.dataset.markId = mark.id;
    const expanded = expandedIds.has(mark.id);
    if (expanded) li.classList.add('expanded');

    const main = document.createElement('div');
    main.className = 'row-main';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'row-check';
    cb.checked = selectedIds.has(mark.id);
    cb.onchange = function () {
      if (cb.checked) selectedIds.add(mark.id); else selectedIds.delete(mark.id);
      render();
    };
    main.appendChild(cb);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const top = document.createElement('div');
    top.className = 'row-top';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = mark.name;
    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = time.formatRelativeTime(mark.updatedAt, Date.now());
    top.appendChild(name);
    top.appendChild(t);
    meta.appendChild(top);

    const pctValue = positioning.displayPercent(mark.scrollPosition, mark.viewportHeight, mark.contentHeight);
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
    meta.appendChild(barRow);

    const hasNote = !!(mark.note && mark.note.trim());
    if (hasNote && !expanded) {
      const prev = document.createElement('div');
      prev.className = 'note-preview';
      prev.appendChild(icons.el('square-pen', 12));
      const span = document.createElement('span');
      span.textContent = mark.note.split('\n')[0];
      prev.appendChild(span);
      meta.appendChild(prev);
    }
    main.appendChild(meta);

    const jump = iconBtn('play', 'jump', 'Open in new tab');
    jump.onclick = async function () {
      await storage.setPendingJump(mark.pageKey, mark);
      await browser.openTab(mark.pageURL);
    };
    main.appendChild(jump);

    const del = iconBtn('trash-2', 'delete', 'Delete');
    del.onclick = function () { onSingleDelete(mark); };
    main.appendChild(del);

    if (hasNote) {
      const exp = iconBtn('chevron-down', 'expand', expanded ? 'Collapse' : 'Expand');
      exp.onclick = function () {
        if (expandedIds.has(mark.id)) expandedIds.delete(mark.id); else expandedIds.add(mark.id);
        render();
      };
      main.appendChild(exp);
    }

    li.appendChild(main);

    if (expanded) {
      const detail = document.createElement('div');
      detail.className = 'row-detail';
      const wrap = document.createElement('div');
      wrap.className = 'note-wrap';
      const ta = document.createElement('textarea');
      ta.className = 'note-input';
      ta.value = mark.note || '';
      ta.addEventListener('blur', async function () {
        if (ta.value === (mark.note || '')) return;
        mark.note = ta.value;
        await storage.setNote(mark.pageKey, mark.id, ta.value);
      });
      wrap.appendChild(ta);
      detail.appendChild(wrap);
      li.appendChild(detail);
    }

    return li;
  }

  function render() {
    renderBatchBar();
    const list = document.getElementById('list');
    const empty = document.getElementById('empty');
    list.innerHTML = '';
    const groups = marks.groupMarksByDomain(filteredData());
    empty.classList.toggle('hidden', groups.length > 0);
    for (const g of groups) {
      list.appendChild(domainHead(g));
      for (const p of g.pages) {
        list.appendChild(pageHead(p));
        for (const m of p.marks) list.appendChild(markRow(m));
      }
    }
  }

  // —— import / export ——
  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onExport() {
    const data = marks.buildExport(allData, Date.now());
    const d = new Date();
    const fn = 'readon-export-' + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '.json';
    download(fn, JSON.stringify(data, null, 2));
  }

  function onImportFile(file) {
    const reader = new FileReader();
    reader.onload = async function () {
      let parsed;
      try { parsed = JSON.parse(reader.result); }
      catch (e) { showToast('Import failed: invalid JSON'); return; }
      const pages = marks.normalizeImport(parsed);
      if (!pages) { showToast('Import failed: unrecognized format'); return; }
      const added = await storage.importMerge(pages);
      await reload();
      showToast('Imported ' + added + ' new mark' + (added === 1 ? '' : 's'));
    };
    reader.readAsText(file);
  }

  function mountStaticIcons() {
    document.getElementById('brand-icon').appendChild(icons.el('bookmark', 20));
    document.getElementById('import-icon').appendChild(icons.el('upload', 15));
    document.getElementById('export-icon').appendChild(icons.el('download', 15));
    document.getElementById('search-icon').appendChild(icons.el('search', 16));
    document.getElementById('empty-icon').appendChild(icons.el('bookmark-plus', 28));
  }

  function init() {
    mountStaticIcons();
    document.getElementById('search').addEventListener('input', function (e) {
      query = e.target.value;
      render();
    });
    document.getElementById('export-btn').onclick = onExport;
    const fileInput = document.getElementById('file-input');
    document.getElementById('import-btn').onclick = function () { fileInput.click(); };
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) onImportFile(fileInput.files[0]);
      fileInput.value = '';
    });
    reload();
  }

  init();
})();
```

- [ ] **Step 2: 语法自检** — Run: `node -e "const fs=require('fs');new Function(fs.readFileSync('src/options.js','utf8'));console.log('syntax ok')"` — Expected: `syntax ok`

- [ ] **Step 3: 全量回归** — Run: `node --test` — Expected: PASS（positioning 13 + marks 14 + storage 12 + browser 2 + time 10 + icons 2 = 53 tests）

- [ ] **Step 4: Commit**

```bash
git add src/options.js
git commit -m "feat: options.js manager (hierarchy, search, batch, notes, import/export)"
```

---

## Task 10: popup All Marks → "Open full manager" 链接

**Files:** Modify `src/popup.js`, `src/popup.css`

- [ ] **Step 1: 在 `src/popup.js` 的 `renderAll` 函数里，把结尾的 for 循环之后补上 footer 链接。** 即把：

```js
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
```
替换为
```js
  async function renderAll(list, empty) {
    const allData = await storage.getAllPageData();
    const groups = marks.groupMarksByPage(allData);
    list.innerHTML = '';
    empty.classList.toggle('hidden', groups.length > 0);
    for (const g of groups) {
      list.appendChild(groupHeadEl(g));
      for (const mark of g.marks) list.appendChild(allMarkRow(mark));
    }
    const footer = document.createElement('li');
    footer.className = 'manager-link';
    const mgr = document.createElement('button');
    mgr.className = 'link-btn';
    mgr.appendChild(icons.el('list', 14));
    mgr.appendChild(document.createTextNode('Open full manager'));
    mgr.onclick = function () { browser.openOptionsPage(); };
    footer.appendChild(mgr);
    list.appendChild(footer);
  }
```

- [ ] **Step 2: 在 `src/popup.css` 末尾追加：**

```css
.manager-link { display: flex; justify-content: center; padding: 10px 6px 4px; }
.link-btn { display: inline-flex; align-items: center; gap: 6px; font-family: inherit; font-size: 12px; color: var(--text-secondary); background: none; border: none; cursor: pointer; }
.link-btn:hover { color: var(--accent); }
```

- [ ] **Step 3: 语法/括号自检** — Run: `node -e "const fs=require('fs');new Function(fs.readFileSync('src/popup.js','utf8'));const c=fs.readFileSync('src/popup.css','utf8'); if((c.match(/{/g)||[]).length!==(c.match(/}/g)||[]).length) throw new Error('brace'); console.log('ok')"` — Expected: `ok`

- [ ] **Step 4: 全量回归** — Run: `node --test` — Expected: PASS（53 tests）

- [ ] **Step 5: Commit**

```bash
git add src/popup.js src/popup.css
git commit -m "feat: add 'Open full manager' link in popup All Marks view"
```

---

## Task 11: 手动验收

**Files:** 无（手动 + 收尾）

- [ ] **Step 1: 重新加载扩展** — `chrome://extensions` → ReadOn ⟳。

- [ ] **Step 2: 打开管理页** — 两种入口都验证：扩展详情页的"扩展程序选项"；以及 popup → All marks → 底部"Open full manager"。应在新标签页打开全屏管理页。

- [ ] **Step 3: 层级展示** — 在多个域名/页面建有 mark 后，管理页按 域名(全选框+计数) › 页面(标题·路径) › mark 行 展示；排序合理。

- [ ] **Step 4: 搜索** — 输入关键词，按 名字/笔记/标题/网址 过滤，空页面/域名隐藏；清空恢复。

- [ ] **Step 5: 笔记** — 有笔记的行折叠时显示截断预览 + ⌄；展开为可编辑 textarea，改后失焦保存、重开仍在；清空笔记后该行 ⌄ 与预览消失。无笔记行只有 ▶🗑。

- [ ] **Step 6: 删除** — 单条：有笔记弹确认、无笔记直接删。批量：勾选若干（含域名全选）→ 顶部条"N selected" → Delete 确认后删除；Clear 取消选择。

- [ ] **Step 7: 打开** — 点行 ▶ 在新标签页打开该页面并定位。

- [ ] **Step 8: 导出/导入** — Export 下载 `readon-export-…json`；改动数据后 Import 该文件 → 重复跳过、新增并入，toast 报告新增数；导入损坏文件 → 明确报错且不破坏现有数据。

- [ ] **Step 9: 浅/深双主题** — 切换系统主题，管理页配色正常。

- [ ] **Step 10: popup 回归** — popup 本页/All marks 全部功能照旧。

- [ ] **Step 11: 收尾** — 不符按 superpowers:systematic-debugging 处理；全过后 `git commit -m "docs: options manager manual acceptance passed" --allow-empty`。

---

## 自检对照（计划 vs spec）

- 全屏页 + 顶栏 Import/Export + 搜索 + 批量条（spec §2）→ Task 7/8/9。✓
- 域名›页面›marks 三级 + 组头全选/计数（spec §3）→ Task 1 `groupMarksByDomain` + Task 9 渲染。✓
- 折叠有笔记显示预览 + 展开编辑、无笔记仅 ▶🗑（spec §3）→ Task 9 `markRow`。✓
- 打开新标签页（spec §4）→ Task 9 jump（setPendingJump + openTab，复用 content 消费）。✓
- 单条删除条件确认 / 批量确认（spec §4）→ Task 9 `onSingleDelete`/`onBatchDelete`。✓
- 搜索过滤（spec §4）→ Task 9 `filteredData`。✓
- 导出/导入 + 去重合并（spec §4/§5）→ Task 2 `normalizeImport`/`mergeImport`/`buildExport` + Task 3 `importMerge` + Task 9。✓
- storage 批量删除（spec §5）→ Task 3 `deleteMarks`。✓
- 入口：options_ui + popup 链接（spec §6）→ Task 6 + Task 10 + Task 4 `openOptionsPage`。✓
- icons search/download/upload（spec §6）→ Task 5。✓
- 纯函数可测（spec §7）→ Task 1/2/3 单测，全量 53。✓
- 数据模型不变、复用 theme.css/icons.js（spec §5/§6）→ 无 schema 改动；options.html 引入 theme.css。✓
- YAGNI（不改名、无云同步、导出=全部）→ 计划未引入。✓
