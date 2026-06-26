# ReadOn 行展开 + 删除 + 笔记 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给每个 mark 行加"展开"，展开后可看创建/更新时间、写笔记（失焦自动保存）、删除（两步确认）；折叠态有笔记时名字旁显示标记。

**Architecture:** 复用现有暖色阅读设计系统。新增纯函数 `time.formatDateTime` 与存储 `deleteMark`/`setNote`（均单测）；`marks.removeMark` 已有复用；`theme.css` 加 `--danger`，`icons.js` 加 3 个 Lucide 图标；`popup.css`/`popup.js` 实现展开面板与交互。业务/数据模型不变。

**Tech Stack:** 原生 JS + MV3，无构建；UMD；`node:test`。

> 设计依据：`docs/superpowers/specs/2026-06-26-notes-expand-delete-design.md`。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/lib/time.js` | 改 | 新增 `formatDateTime(ts, now)` 纯函数 |
| `test/time.test.js` | 改 | 新增 formatDateTime 测试 |
| `src/lib/storage.js` | 改 | 新增 `deleteMark`、`setNote` |
| `test/storage.test.js` | 改 | 新增 deleteMark/setNote 测试 |
| `src/lib/icons.js` | 改 | 新增 `chevron-down`/`trash-2`/`square-pen` |
| `test/icons.test.js` | 改 | 断言新图标存在 |
| `src/theme.css` | 改 | 新增 `--danger`/`--danger-on`（浅+深） |
| `src/popup.css` | 改写 | 行结构改为 `.row-main` + `.row-detail`，新增面板/笔记/危险按钮/笔记标记样式 |
| `src/popup.js` | 改写 | `expandedIds`、展开按钮、笔记 textarea、删除两步确认、折叠笔记标记 |

`window.ReadOn` 新增成员：`time.formatDateTime`、`storage.deleteMark`、`storage.setNote`、`icons.data` 三个新键。

---

## Task 1: time.formatDateTime（TDD）

**Files:** Modify `src/lib/time.js`, `test/time.test.js`

- [ ] **Step 1: 用以下完整内容替换 `test/time.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const { formatRelativeTime, formatDateTime } = require('../src/lib/time.js');

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
  const ts = new Date(2025, 5, 12).getTime();
  assert.strictEqual(formatRelativeTime(ts, NOW), 'Jun 12, 2025');
});

test('未来时间（时钟漂移）当作 just now', () => {
  assert.strictEqual(formatRelativeTime(NOW + 10 * sec, NOW), 'just now');
});

test('formatDateTime 同年 → 月日, 时:分', () => {
  const ts = new Date(2026, 5, 12, 14, 30).getTime();
  assert.strictEqual(formatDateTime(ts, NOW), 'Jun 12, 14:30');
});

test('formatDateTime 跨年 → 月日, 年, 时:分', () => {
  const ts = new Date(2025, 5, 12, 14, 30).getTime();
  assert.strictEqual(formatDateTime(ts, NOW), 'Jun 12, 2025, 14:30');
});

test('formatDateTime 时分零填充', () => {
  const ts = new Date(2026, 0, 3, 9, 5).getTime();
  assert.strictEqual(formatDateTime(ts, NOW), 'Jan 3, 09:05');
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/time.test.js` — Expected: FAIL（`formatDateTime is not a function`）

- [ ] **Step 3: 用以下完整内容替换 `src/lib/time.js`**

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.time = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function plural(n, unit) {
    return n + ' ' + unit + (n === 1 ? '' : 's') + ' ago';
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function formatRelativeTime(timestamp, now) {
    let diff = now - timestamp;
    if (diff < 0) diff = 0;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return plural(min, 'minute');
    const hr = Math.floor(min / 60);
    if (hr < 24) return plural(hr, 'hour');
    const day = Math.floor(hr / 24);
    if (day < 7) return plural(day, 'day');

    const d = new Date(timestamp);
    const base = MONTHS[d.getMonth()] + ' ' + d.getDate();
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return sameYear ? base : base + ', ' + d.getFullYear();
  }

  function formatDateTime(timestamp, now) {
    const d = new Date(timestamp);
    const base = MONTHS[d.getMonth()] + ' ' + d.getDate();
    const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return sameYear ? base + ', ' + hm : base + ', ' + d.getFullYear() + ', ' + hm;
  }

  return { formatRelativeTime: formatRelativeTime, formatDateTime: formatDateTime };
});
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/time.test.js` — Expected: PASS（10 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.js test/time.test.js
git commit -m "feat: add formatDateTime for absolute created-at display"
```

---

## Task 2: storage.deleteMark + setNote（TDD）

**Files:** Modify `src/lib/storage.js`, `test/storage.test.js`

- [ ] **Step 1: 用以下完整内容替换 `test/storage.test.js`**

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
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/storage.test.js` — Expected: FAIL（`storage.deleteMark is not a function`）

- [ ] **Step 3: 用以下完整内容替换 `src/lib/storage.js`**

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

  async function deleteMark(pageKey, markId) {
    const pageData = await getPageData(pageKey);
    const next = marks.removeMark(pageData, markId);
    await browser.storageSet({ [pageKey]: next });
  }

  async function setNote(pageKey, markId, note) {
    const pageData = await getPageData(pageKey);
    const updated = pageData.marks.map(function (m) {
      return m.id === markId ? Object.assign({}, m, { note: note }) : m;
    });
    await browser.storageSet({ [pageKey]: Object.assign({}, pageData, { marks: updated }) });
  }

  return {
    getPageData, saveMark, updateMarkPosition, setMarkName, deleteMark, setNote,
  };
});
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/storage.test.js` — Expected: PASS（8 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.js test/storage.test.js
git commit -m "feat: add storage.deleteMark and setNote with tests"
```

---

## Task 3: icons.js 新增 3 个图标

**Files:** Modify `src/lib/icons.js`, `test/icons.test.js`

- [ ] **Step 1: 用以下完整内容替换 `test/icons.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const icons = require('../src/lib/icons.js');

test('icons.data 含所需图标且为非空字符串', () => {
  const ids = ['bookmark', 'plus', 'play', 'rotate-cw', 'bookmark-plus',
               'chevron-down', 'trash-2', 'square-pen'];
  for (const id of ids) {
    assert.ok(typeof icons.data[id] === 'string' && icons.data[id].length > 0, id);
  }
});

test('icons.el 是函数', () => {
  assert.strictEqual(typeof icons.el, 'function');
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/icons.test.js` — Expected: FAIL（缺 `chevron-down` 等）

- [ ] **Step 3: 用以下完整内容替换 `src/lib/icons.js`**

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.icons = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 官方 Lucide 图标内部标记（ISC 开源）。viewBox 0 0 24 24，靠 currentColor 继承父色。
  const data = {
    'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'play': '<polygon points="6 3 20 12 6 21 6 3"/>',
    'rotate-cw': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    'bookmark-plus': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><line x1="12" x2="12" y1="7" y2="13"/><line x1="9" x2="15" y1="10" y2="10"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    'square-pen': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  };

  function el(id, size) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = data[id] || '';
    return svg;
  }

  return { data: data, el: el };
});
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/icons.test.js` — Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/icons.js test/icons.test.js
git commit -m "feat: add chevron-down, trash-2, square-pen icons"
```

---

## Task 4: theme.css 新增 --danger 令牌

**Files:** Modify `src/theme.css`

- [ ] **Step 1: 用以下完整内容替换 `src/theme.css`**

```css
:root {
  color-scheme: light dark;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;

  --bg: #FAF6EF;
  --surface: #FFFFFF;
  --border: #EFE7DA;
  --border-strong: #EADFCF;
  --text: #2C2722;
  --text-secondary: #8A7E6E;
  --text-muted: #A89A86;
  --accent: #C2683C;
  --accent-hover: #AD5A30;
  --accent-on: #FFFFFF;
  --track: #F0E8DB;
  --row-hover: #FBF7F0;
  --danger: #B23B3B;
  --danger-on: #FFFFFF;

  --radius-button: 9px;
  --radius-card: 11px;
  --radius-popup: 14px;
  --radius-pill: 99px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1E1B18;
    --surface: #29241E;
    --border: #3A342C;
    --border-strong: #342F28;
    --text: #EDE6DA;
    --text-secondary: #A99E8C;
    --text-muted: #A99E8C;
    --accent: #E0875A;
    --accent-hover: #EC9869;
    --accent-on: #231A13;
    --track: #3A332B;
    --row-hover: #322C25;
    --danger: #E06B6B;
    --danger-on: #231A13;
  }
}
```

- [ ] **Step 2: 校验** — Run: `node -e "const c=require('fs').readFileSync('src/theme.css','utf8'); if((c.match(/{/g)||[]).length!==(c.match(/}/g)||[]).length) throw new Error('brace'); console.log('css ok')"` — Expected: `css ok`

- [ ] **Step 3: Commit**

```bash
git add src/theme.css
git commit -m "feat: add --danger design tokens (light + dark)"
```

---

## Task 5: popup.css 行结构 + 展开面板样式

**Files:** Modify `src/popup.css`

> 关键改动：`.mark-row` 由 flex 改为块容器（承载 `.row-main` + `.row-detail`），主行内容移到 `.row-main`。

- [ ] **Step 1: 用以下完整内容替换 `src/popup.css`**

```css
* { box-sizing: border-box; }

html { margin: 0; background: var(--bg); }

body {
  width: 350px;
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.4;
  color: var(--text);
  background: var(--bg);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 15px;
}
.brand { display: flex; align-items: center; gap: 8px; }
.brand-icon { display: inline-flex; color: var(--accent); }
.title { font-weight: 500; font-size: 15px; }

#mark-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-on);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-button);
  padding: 7px 13px;
  cursor: pointer;
}
.mark-icon { display: inline-flex; }
#mark-btn:hover { background: var(--accent-hover); }
#mark-btn:active { transform: scale(0.98); }
#mark-btn:disabled { opacity: .5; cursor: default; }

ul#mark-list { list-style: none; margin: 0; padding: 0 9px 10px; }

.mark-row {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 11px 13px;
  margin-top: 8px;
}
.mark-row:first-child { margin-top: 4px; }
.mark-row:hover { background: var(--row-hover); }

.row-main { display: flex; align-items: center; gap: 10px; }

.meta { flex: 1; min-width: 0; }
.row-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.name-wrap { display: flex; align-items: center; gap: 5px; min-width: 0; }
.name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name-note-flag { display: inline-flex; color: var(--text-muted); flex-shrink: 0; }
.name-input {
  flex: 1;
  min-width: 0;
  font-family: inherit;
  font-size: 13px;
  padding: 2px 6px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
}
.time {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.bar-row { display: flex; align-items: center; gap: 8px; }
.track {
  flex: 1;
  height: 4px;
  background: var(--track);
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.fill { height: 100%; background: var(--accent); border-radius: var(--radius-pill); }
.pct {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 26px;
  text-align: right;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}
.icon-btn:hover { background: var(--track); }
.icon-btn.jump { color: var(--accent); }
.icon-btn.update { color: var(--text-muted); }
.icon-btn.expand { color: var(--text-muted); }
.icon-btn.expand svg { transition: transform .15s ease; }
.mark-row.expanded .icon-btn.expand svg { transform: rotate(180deg); }

.row-detail {
  border-top: 1px solid var(--border);
  margin-top: 11px;
  padding-top: 10px;
}
.detail-meta { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; }
.note-input {
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 12px;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 9px;
  resize: none;
  min-height: 48px;
  max-height: 140px;
  overflow: auto;
}
.note-input:focus { outline: none; border-color: var(--accent); }

.row-delete {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.delete-q { font-size: 12px; color: var(--text-secondary); }
.danger-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: inherit;
  font-size: 12px;
  border-radius: 7px;
  cursor: pointer;
}
.danger-btn.ghost { background: none; border: none; color: var(--danger); padding: 4px 6px; }
.danger-btn.solid { background: var(--danger); color: var(--danger-on); border: none; padding: 3px 10px; }
.ghost-btn {
  font-family: inherit;
  font-size: 12px;
  background: none;
  border: 1px solid var(--border-strong);
  color: var(--text-secondary);
  border-radius: 7px;
  padding: 3px 10px;
  cursor: pointer;
}

#restricted { padding: 20px 15px; text-align: center; color: var(--text-secondary); }
#empty { padding: 24px 15px; text-align: center; }
.empty-icon { display: inline-flex; color: var(--text-muted); }
#empty p { margin: 8px 0 0; color: var(--text-secondary); font-size: 12px; }

.hidden { display: none; }

.toast {
  position: fixed;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  background: var(--accent);
  color: var(--accent-on);
  padding: 6px 12px;
  border-radius: var(--radius-button);
  font-size: 12px;
}

.row-toast {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--accent) 85%, transparent);
  color: var(--accent-on);
  padding: 5px 12px;
  border-radius: var(--radius-button);
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
}
```

- [ ] **Step 2: 校验** — Run: `node -e "const c=require('fs').readFileSync('src/popup.css','utf8'); if((c.match(/{/g)||[]).length!==(c.match(/}/g)||[]).length) throw new Error('brace'); console.log('css ok')"` — Expected: `css ok`

- [ ] **Step 3: Commit**

```bash
git add src/popup.css
git commit -m "feat: popup.css row-main/row-detail structure and panel styles"
```

---

## Task 6: popup.js 展开 / 笔记 / 删除

**Files:** Modify `src/popup.js`

> 复用既有 capture/ensureContentScript/跳转/更新/改名/toast；新增 `expandedIds`、`buildDetail`、行内展开按钮与折叠笔记标记。

- [ ] **Step 1: 用以下完整内容替换 `src/popup.js`**

```js
(function () {
  'use strict';
  const { browser, storage, marks, positioning, time, icons } = window.ReadOn;

  let currentPageKey = null;
  let currentTabId = null;
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

  function buildDetail(mark) {
    const detail = document.createElement('div');
    detail.className = 'row-detail';

    const metaLine = document.createElement('div');
    metaLine.className = 'detail-meta';
    let metaText = 'Created ' + time.formatDateTime(mark.createdAt, Date.now());
    if (mark.updatedAt !== mark.createdAt) {
      metaText += ' · Updated ' + time.formatRelativeTime(mark.updatedAt, Date.now());
    }
    metaLine.textContent = metaText;
    detail.appendChild(metaLine);

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
    detail.appendChild(note);

    const del = document.createElement('div');
    del.className = 'row-delete';

    function renderDeleteDefault() {
      del.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'danger-btn ghost';
      btn.appendChild(icons.el('trash-2', 14));
      btn.appendChild(document.createTextNode('Delete'));
      btn.onclick = renderDeleteConfirm;
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
      confirm.onclick = async function () {
        await storage.deleteMark(currentPageKey, mark.id);
        expandedIds.delete(mark.id);
        await render();
      };
      del.appendChild(q);
      del.appendChild(cancel);
      del.appendChild(confirm);
    }

    renderDeleteDefault();
    detail.appendChild(del);

    return detail;
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
    timeEl.textContent = time.formatRelativeTime(mark.createdAt, Date.now());

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
    meta.appendChild(barRow);

    main.appendChild(meta);

    const jump = makeIconButton('play', 'jump', 'Jump to this mark');
    jump.onclick = async function () {
      try {
        await browser.ensureContentScript(currentTabId);
        await browser.sendMessageToTab(currentTabId, { type: 'READON_SCROLL_TO', mark: mark });
        window.close();
      } catch (e) {
        showToast(UNREACHABLE_MSG);
      }
    };
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
    await render(mark.id);
  }

  function mountStaticIcons() {
    document.getElementById('brand-icon').appendChild(icons.el('bookmark', 17));
    document.getElementById('mark-icon').appendChild(icons.el('plus', 14));
    document.getElementById('empty-icon').appendChild(icons.el('bookmark-plus', 28));
  }

  async function init() {
    mountStaticIcons();
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

- [ ] **Step 2: 语法自检** — Run: `node -e "const fs=require('fs');new Function(fs.readFileSync('src/popup.js','utf8'));console.log('syntax ok')"` — Expected: `syntax ok`

- [ ] **Step 3: 全量回归** — Run: `node --test` — Expected: PASS（positioning 13 + marks 7 + storage 8 + browser 2 + time 10 + icons 2 = 42 tests）

- [ ] **Step 4: Commit**

```bash
git add src/popup.js
git commit -m "feat: row expand with note editing and two-step delete"
```

---

## Task 7: 手动验收

**Files:** 无（手动 + 收尾）

- [ ] **Step 1: 重新加载扩展** — `chrome://extensions` → ReadOn ⟳ 重新加载。

- [ ] **Step 2: 展开/折叠** — 任一 http(s) 页建几个 mark，点行最右 `⌄`：展开出面板（chevron 转向上），再点收起。多行可各自独立展开。

- [ ] **Step 3: 时间行** — 展开后显示 `Created {月日, 时:分}`；点 `⟳` 更新后，行保持展开且出现 `· Updated just now`。

- [ ] **Step 4: 笔记自动保存** — 展开输入笔记 → 点别处（失焦）→ 收起再展开，笔记仍在；关闭弹窗重开仍在。清空笔记保存后亦生效。

- [ ] **Step 5: 折叠笔记标记** — 有笔记的行折叠后，名字旁出现小 ✎；删除笔记后该标记消失。

- [ ] **Step 6: 删除两步确认** — 展开点 `Delete` → 出现 "Delete this mark?" + Cancel/Delete；Cancel 还原；Delete 删除该行；删空显示空状态。

- [ ] **Step 7: 浅/深双主题** — 系统切换浅/深，面板、textarea、危险色（删除按钮/确认）、✎ 标记均正常对比清晰。

- [ ] **Step 8: 行为回归** — 建/改名/▶ 跳转/⟳ 更新（行内居中 toast）/受限页置灰 全部与之前一致。

- [ ] **Step 9: 收尾** — 不符按 superpowers:systematic-debugging 处理；全过后 `git commit -m "docs: notes/expand/delete manual acceptance passed" --allow-empty`。

---

## 自检对照（计划 vs spec）

- 行展开 + chevron 旋转 + expandedIds 保持（spec §2.1）→ Task 5 CSS + Task 6 popup.js。✓
- 展开面板：时间行 / 笔记 textarea 失焦自动存 / 删除两步确认（spec §2.2）→ Task 6 `buildDetail`。✓
- 折叠笔记标记 ✎（spec §2.3）→ Task 6 renderRow else 分支 + Task 5 `.name-note-flag`。✓
- `storage.deleteMark`/`setNote`、复用 `removeMark`（spec §3）→ Task 2。✓
- `time.formatDateTime` 同年/跨年/零填充（spec §3）→ Task 1。✓
- `--danger` 令牌 + 3 图标（spec §4）→ Task 3、Task 4。✓
- 数据模型不变、业务逻辑不变（spec §3/§5）→ Task 6 仅扩展渲染与新增存储调用。✓
- 测试策略（spec §7）→ Task 1/2 单测 + Task 6 全量回归 42 + Task 7 手动。✓
- YAGNI（纯文本、无撤销、不预览全文）（spec §8）→ 计划未引入这些。✓
