# ReadOn · options 全屏管理页 设计文档

**日期**：2026-06-27
**状态**：已确认，待进入实现计划
**关联**：在 master `ef81c88`（All Marks 已完成）基础上扩展。复用 `theme.css`、`icons.js`、`storage`、`marks` 分组逻辑、`time`、`positioning.displayPercent`、跨页面跳转机制。前序：`2026-06-26-scroll-bookmark-extension-design.md`（§6⑥ 导入导出、options 页定位）、`2026-06-27-all-marks-cross-page.md`。

## 1. 背景与目标

补齐路线图最后两块：**完整管理页**（搜索、批量管理、编辑笔记）+ **导入/导出**（分享）。这是唯一开新标签页的全屏页面。

**范围**：全屏管理页，含 搜索 / 批量删除 / 查看·编辑笔记 / 打开 / 单条删除 / 导入 / 导出。一次收尾导入导出。

## 2. 页面结构

全屏、居中单列（max-width 680px），复用 `theme.css` 令牌。新文件 `src/options.html` / `options.css` / `options.js`。

- **顶栏**：左 `🔖 ReadOn · Manage`；右 `Import`（`upload` 图标）、`Export`（`download` 图标）按钮（幽灵样式）。
- **搜索框**：`search` 图标 + `<input>`，placeholder "Search marks, notes, pages…"。
- **批量操作条**：当有勾选时显示，"N selected" + `Delete`（危险）+ `Clear`；无勾选时隐藏。
- **主体**：按域名分层。

## 3. 三级层级（域名 › 页面 › mark）

- **域名组头**：全选复选框（选/清该域名下全部 mark）+ `globe` 图标 + 域名（hostname）+ 该域名 mark 计数。
- **页面子组头**（缩进）：页面标题 + ` · ` + pathname（`--text-muted`）。
- **mark 行**（再缩进，卡片）：复选框 + 名字 + 最后更新时间（`formatRelativeTime(updatedAt)`）+ 进度条 + %；右侧操作：
  - `▶` 打开、`🗑` 删除、**仅当有笔记**显示 `⌄` 展开。
  - **折叠且有笔记**：在进度条下显示**简略笔记预览**（`square-pen` 图标 + 笔记首行，单行截断，`--text-muted`）。
  - **展开**：预览换成**可编辑 textarea**（占位 "Add a note…"，失焦 `storage.setNote` 保存，min-height 64px）；清空笔记后再折叠/重渲染则不再有 `⌄` 与预览。
  - **无笔记**：只有 `▶` `🗑`，无预览、无展开。

**排序**（纯函数 `marks.groupMarksByDomain`）：域名按其最近活动倒序；域名内页面按最近活动倒序；页面内 mark 按 `createdAt` 升序。

## 4. 交互

- **打开 `▶`**：在**新标签页**打开该 mark 的页面并定位——复用 All Marks 的机制：`storage.setPendingJump(pageKey, mark)` + `browser.openTab(pageURL)`；目标页 content script 加载时 `consumePendingJump` 定位。
- **单条删除 `🗑`**：有笔记 → 就地两步确认；无笔记 → 直接删（与 popup 一致）。删除后重渲染。
- **批量**：每行复选框 + 域名组头全选框。≥1 勾选 → 顶部操作条出现。`Delete` → 统一确认 "Delete N marks?" → `storage.deleteMarks(refs)` → 清空选择 + 重渲染。`Clear` → 取消所有勾选。
- **搜索**：输入即过滤——保留 名字 / 笔记 / 页面标题 / pageKey 命中（不分大小写）的 mark，空页面/空域名隐藏。过滤只影响展示，不动存储。
- **导出**：`Export` → 读全部数据 → 生成 `{ version:1, exportedAt, pages }` JSON → 用 Blob + 临时 `<a download>` 下载，文件名 `readon-export-YYYY-MM-DD.json`。纯本地。
- **导入**：`Import` → 隐藏 `<input type=file accept=".json">` → 读文本 → `JSON.parse` → 校验/规整 → 按 mark `id` 去重合并写回 → 重渲染 + toast 报告新增数量；解析/格式错误 → 明确报错、不污染已有数据。

## 5. 数据与纯函数

数据模型不变。

- `src/lib/marks.js` 新增纯函数：
  - `domainOf(pageKey)`：返回 pageKey 第一个 `/` 之前的 hostname。
  - `groupMarksByDomain(allData)`：先复用 `groupMarksByPage` 得到页面组，再按 `domainOf(pageKey)` 归并为 `[{ domain, markCount, lastActivity, pages: [页面组按 lastActivity 倒序] }]`，域名按 lastActivity 倒序。
  - `normalizeImport(parsed)`：接受 `JSON.parse` 结果，返回合法的 `pages` 对象或 `null`。规则：取 `parsed.pages`（若无则取 `parsed` 自身），只保留值含 `Array.isArray(marks)` 的条目；无任何合法页面则返回 `null`。
  - `mergeImport(existingAll, importedPages)`：对每个 importedPage 的 pageKey，与 existing 同 pageKey 合并——`existingIds = existing.marks 的 id 集合`，把 importedPage.marks 中 id 不在 existingIds 的追加；`nextSeq = max(existing.nextSeq||1, importedPage.nextSeq||1)`。existing 中未被导入触及的页面原样保留。只输出含 `marks` 数组的页面条目（不含 `_readon_pending_jump` 等）。返回新对象、不可变。
  - `buildExport(allData, now)`：返回 `{ version: 1, exportedAt: now, pages: <仅含 marks 数组的页面条目> }`，纯函数。
- `src/lib/storage.js` 新增：
  - `deleteMarks(refs)`：`refs = [{pageKey, id}]`，按 pageKey 分组，对每页移除对应 id（保留 nextSeq）后写回。
  - `importMerge(importedPages)`：`existing = getAllPageData()` → `marks.mergeImport(existing, importedPages)` → `storageSet(merged)`，返回新增 mark 数量。
- `src/lib/browser.js` 新增：`openOptionsPage()` → `chrome.runtime.openOptionsPage()`。
- `src/lib/icons.js` 新增 Lucide：`search`、`download`、`upload`。

## 6. 入口与文件

- `manifest.json`：新增 `"options_ui": { "page": "src/options.html", "open_in_tab": true }`。
- `src/popup.js`：All Marks 视图底部加"Open full manager"链接，点 → `browser.openOptionsPage()`。
- `src/options.html`：引入 `theme.css` + `options.css`；按依赖序加载 `positioning/marks/browser/storage/time/icons` + `options.js`。
- `src/options.css`：管理页布局（顶栏、搜索、批量条、域名/页面组头、缩进、mark 行、展开 textarea、复选框 `accent-color: var(--accent)`）。复用既有 token，不写裸色。
- `src/options.js`：渲染层级、搜索过滤、勾选/批量、展开/笔记、打开/删除、导入/导出。

`content.js`/`positioning.js`/`time.js` 逻辑不改（复用）。

## 7. 测试策略

- **纯函数单测**（`node:test`）：
  - `marks.domainOf`：`x.com/a/b` → `x.com`；无路径 `x.com` → `x.com`。
  - `marks.groupMarksByDomain`：多域名归并、域名内多页面、排序（域名/页面按最近活动倒序、页内 createdAt 升序）、markCount。
  - `marks.normalizeImport`：`{pages:{…}}`、裸 `{pageKey:pageData}`、非法输入（null/无合法页面）→ null。
  - `marks.mergeImport`：按 id 去重（已存在跳过、新的并入）、新页面整入、nextSeq 取 max、不可变。
  - `marks.buildExport`：version/exportedAt/pages 结构，过滤非页面键。
  - `storage.deleteMarks`：跨页批量删除、nextSeq 不变。
  - `storage.importMerge`：合并写回、返回新增数（mock chrome）。
- 现有单测保持全绿。
- **手动验收**：层级展示（域名/页面/marks）；搜索过滤；勾选 + 批量删除（确认）；有笔记折叠显示预览 + 展开编辑、无笔记仅 ▶🗑；打开新标签页定位；导出下载 JSON；导入合并去重（重复跳过、新增并入）+ 报告；从 popup 入口与扩展选项入口都能打开；浅/深双主题。

## 8. 明确不做（YAGNI）

- 名字二次编辑（设计上不可改）。
- 拖拽排序、标签/分类、云同步。
- 撤销删除（用确认替代）。
- 导出选中项（导出=全部；批量仅删除）。

## 9. 自检

- 完整管理 + 导入导出（范围 A）→ §2/§4。✓
- 域名 › 页面 › marks 三级（用户要求）→ §3 + `groupMarksByDomain`。✓
- 折叠有笔记显示预览 + 展开编辑、无笔记仅 ▶🗑（用户要求）→ §3。✓
- 跨页打开复用 All Marks 机制（无后台 SW）→ §4。✓
- 纯函数可测（分层/合并/导出/批量）→ §5/§7。✓
- chrome.* 收敛 browser.js（新增 openOptionsPage）→ §5。✓
- 复用设计系统 theme.css/icons.js → §6。✓
- 数据模型不变 → §5。✓
