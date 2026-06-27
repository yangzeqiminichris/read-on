# All Marks Two-Level Collapsible View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the "All Marks" popup view into a two-level collapsible hierarchy (domain → page → marks) with a collapse-all / expand-all toolbar.

**Architecture:** Add `collapsedDomains` and `collapsedPages` Sets to popup.js module scope; switch `renderAll` to use the existing `groupMarksByDomain`; build domain-head, page-head, and toolbar `<li>` elements with chevron toggling. All collapse state is in-memory only (resets on popup close).

**Tech Stack:** Vanilla JS (IIFE), DOM manipulation, existing `icons.el()` helper, existing CSS variable design tokens.

---

## Files

- Modify: `src/popup.js` — add collapse state, rewrite `renderAll`, new element builders
- Modify: `src/popup.css` — styles for `.all-toolbar`, `.domain-head`, `.page-head`, chevron rotation
- No changes to `popup.html`, storage, content script, or options page

---

### Task 1: Add collapse state and wire `groupMarksByDomain`

**Files:**
- Modify: `src/popup.js`

- [ ] **Step 1: Add two Sets after the existing `expandedIds` declaration (line 9)**

In `src/popup.js`, after:
```js
const expandedIds = new Set();
```
add:
```js
const collapsedDomains = new Set();
const collapsedPages   = new Set();
```

- [ ] **Step 2: Destructure `groupMarksByDomain` from `marks` at the top of the IIFE**

Change the existing destructure (line 3):
```js
const { browser, storage, marks, positioning, time, icons } = window.ReadOn;
```
No change needed — `marks.groupMarksByDomain` is accessed as a method, already available.

- [ ] **Step 3: Replace the `renderAll` function body to use `groupMarksByDomain`**

Replace the entire `renderAll` function (lines 323–342) with:

```js
async function renderAll(list, empty) {
  const allData = await storage.getAllPageData();
  const aliases = await storage.getAliases();
  const domains = marks.groupMarksByDomain(allData);
  list.innerHTML = '';
  empty.classList.toggle('hidden', domains.length > 0);
  list.appendChild(toolbarEl(domains));
  for (const d of domains) {
    list.appendChild(domainHeadEl(d));
    if (collapsedDomains.has(d.domain)) continue;
    for (const g of d.pages) {
      list.appendChild(pageHeadEl(g, aliases));
      if (collapsedPages.has(g.pageKey)) continue;
      for (const mark of g.marks) list.appendChild(allMarkRow(mark));
    }
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

- [ ] **Step 4: Verify popup loads without JS errors**

Load the extension in Chrome, open popup, click "All Marks". The list should still render (functions `toolbarEl`, `domainHeadEl`, `pageHeadEl` don't exist yet so it will error — that's expected and will be fixed in the next tasks).

- [ ] **Step 5: Commit**

```bash
git add src/popup.js
git commit -m "refactor: switch renderAll to groupMarksByDomain, add collapse state Sets"
```

---

### Task 2: Build `toolbarEl`

**Files:**
- Modify: `src/popup.js`

- [ ] **Step 1: Add `toolbarEl` function before `renderAll`**

Insert after `allMarkRow` (around line 312) and before `renderPage`:

```js
function toolbarEl(domains) {
  const li = document.createElement('li');
  li.className = 'all-toolbar';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'toolbar-btn';
  collapseBtn.appendChild(icons.el('chevrons-up', 14));
  collapseBtn.appendChild(document.createTextNode('Collapse All'));
  collapseBtn.onclick = async function () {
    for (const d of domains) collapsedDomains.add(d.domain);
    collapsedPages.clear();
    await render();
  };

  const expandBtn = document.createElement('button');
  expandBtn.className = 'toolbar-btn';
  expandBtn.appendChild(icons.el('chevrons-down', 14));
  expandBtn.appendChild(document.createTextNode('Expand All'));
  expandBtn.onclick = async function () {
    collapsedDomains.clear();
    collapsedPages.clear();
    await render();
  };

  li.appendChild(collapseBtn);
  li.appendChild(expandBtn);
  return li;
}
```

- [ ] **Step 2: Add toolbar CSS to `src/popup.css`**

Append to end of file:

```css
.all-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 6px 2px;
}
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: inherit;
  font-size: 11px;
  color: var(--text-secondary);
  background: none;
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 3px 9px;
  cursor: pointer;
}
.toolbar-btn:hover { background: var(--row-hover); border-color: var(--border-strong); }
```

- [ ] **Step 3: Commit**

```bash
git add src/popup.js src/popup.css
git commit -m "feat: add collapse-all/expand-all toolbar to All Marks view"
```

---

### Task 3: Build `domainHeadEl`

**Files:**
- Modify: `src/popup.js`
- Modify: `src/popup.css`

- [ ] **Step 1: Add `domainHeadEl` function after `toolbarEl`**

```js
function domainHeadEl(d) {
  const li = document.createElement('li');
  li.className = 'domain-head';
  if (collapsedDomains.has(d.domain)) li.classList.add('collapsed');

  const chevron = icons.el('chevron-down', 14);
  chevron.classList.add('domain-chevron');
  li.appendChild(chevron);

  const label = document.createElement('span');
  label.className = 'domain-label';
  label.textContent = d.domain;

  const count = document.createElement('span');
  count.className = 'domain-count';
  count.textContent = d.markCount + (d.markCount === 1 ? ' mark' : ' marks');

  li.appendChild(label);
  li.appendChild(count);

  li.onclick = async function () {
    if (collapsedDomains.has(d.domain)) collapsedDomains.delete(d.domain);
    else collapsedDomains.add(d.domain);
    await render();
  };
  return li;
}
```

- [ ] **Step 2: Add domain-head CSS**

Append to `src/popup.css`:

```css
.domain-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 12px 6px 4px;
  cursor: pointer;
  user-select: none;
}
.domain-head:first-child { padding-top: 6px; }
.domain-head:hover .domain-label { color: var(--accent); }
.domain-chevron { color: var(--text-muted); flex-shrink: 0; transition: transform .15s ease; }
.domain-head.collapsed .domain-chevron { transform: rotate(-90deg); }
.domain-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.domain-count {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verify in popup**

Open popup → All Marks. Each domain shows as a bold header with mark count and a rotating chevron. Clicking collapses/expands that domain's pages and marks.

- [ ] **Step 4: Commit**

```bash
git add src/popup.js src/popup.css
git commit -m "feat: add collapsible domain headers in All Marks view"
```

---

### Task 4: Build `pageHeadEl` (collapsible page header)

**Files:**
- Modify: `src/popup.js`
- Modify: `src/popup.css`

- [ ] **Step 1: Add `pageHeadEl` function after `domainHeadEl`**

This replaces the old `groupHeadEl`. The new version adds a chevron and collapse toggle:

```js
function pageHeadEl(g, aliases) {
  const li = document.createElement('li');
  li.className = 'page-head';
  if (collapsedPages.has(g.pageKey)) li.classList.add('collapsed');

  li.appendChild(icons.el('globe', 13));

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

  const chevron = icons.el('chevron-down', 13);
  chevron.classList.add('page-chevron');
  li.appendChild(chevron);

  li.onclick = async function () {
    if (collapsedPages.has(g.pageKey)) collapsedPages.delete(g.pageKey);
    else collapsedPages.add(g.pageKey);
    await render();
  };
  return li;
}
```

- [ ] **Step 2: Remove the old `groupHeadEl` function**

Delete the `groupHeadEl` function (lines 249–268 in the original file). It is no longer called anywhere.

- [ ] **Step 3: Add page-head CSS**

Append to `src/popup.css`:

```css
.page-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 6px 4px 18px;
  cursor: pointer;
  user-select: none;
}
.page-head:hover .group-title { color: var(--accent); }
.page-head .group-meta { flex: 1; min-width: 0; }
.page-chevron { color: var(--text-muted); flex-shrink: 0; transition: transform .15s ease; }
.page-head.collapsed .page-chevron { transform: rotate(-90deg); }
```

- [ ] **Step 4: Verify full two-level structure in popup**

Open popup → All Marks. Verify:
- Domain headers collapse/expand all pages under them
- Page headers collapse/expand their marks
- Toolbar "Collapse All" collapses all domain headers
- Toolbar "Expand All" expands everything
- Jump button on individual marks still works

- [ ] **Step 5: Commit**

```bash
git add src/popup.js src/popup.css
git commit -m "feat: add collapsible page headers in All Marks view"
```
