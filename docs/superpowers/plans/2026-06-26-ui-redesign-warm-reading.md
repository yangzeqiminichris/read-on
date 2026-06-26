# ReadOn UI 重做实现计划（暖色阅读）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 popup 视觉重做为"暖色阅读"风（浅+深双主题），建立可复用的设计令牌（`theme.css`）与图标系统（内嵌 Lucide），每行新增创建时间显示——业务行为完全不变。

**Architecture:** 新建集中式 CSS 令牌文件 `theme.css`（浅色默认 + `prefers-color-scheme` 深色覆盖）；新增两个 UMD 纯/工具库 `time.js`（相对时间，纯函数可测）与 `icons.js`（Lucide SVG 表 + DOM 工厂）；重写 `popup.css`/`popup.html`/`popup.js` 使用这套系统。MVP 的逻辑层（positioning/marks/browser/storage/content）完全不动，27 个既有单测保持绿。

**Tech Stack:** 原生 JS + MV3，无构建；UMD 包装复用三处环境；`node:test` 单测。

> 设计依据：`docs/superpowers/specs/2026-06-26-ui-redesign-warm-reading.md`。范围只含 popup；笔记/All Marks/导入导出/options 页留后续计划，但都将继承本计划建立的 `theme.css` + `icons.js`。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/theme.css` | 新建 | 设计令牌：颜色（浅+深）、字体、间距、圆角 |
| `src/lib/time.js` | 新建 | `formatRelativeTime(ts, now)` 纯函数（UMD） |
| `test/time.test.js` | 新建 | time 单测 |
| `src/lib/icons.js` | 新建 | Lucide SVG 表 `data` + `el(id,size)` 工厂（UMD） |
| `test/icons.test.js` | 新建 | icons 数据完整性单测 |
| `src/popup.html` | 改写 | 引入 theme.css、图标占位 slot、加载新脚本 |
| `src/popup.css` | 重写 | 用令牌实现暖色阅读组件 |
| `src/popup.js` | 改写 | 图标渲染 + 进度条 + 创建时间；逻辑不变 |

`window.ReadOn` 命名空间新增：`ReadOn.time`（`{formatRelativeTime}`）、`ReadOn.icons`（`{data, el}`）。

---

## Task 1: theme.css 设计令牌

**Files:**
- Create: `src/theme.css`

> 纯 CSS 无单测，靠 Task 7 手动浅/深验收。

- [ ] **Step 1: 创建 `src/theme.css`**

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
  }
}
```

- [ ] **Step 2: 校验 CSS 能解析（无语法错）**

Run: `node -e "const c=require('fs').readFileSync('src/theme.css','utf8'); if((c.match(/{/g)||[]).length!==(c.match(/}/g)||[]).length) throw new Error('brace mismatch'); console.log('css ok')"`
Expected: 打印 `css ok`

- [ ] **Step 3: Commit**

```bash
git add src/theme.css
git commit -m "feat: add warm-reading design tokens (theme.css, light + dark)"
```

---

## Task 2: time.js 相对时间纯函数（TDD）

**Files:**
- Create: `src/lib/time.js`
- Test: `test/time.test.js`

- [ ] **Step 1: 写失败的测试 — 创建 `test/time.test.js`**

```js
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
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test test/time.test.js`
Expected: FAIL —— `Cannot find module '../src/lib/time.js'`

- [ ] **Step 3: 实现 — 创建 `src/lib/time.js`**

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

  return { formatRelativeTime: formatRelativeTime };
});
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test test/time.test.js`
Expected: PASS（7 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.js test/time.test.js
git commit -m "feat: add formatRelativeTime relative-time library with tests"
```

---

## Task 3: icons.js（Lucide SVG 表 + DOM 工厂）

**Files:**
- Create: `src/lib/icons.js`
- Test: `test/icons.test.js`

> `el()` 用 `createElementNS` 构造 SVG（CSP 安全），需 DOM，在浏览器/Task 7 验证；node 单测只校验 `data` 表完整、防图标 id 拼写错。

- [ ] **Step 1: 写失败的测试 — 创建 `test/icons.test.js`**

```js
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
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test test/icons.test.js`
Expected: FAIL —— `Cannot find module '../src/lib/icons.js'`

- [ ] **Step 3: 实现 — 创建 `src/lib/icons.js`**

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

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test test/icons.test.js`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/icons.js test/icons.test.js
git commit -m "feat: add inline Lucide icon set (icons.js)"
```

---

## Task 4: popup.html（引入 theme.css、图标 slot、脚本顺序）

**Files:**
- Modify: `src/popup.html`

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
    <button id="mark-btn"><span id="mark-icon" class="mark-icon"></span>Mark</button>
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
git commit -m "feat: wire theme.css and time/icons scripts into popup.html"
```

---

## Task 5: popup.css（用令牌重写为暖色阅读组件）

**Files:**
- Modify: `src/popup.css`

- [ ] **Step 1: 用以下完整内容替换 `src/popup.css`**

```css
* { box-sizing: border-box; }

body {
  width: 332px;
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
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 11px 13px;
  margin-top: 8px;
}
.mark-row:first-child { margin-top: 4px; }
.mark-row:hover { background: var(--row-hover); }

.meta { flex: 1; min-width: 0; }
.row-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
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
  background: var(--text);
  color: var(--bg);
  padding: 6px 12px;
  border-radius: var(--radius-button);
  font-size: 12px;
}
```

- [ ] **Step 2: 校验 CSS 能解析**

Run: `node -e "const c=require('fs').readFileSync('src/popup.css','utf8'); if((c.match(/{/g)||[]).length!==(c.match(/}/g)||[]).length) throw new Error('brace mismatch'); console.log('css ok')"`
Expected: 打印 `css ok`

- [ ] **Step 3: Commit**

```bash
git add src/popup.css
git commit -m "feat: restyle popup.css to warm-reading components via tokens"
```

---

## Task 6: popup.js（图标 + 进度条 + 创建时间；逻辑不变）

**Files:**
- Modify: `src/popup.js`

> 业务逻辑（capture/ensureContentScript、saveMark、updateMarkPosition、setMarkName、就地改名提交、错误 toast）与 MVP 完全一致，只改渲染：图标用 `icons.el`，行用进度条 + 创建时间。

- [ ] **Step 1: 用以下完整内容替换 `src/popup.js`**

```js
(function () {
  'use strict';
  const { browser, storage, marks, positioning, time, icons } = window.ReadOn;

  let currentPageKey = null;
  let currentTabId = null;

  const UNREACHABLE_MSG = "Can't reach this page. Reload it and try again.";

  function showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 1500);
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

  function renderRow(mark, editing) {
    const li = document.createElement('li');
    li.className = 'mark-row';

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
      const nameSpan = document.createElement('span');
      nameSpan.className = 'name';
      nameSpan.textContent = mark.name;
      top.appendChild(nameSpan);
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

    li.appendChild(meta);

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
    li.appendChild(jump);

    const upd = makeIconButton('rotate-cw', 'update', "Update this mark's position");
    upd.onclick = async function () {
      try {
        const snap = await capture();
        await storage.updateMarkPosition(currentPageKey, mark.id, snap, Date.now());
        await render();
        showToast('Position updated');
      } catch (e) {
        showToast(UNREACHABLE_MSG);
      }
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
    await render(mark.id); // 新行进入改名编辑态
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

- [ ] **Step 2: 语法自检**

Run: `node -e "const fs=require('fs');new Function(fs.readFileSync('src/popup.js','utf8'));console.log('syntax ok')"`
Expected: 打印 `syntax ok`

- [ ] **Step 3: 跑全部单测确认无回归**

Run: `node --test`
Expected: PASS（positioning 13 + marks 7 + storage 5 + browser 2 + time 7 + icons 2 = 36 tests）

- [ ] **Step 4: Commit**

```bash
git add src/popup.js
git commit -m "feat: render popup with icons, progress bar, and created-at time"
```

---

## Task 7: 手动验收（浅/深双主题 + 行为不变）

**Files:** 无（手动 + 收尾）

> popup 改动只对重新打开的弹窗生效；扩展需在 `chrome://extensions` 重新加载。

- [ ] **Step 1: 重新加载扩展**

`chrome://extensions` → ReadOn 卡片点 ⟳ 重新加载（新增了 theme.css / time.js / icons.js）。

- [ ] **Step 2: 浅色视觉验收**

系统设为浅色，打开任一 http(s) 长页面，点 ReadOn 图标。
Expected：弹窗为暖纸感（米底、赤陶主色），宽约 332px；品牌 bookmark 图标、Mark 按钮 plus 图标、行内 ▶/⟳ 均为线性 Lucide 图标（**非空白、非 emoji**）。

- [ ] **Step 3: 行内容验收**

建若干 mark。
Expected：每行 = 行名（右上角创建时间）+ 进度条（赤陶填充，宽度≈百分比）+ 百分比文字；长行名省略号；时间显示 `just now`（刚建的）。

- [ ] **Step 4: 深色视觉验收**

系统切到深色，重新打开弹窗。
Expected：暖棕夜读配色（深棕底、浅赤陶主色、文字浅米色），对比清晰，图标/进度条/时间均正常。

- [ ] **Step 5: 行为不变验收**

依次验证：建 mark → 就地改名（Enter / 点别处都收起并锁定）；滚走后点 ▶ 跳回；点 ⟳ 出现 "Position updated" toast 且进度更新；空状态显示 bookmark-plus 图标 + 邀请文案；`chrome://extensions` 页打开弹窗显示 "This page can't be marked." 且 Mark 置灰。
Expected：全部与 MVP 行为一致。

- [ ] **Step 6: 收尾**

若有不符按 superpowers:systematic-debugging 处理。全部通过后：

```bash
git commit -m "docs: UI redesign manual acceptance passed" --allow-empty
```

---

## 自检对照（计划 vs spec）

- 设计令牌 theme.css 浅+深（spec §3）→ Task 1。✓
- 字体/间距/圆角/332px 宽（spec §3.2/3.3）→ Task 1 令牌 + Task 5 popup.css。✓
- 组件规范（spec §4）→ Task 5 popup.css + Task 6 渲染。✓
- 创建时间 formatRelativeTime 纯函数 + 规则（spec §5）→ Task 2（含单复数、7 天阈值、同年/跨年、未来容错）。✓
- 内嵌 Lucide 图标、CSP 安全、el 工厂（spec §6）→ Task 3 + Task 6 使用。✓
- 文件改动清单（spec §7）→ Task 1–6 覆盖；逻辑层不动。✓
- 测试策略（spec §8）→ Task 2/3 单测 + Task 6 全量回归 + Task 7 手动浅/深。✓
- 行为不变 → Task 6 仅改渲染，消息流/存储调用原样保留。✓
