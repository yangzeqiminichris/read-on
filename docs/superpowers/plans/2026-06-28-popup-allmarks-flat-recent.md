# popup All marks 扁平页面卡片 + 最近优先 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 popup 的 All marks 视图从「域名›页面›marks 两级折叠 + 工具栏」改成「扁平页面卡片、按最近活动倒序、默认折叠只露最近 mark」。

**Architecture:** 复用既有纯函数 `marks.groupMarksByPage`（它已经按最近活动倒序排页、页内按 createdAt 升序排 mark），只新增暴露一个 `recentMark` 字段供折叠态用。popup.js 的 All marks 渲染改用扁平页面卡片，删掉域名层 + Collapse/Expand 工具栏，保留页面级折叠（`collapsedPages` 内存 Set）。HTML/CSS 移除 `#all-toolbar` 与域名相关样式。

**Tech Stack:** 原生 JS + MV3，无构建步骤；`node:test` 单测；UMD 包装的共享 lib。

---

## File Structure

- `src/lib/marks.js` — 修改 `groupMarksByPage`，在每个分组对象上增加 `recentMark`（该页 updatedAt 最大的 mark）。
- `test/marks.test.js` — 为 `recentMark` 加断言。
- `src/popup.js` — All marks 渲染改用扁平页面卡片；删除域名/工具栏逻辑；页面 header 折叠态露 recentMark。
- `src/popup.html` — 删除 `#all-toolbar` 静态 DOM。
- `src/popup.css` — 删除域名头/工具栏相关样式（`.domain-head`/`.domain-*`/`.all-toolbar`/`.toolbar-btn`），按需微调 `.page-head`。

---

## Task 1: `groupMarksByPage` 暴露 recentMark

**Files:**
- Modify: `src/lib/marks.js:62-80`
- Test: `test/marks.test.js`

- [ ] **Step 1: 写失败测试**

在 `test/marks.test.js` 中，紧接现有 `groupMarksByPage 组内按 createdAt 升序，组间按最近活动倒序` 测试（约 97 行后）新增：

```js
test('groupMarksByPage 暴露 recentMark（该页 updatedAt 最大的 mark）', () => {
  function mk(id, created, updated) {
    return { id: id, name: id, pageKey: 'a.com\p', pageTitle: 'A', pageURL: 'https://a.com/p',
             note: '', createdAt: created, updatedAt: updated,
             scrollPosition: 0, viewportHeight: 1, contentHeight: 2,
             strategy: 'page-ratio', anchorText: '', scrollContainerSelector: null };
  }
  const all = {
    'a.com\p': { pageKey: 'a.com/p', nextSeq: 4, marks: [
      mk('a1', 100, 120),
      mk('a2', 200, 500),
      mk('a3', 300, 350),
    ] },
  };
  const groups = M.groupMarksByPage(all);
  assert.strictEqual(groups[0].recentMark.id, 'a2');
  assert.deepStrictEqual(groups[0].marks.map(function (m) { return m.id; }), ['a1', 'a2', 'a3']);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/marks.test.js`
Expected: FAIL —— `groups[0].recentMark` 为 `undefined`，断言 `undefined.id` 抛错或不等于 `'a2'`。

- [ ] **Step 3: 最小实现**

在 `src/lib/marks.js` 的 `groupMarksByPage` 里，`groups.push({...})` 对象中已有 `lastActivity: recent.updatedAt`；在其旁增加 `recentMark: recent`：

```js
      groups.push({
        pageKey: pd.pageKey,
        pageTitle: recent.pageTitle,
        pageURL: recent.pageURL,
        marks: sorted,
        recentMark: recent,
        lastActivity: recent.updatedAt,
      });
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/marks.test.js`
Expected: PASS（含原有 groupMarksByPage 两个测试不回归）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/marks.js test/marks.test.js
git commit -m "feat(marks): expose recentMark on groupMarksByPage groups"
```

---

## Task 2: popup HTML 移除工具栏

**Files:**
- Modify: `src/popup.html:19-22`

- [ ] **Step 1: 删除 `#all-toolbar` 块**

删除 `src/popup.html` 中这一段（19-22 行）：

```html
  <div id="all-toolbar" class="all-toolbar hidden">
    <button id="collapse-all-btn" class="toolbar-btn">Collapse All</button>
    <button id="expand-all-btn" class="toolbar-btn">Expand All</button>
  </div>
```

删除后 `<header>…</header>` 的下一行直接是 `<div id="scroll">`。

- [ ] **Step 2: 提交**

```bash
git add src/popup.html
git commit -m "refactor(popup): remove All marks collapse/expand toolbar markup"
```

---

## Task 3: popup.js 改为扁平页面卡片渲染

**Files:**
- Modify: `src/popup.js`

- [ ] **Step 1: 删除域名/工具栏相关状态与函数**

在 `src/popup.js` 中删除：
- 第 10 行 `const collapsedDomains = new Set();`
- 第 12 行 `let currentDomains = [];`
- 整个 `domainHeadEl` 函数（296-322 行）。

- [ ] **Step 2: 重写 `pageHeadEl` 为扁平页面卡片头（标题 + 计数·时间，无 url）**

把现有 `pageHeadEl`（324-356 行）整体替换为下面版本。它去掉完整 url 行，右侧显示 `N marks · 相对时间`：

```js
  function pageHeadEl(g, aliases) {
    const li = document.createElement('li');
    li.className = 'page-head';
    if (collapsedPages.has(g.pageKey)) li.classList.add('collapsed');

    const chevron = icons.el('chevron-down', 13);
    chevron.classList.add('page-chevron');
    li.appendChild(chevron);

    li.appendChild(icons.el('globe', 13));

    const title = document.createElement('span');
    title.className = 'group-title';
    const aliasVal = (aliases && aliases.pages[g.pageKey] || '').trim();
    title.textContent = aliasVal || g.pageTitle || g.pageKey;
    li.appendChild(title);

    const count = document.createElement('span');
    count.className = 'page-count';
    const n = g.marks.length;
    count.textContent = n + (n === 1 ? ' mark · ' : ' marks · ')
      + time.formatRelativeTime(g.lastActivity, Date.now());
    li.appendChild(count);

    li.onclick = async function (e) {
      if (e.target.closest('button')) return;
      if (collapsedPages.has(g.pageKey)) collapsedPages.delete(g.pageKey);
      else collapsedPages.add(g.pageKey);
      await render();
    };
    return li;
  }
```

- [ ] **Step 3: 重写 `renderAll` 为扁平列表**

把 `renderAll`（367-384 行）整体替换。折叠时只渲染 `recentMark`，展开时渲染全部 marks（正序）：

```js
  async function renderAll(list, empty) {
    const allData = await storage.getAllPageData();
    const aliases = await storage.getAliases();
    const pages = marks.groupMarksByPage(allData);
    list.innerHTML = '';
    empty.classList.toggle('hidden', pages.length > 0);
    for (const g of pages) {
      list.appendChild(pageHeadEl(g, aliases));
      if (collapsedPages.has(g.pageKey)) {
        list.appendChild(allMarkRow(g.recentMark));
      } else {
        for (const mark of g.marks) list.appendChild(allMarkRow(mark));
      }
    }
  }
```

- [ ] **Step 4: 折叠代表行不显示笔记预览**

`allMarkRow` 被折叠代表行复用，但代表行不该显示笔记预览。给 `allMarkRow` 加一个 `showNote` 形参（默认 true），并在折叠分支传 false。

把 `allMarkRow` 签名与笔记块（252、276 行附近）改为：

```js
  function allMarkRow(mark, showNote) {
```

并把笔记预览判断（276 行）改为：

```js
    if (showNote !== false && mark.note && mark.note.trim()) {
```

然后在 Step 3 的 `renderAll` 折叠分支把该行改为：

```js
        list.appendChild(allMarkRow(g.recentMark, false));
```

（展开分支 `allMarkRow(mark)` 不传第二参，默认显示笔记。）

- [ ] **Step 5: 清理 render() 中的工具栏引用**

在 `render`（390-408 行）删除这两处对 `#all-toolbar` 的引用：
- 第 396 行 `if (view !== 'all') document.getElementById('all-toolbar').classList.add('hidden');`
（整行删除。）

- [ ] **Step 6: 清理 init() 中的工具栏/域名按钮绑定**

在 `init`（433-461 行）：
- 删除 `collapse-all-btn` 的 onclick 绑定（436-439 行）。
- 删除 `expand-all-btn` 的 onclick 绑定（440-444 行）。
- 把 `all-btn` 的 onclick（445-449 行）里清空逻辑从域名改成页面：

```js
    document.getElementById('all-btn').onclick = function () {
      view = (view === 'all') ? 'page' : 'all';
      if (view === 'all') collapsedPages.clear();
      render();
    };
```

- [ ] **Step 7: 跑既有单测确认不回归**

Run: `node --test`
Expected: PASS（全部测试通过；popup.js 无单测，靠 lib 测试 + Chrome 手测）。

- [ ] **Step 8: 提交**

```bash
git add src/popup.js
git commit -m "feat(popup): flat page-card All marks, recency-sorted, collapsed shows recent mark"
```

---

## Task 4: popup.css 清理域名/工具栏样式并微调页面头

**Files:**
- Modify: `src/popup.css`

- [ ] **Step 1: 删除无用样式**

在 `src/popup.css` 中删除以下选择器对应的规则块（用 Grep 定位每个选择器）：
- `.all-toolbar`（含 `.all-toolbar.hidden` 若有）
- `.toolbar-btn`（及其 hover/active）
- `.domain-head`、`.domain-chevron`、`.domain-label`、`.domain-count`
- `.group-url`（页面头不再有 url 行）

- [ ] **Step 2: 加 `.page-count` 样式（替代被删的 `.domain-count`/`.group-url` 视觉位）**

在 `.page-head` 相关规则附近新增（与既有 `.time`/`--text-muted` 风格一致）：

```css
.page-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
```

确认 `.page-head` 是 `display:flex; align-items:center; gap:…`（若原本依赖 `.group-meta` 撑开，改为 `.group-title` 用 `flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;` 占据中间）。若 `.group-title` 无这些属性则补上：

```css
.page-head .group-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: Chrome 手动验收**

在 Chrome 加载未打包扩展，打开 popup → 点 `All marks`：
- 页面卡片平铺，无域名分组、无 Collapse/Expand 工具栏。
- 最近动过的页排最上；每个页默认折叠，只显示一行最近的 mark + 进度条 + ▶。
- 点页面 header 展开 → 该页所有 mark 按正序铺开；笔记预览只在展开行出现。
- ▶ 跨页在新标签页打开并定位；底部 "Open full manager" 固定可见。

- [ ] **Step 4: 提交**

```bash
git add src/popup.css
git commit -m "refactor(popup): drop domain/toolbar styles, add flat page-card header"
```

---

## Self-Review notes

- **Spec 覆盖**：扁平页面卡片(T3)、砍域名+工具栏(T2/T3/T4)、默认折叠露 recentMark=方案A(T1/T3)、页内正序(复用 groupMarksByPage)、页间最近倒序(复用)、header 无 url(T3/T4)、折叠不显笔记(T3 Step4)、▶ 行为不变(复用 allMarkRow)、底部 footer 不变(未改) —— 均有对应任务。
- **偏离 spec 一处（更优）**：spec 写新增 `groupMarksByPageRecent`；实际既有 `groupMarksByPage` 已做完全相同的排序，只缺 `recentMark` 字段，故改为复用 + 暴露字段（DRY），行为与 spec 完全一致。
- **类型一致**：`groupMarksByPage` 分组对象字段 `pageKey/pageTitle/pageURL/marks/recentMark/lastActivity`；`allMarkRow(mark, showNote)` 签名在 T3 Step4 统一。
- **无占位符**：所有代码步骤含完整代码。
