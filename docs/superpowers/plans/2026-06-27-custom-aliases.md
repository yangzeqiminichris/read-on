# ReadOn 域名/链接自定义别名 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许给域名/页面起自定义别名（别名为主 + 原名小字），在 options 页编辑、在 options/All Marks 显示。

**Architecture:** 别名存独立 storage 键 `_readon_aliases`（不进 mark 模型、不入导出）。纯函数 `marks.aliasOr` 解析显示名；`storage` 提供别名读写；options 页域名/页面头加 ✎ 就地编辑；popup All Marks 页头只读显示页面别名。

**Tech Stack:** 原生 JS + MV3，无构建；UMD；`node:test`。

> 设计依据：`docs/superpowers/specs/2026-06-27-custom-aliases.md`。**在 `options-manager` 分支（worktree）上实现**（该分支含 options 页，尚未合并），随分支一起合 master。基线：options-manager 分支当前（53 单测）。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/lib/marks.js` | 改 | `aliasOr(map, key, fallback)` 纯函数 |
| `test/marks.test.js` | 改 | aliasOr 测试 |
| `src/lib/storage.js` | 改 | `getAliases`/`setDomainAlias`/`setPageAlias` |
| `test/storage.test.js` | 改 | 别名读写测试 |
| `src/options.js` | 改 | 别名 state + 域名/页面头别名显示与 ✎ 编辑 |
| `src/options.css` | 改 | 别名主名/小字/✎/编辑框样式 |
| `src/popup.js` | 改 | All Marks 页头只读显示页面别名 |

---

## Task 1: marks.aliasOr（TDD）

**Files:** Modify `src/lib/marks.js`, `test/marks.test.js`

- [ ] **Step 1: 在 `test/marks.test.js` 末尾追加：**

```js
test('aliasOr 有值用值、空白/缺失/非串回退', () => {
  assert.strictEqual(M.aliasOr({ a: 'X' }, 'a', 'def'), 'X');
  assert.strictEqual(M.aliasOr({ a: '  ' }, 'a', 'def'), 'def');
  assert.strictEqual(M.aliasOr({}, 'a', 'def'), 'def');
  assert.strictEqual(M.aliasOr(null, 'a', 'def'), 'def');
  assert.strictEqual(M.aliasOr({ a: 5 }, 'a', 'def'), 'def');
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/marks.test.js` — Expected: FAIL（`aliasOr is not a function`）

- [ ] **Step 3: 在 `src/lib/marks.js` 把结尾 return 块替换**（在其前插入函数）：

把
```js
  return {
    pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark, groupMarksByPage,
    domainOf, groupMarksByDomain, normalizeImport, mergeImport, buildExport,
  };
```
替换为
```js
  function aliasOr(map, key, fallback) {
    if (map && typeof map[key] === 'string' && map[key].trim()) return map[key];
    return fallback;
  }

  return {
    pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark, groupMarksByPage,
    domainOf, groupMarksByDomain, normalizeImport, mergeImport, buildExport, aliasOr,
  };
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/marks.test.js` — Expected: PASS（15 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/marks.js test/marks.test.js
git commit -m "feat: add marks.aliasOr resolver"
```

---

## Task 2: storage 别名读写（TDD）

**Files:** Modify `src/lib/storage.js`, `test/storage.test.js`

- [ ] **Step 1: 在 `test/storage.test.js` 末尾追加：**

```js
test('getAliases 缺省返回空结构', async () => {
  installFakeChrome();
  assert.deepStrictEqual(await storage.getAliases(), { domains: {}, pages: {} });
});

test('setDomainAlias 设置与清除（空白清除）', async () => {
  installFakeChrome();
  await storage.setDomainAlias('x.com', 'My X');
  assert.strictEqual((await storage.getAliases()).domains['x.com'], 'My X');
  await storage.setDomainAlias('x.com', '   ');
  assert.strictEqual((await storage.getAliases()).domains['x.com'], undefined);
});

test('setPageAlias 独立于 domains', async () => {
  installFakeChrome();
  await storage.setPageAlias('x.com/a', 'Intro');
  const al = await storage.getAliases();
  assert.strictEqual(al.pages['x.com/a'], 'Intro');
  assert.deepStrictEqual(al.domains, {});
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test test/storage.test.js` — Expected: FAIL（`getAliases is not a function`）

- [ ] **Step 3: 在 `src/lib/storage.js` 把结尾 return 块替换**（在其前插入函数）：

把
```js
  return {
    getPageData, saveMark, updateMarkPosition, setMarkName, deleteMark, setNote,
    getAllPageData, setPendingJump, getPendingJump, clearPendingJump,
    deleteMarks, importMerge,
  };
```
替换为
```js
  const ALIASES_KEY = '_readon_aliases';

  async function getAliases() {
    const data = await browser.storageGet([ALIASES_KEY]);
    const a = data[ALIASES_KEY] || {};
    return { domains: a.domains || {}, pages: a.pages || {} };
  }

  async function setAliasField(field, key, alias) {
    const a = await getAliases();
    const v = (alias || '').trim();
    if (v) a[field][key] = v; else delete a[field][key];
    await browser.storageSet({ [ALIASES_KEY]: a });
  }

  async function setDomainAlias(domain, alias) { return setAliasField('domains', domain, alias); }
  async function setPageAlias(pageKey, alias) { return setAliasField('pages', pageKey, alias); }

  return {
    getPageData, saveMark, updateMarkPosition, setMarkName, deleteMark, setNote,
    getAllPageData, setPendingJump, getPendingJump, clearPendingJump,
    deleteMarks, importMerge,
    getAliases, setDomainAlias, setPageAlias,
  };
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test test/storage.test.js` — Expected: PASS（15 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.js test/storage.test.js
git commit -m "feat: add alias storage (getAliases/setDomainAlias/setPageAlias)"
```

---

## Task 3: options 页别名显示 + 编辑

**Files:** Modify `src/options.js`, `src/options.css`

- [ ] **Step 1: 在 `src/options.js` 顶部 state 增加 aliases。** 把：

```js
  let query = '';
  let allData = {};
```
替换为
```js
  let query = '';
  let allData = {};
  let aliases = { domains: {}, pages: {} };
```

- [ ] **Step 2: 让 reload 同时取别名。** 把：

```js
  async function reload() {
    allData = await storage.getAllPageData();
    render();
  }
```
替换为
```js
  async function reload() {
    allData = await storage.getAllPageData();
    aliases = await storage.getAliases();
    render();
  }
```

- [ ] **Step 3: 新增别名名字块助手 + 重写 domainHead / pageHead。** 把现有 `domainHead` 与 `pageHead` 两个函数整体替换为：

```js
  // 别名名字块：静态显示（主名 + 原名小字）；点 ✎ 切换为输入框（Enter/失焦保存、Esc 取消）。
  function aliasNameBlock(primaryClass, currentAlias, fallback, sub, onSave) {
    const block = document.createElement('div');
    block.className = 'alias-block';
    function showStatic() {
      block.innerHTML = '';
      const p = document.createElement('div');
      p.className = primaryClass;
      p.textContent = currentAlias || fallback;
      block.appendChild(p);
      if (sub) {
        const s = document.createElement('div');
        s.className = 'alias-sub';
        s.textContent = sub;
        block.appendChild(s);
      }
    }
    function showEdit() {
      block.innerHTML = '';
      const input = document.createElement('input');
      input.className = 'alias-input';
      input.value = currentAlias;
      input.placeholder = fallback;
      let done = false;
      function commit() {
        if (done) return;
        done = true;
        onSave(input.value.trim());
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') { done = true; render(); }
      });
      input.addEventListener('blur', commit);
      block.appendChild(input);
      const s = document.createElement('div');
      s.className = 'alias-sub';
      s.textContent = sub || fallback;
      block.appendChild(s);
      setTimeout(function () { input.focus(); input.select(); }, 0);
    }
    showStatic();
    return { el: block, edit: showEdit };
  }

  function renameBtn(hasAlias, onClick) {
    const b = document.createElement('button');
    b.className = 'rename-btn' + (hasAlias ? '' : ' empty');
    b.title = hasAlias ? 'Rename' : 'Add a name';
    b.setAttribute('aria-label', b.title);
    b.appendChild(icons.el('square-pen', 14));
    b.onclick = onClick;
    return b;
  }

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

    const aliasVal = (aliases.domains[group.domain] || '').trim();
    const block = aliasNameBlock('domain-name', aliasVal, group.domain, aliasVal ? group.domain : '', function (v) {
      storage.setDomainAlias(group.domain, v).then(reload);
    });
    li.appendChild(block.el);
    li.appendChild(renameBtn(!!aliasVal, function () { block.edit(); }));

    const spacer = document.createElement('span');
    spacer.className = 'head-spacer';
    li.appendChild(spacer);
    const count = document.createElement('span');
    count.className = 'domain-count';
    count.textContent = group.markCount + (group.markCount === 1 ? ' mark' : ' marks');
    li.appendChild(count);
    return li;
  }

  function pageHead(p) {
    const li = document.createElement('li');
    li.className = 'page-head';
    const slash = p.pageKey.indexOf('/');
    const path = (slash === -1 ? '/' : p.pageKey.slice(slash));
    const aliasVal = (aliases.pages[p.pageKey] || '').trim();
    const fallback = p.pageTitle || path;
    const sub = aliasVal
      ? (p.pageTitle ? p.pageTitle + ' · ' + path : path)
      : path;
    const block = aliasNameBlock('page-title', aliasVal, fallback, sub, function (v) {
      storage.setPageAlias(p.pageKey, v).then(reload);
    });
    li.appendChild(block.el);
    li.appendChild(renameBtn(!!aliasVal, function () { block.edit(); }));
    return li;
  }
```

- [ ] **Step 4: 在 `src/options.css` 末尾追加：**

```css
.head-spacer { flex: 1; }
.alias-block { min-width: 0; flex: 1; }
.domain-head .domain-name, .alias-block .domain-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.alias-block .page-title { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.alias-sub { font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.alias-input { font-family: inherit; font-size: 13px; font-weight: 500; width: 220px; max-width: 100%; padding: 2px 7px; border: 1px solid var(--accent); border-radius: 6px; background: var(--surface); color: var(--text); }
.alias-input:focus { outline: none; }
.rename-btn { display: inline-flex; align-items: center; justify-content: center; background: none; border: none; color: var(--text-muted); padding: 3px; border-radius: 6px; cursor: pointer; flex-shrink: 0; }
.rename-btn:hover { background: var(--track); color: var(--accent); }
.rename-btn.empty { color: color-mix(in srgb, var(--text-muted) 55%, transparent); }
.page-head { display: flex; align-items: center; gap: 6px; }
```

> 说明：原 `.page-head` 规则（`padding: 12px 0 6px 26px;` 等）保留；此处追加的 `display:flex` 等与之叠加（同选择器后定义覆盖/补充）。

- [ ] **Step 5: 校验 + 全量回归** — Run:
```
node -e "const fs=require('fs');new Function(fs.readFileSync('src/options.js','utf8'));const c=fs.readFileSync('src/options.css','utf8'); if((c.match(/{/g)||[]).length!==(c.match(/}/g)||[]).length) throw new Error('brace'); console.log('ok')"
node --test
```
Expected: `ok`；测试 57 全过（positioning 13 + marks 15 + storage 15 + browser 2 + time 10 + icons 2）。

- [ ] **Step 6: Commit**

```bash
git add src/options.js src/options.css
git commit -m "feat: editable domain/page aliases in options manager"
```

---

## Task 4: popup All Marks 页头只读显示页面别名

**Files:** Modify `src/popup.js`

- [ ] **Step 1: 让 renderAll 取别名并传给 groupHeadEl。** 在 `renderAll` 中：

把
```js
    const allData = await storage.getAllPageData();
    const groups = marks.groupMarksByPage(allData);
```
替换为
```js
    const allData = await storage.getAllPageData();
    const aliases = await storage.getAliases();
    const groups = marks.groupMarksByPage(allData);
```

并把
```js
      list.appendChild(groupHeadEl(g));
```
替换为
```js
      list.appendChild(groupHeadEl(g, aliases));
```

- [ ] **Step 2: 重写 groupHeadEl 接受 aliases、显示页面别名。** 把现有 `groupHeadEl` 整体替换为：

```js
  function groupHeadEl(g, aliases) {
    const li = document.createElement('li');
    li.className = 'group-head';
    li.appendChild(icons.el('globe', 14));
    const box = document.createElement('div');
    box.className = 'group-meta';
    const aliasVal = (aliases && aliases.pages[g.pageKey] || '').trim();
    const t = document.createElement('div');
    t.className = 'group-title';
    t.textContent = aliasVal || g.pageTitle || g.pageKey;
    const u = document.createElement('div');
    u.className = 'group-url';
    u.textContent = aliasVal
      ? (g.pageTitle ? g.pageTitle + ' · ' + g.pageKey : g.pageKey)
      : g.pageKey;
    box.appendChild(t);
    box.appendChild(u);
    li.appendChild(box);
    return li;
  }
```

- [ ] **Step 3: 语法 + 全量回归** — Run:
```
node -e "const fs=require('fs');new Function(fs.readFileSync('src/popup.js','utf8'));console.log('syntax ok')"
node --test
```
Expected: `syntax ok`；57 全过。

- [ ] **Step 4: Commit**

```bash
git add src/popup.js
git commit -m "feat: show page alias in popup All Marks group headers"
```

---

## Task 5: 手动验收

**Files:** 无（手动 + 收尾）

- [ ] **Step 1: 重新加载扩展** — `chrome://extensions` → ReadOn ⟳（指向 options-manager worktree）。

- [ ] **Step 2: 域名别名** — 打开管理页 → 某域名头点 ✎ → 输入别名 → Enter/失焦：显示"别名(大) + 原域名(小灰)"；✎ 由淡变常态。

- [ ] **Step 3: 页面别名** — 某页面头点 ✎ → 输入别名 → 保存：显示"别名 + 原标题·路径(小灰)"。

- [ ] **Step 4: 清除/取消** — 把别名清空保存 → 回退默认原名；编辑中按 Esc → 不保存还原。

- [ ] **Step 5: All Marks 显示** — 打开 popup → All marks：设了页面别名的分组头显示别名 + 原标题/网址小字（只读，无 ✎）。

- [ ] **Step 6: 双主题 + 回归** — 浅/深下别名样式正常；options 搜索/批量/笔记/导入导出、popup 全部功能照旧。

- [ ] **Step 7: 收尾** — 不符按 superpowers:systematic-debugging 处理；全过后 `git commit -m "docs: aliases manual acceptance passed" --allow-empty`。

---

## 自检对照（计划 vs spec）

- 域名 + 页面均可起别名、可编辑（spec §4/§5）→ Task 3 domainHead/pageHead + ✎。✓
- 别名为主 + 原名小字、无别名淡 ✎（方案 A，spec §3）→ Task 3 aliasNameBlock/renameBtn + Task 4 css。✓
- 别名独立存储、不入分组/导出（spec §2）→ Task 2（独立键，无 marks 数组）。✓
- All Marks 只读显示页面别名（spec §5）→ Task 4。✓
- 纯函数/storage 可测（spec §6/§7）→ Task 1/2 单测，全量 57。✓
- 复用 theme.css/icons(square-pen)（spec §6）→ Task 3。✓
- 不改 mark 模型（spec §1）→ 无 schema 改动。✓
- YAGNI：不入导出、不在 popup 编辑、无域名别名于 All Marks（spec §8）→ 计划未引入。✓
