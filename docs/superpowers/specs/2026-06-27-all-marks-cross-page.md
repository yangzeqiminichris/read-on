# ReadOn · All Marks 跨页面视图 设计文档

**日期**：2026-06-27
**状态**：已确认，待进入实现计划
**关联**：在 master `ba9fb19`（笔记/展开/删除已完成）基础上扩展。复用 `theme.css` 令牌、`icons.js`、定位算法、行 UI。前序设计见 `2026-06-26-scroll-bookmark-extension-design.md`（§6⑤ + §7 跨页面跳转）。

## 1. 背景与目标

强化"续读"核心的最后一块：在弹窗内查看**所有页面**的 mark，跨文档跳转续读。原本每次只能看当前页的 mark；同时读多篇文档时需要一个总览。

**范围**：弹窗内 All Marks 视图（只读浏览 + 跨页面跳转）。**不含**：导入导出、options 全屏管理页（后续计划；本设计不放"打开管理页"入口）。

## 2. 视图切换（并入头部）

不再用单独一行的分段控件（冗余）。头部一行：
- 左：`🔖 ReadOn`（bookmark 图标 + 标题）。
- 右：**`[+ Mark]` 在前（主功能），`[All marks]` 在后**。
  - `+ Mark`：主按钮（赤陶实心），始终可见，永远标记**当前页**。
  - `All marks`：次级 toggle 按钮（幽灵/浅色）。点击切到全部视图并高亮（`--bg-accent` 浅赤陶底 + accent 文字 + accent 边）；再点回本页视图。

两个视图：
- **本页视图（默认）**：现有当前页 marks 列表（建/跳/更新/改名/展开-笔记-删除，全部不变）。
- **All Marks 视图**：见 §3，只读 + 跨页面跳转。

popup 内存 `view` 状态（`'page' | 'all'`），切换时重渲染。

## 3. All Marks 视图

**按页面分组**（pageKey）：
- 组头：小地球图标（`globe`，`--text-muted`）+ 页面标题（13px/500，省略）+ 网址（10px，`--text-muted`，省略）。无 favicon（纯本地、无远程请求）。
- 组内每个 mark 一行（**只读**）：
  - 名字（13px/500）+ 最后更新时间（右上，`formatRelativeTime(updatedAt)`）。
  - 进度条 + %（同现有）。
  - 若 `note` 非空：下方一条**笔记预览**（小 `square-pen` 图标 + 笔记首行，单行截断，`--text-muted`）。
  - 右侧仅 **`▶` 跳转**（无 `⌄` 展开、无 `⟳` 更新——编辑/删除回本页视图做）。

**排序**（纯函数 `marks.groupMarksByPage`，见 §5）：
- 组间：按"最近活动"（组内 `max(updatedAt)`）倒序。
- 组内：按 `createdAt` 升序（接近阅读顺序）。
- 跳过 0 mark 的页面；组的标题/网址取组内最近更新那个 mark 的 `pageTitle`/`pageURL`。

空态（无任何 mark）：复用空状态文案。

## 4. 跨页面跳转机制

不引入后台 service worker。点 All Marks 里某 mark 的 `▶`：

- **同页面**（`mark.pageKey === 当前标签页 pageKey`）：直接走现有路径——`ensureContentScript` + 发 `READON_SCROLL_TO`，然后 `window.close()`。
- **跨页面**：
  1. popup 写一条"待跳转"记录到 `chrome.storage.local`：`storage.setPendingJump(mark.pageKey, mark)` → 存 `{ pageKey, mark, ts }` 于保留键 `_readon_pending_jump`。
  2. popup 调 `browser.navigateTab(currentTabId, mark.pageURL)`（= `chrome.tabs.update`）把当前标签页导航过去。
  3. `window.close()`。
  4. 目标页加载后，**content script（声明式自动注入）在 init 时消费待跳转**：读 `_readon_pending_jump`，若 `pageKey` 匹配本页且未过期（`Date.now()-ts < 30000`）→ 先清除该记录 → **等内容高度稳定**（短轮询）→ `scrollToMark(record.mark)`。不匹配/过期则忽略（过期的清掉）。

**等高度稳定**（content.js）：每 150ms 读 `document.documentElement.scrollHeight`，连续 2 次不变或超过 ~3s（20 次）即认为稳定，再滚动。应对懒加载/异步内容导致的高度漂移。

边界：
- 目标页若一直没被导航到 → 记录 30s 后过期，或下次匹配页加载时被消费/清除。
- pageKey 匹配确保只有正确的页面消费，不会跳错。

## 5. 数据与纯函数

数据模型不变。mark 已含 `pageKey`/`pageURL`/`pageTitle`/`createdAt`/`updatedAt`/`note`。

- `src/lib/marks.js` 新增纯函数 `groupMarksByPage(allData)`：
  - 入参：`allData` = `{ [pageKey]: pageData }`（可能混入非 pageData 键，如待跳转键——靠 `Array.isArray(pd.marks)` 过滤）。
  - 返回：`[{ pageKey, pageTitle, pageURL, marks: [按 createdAt 升序], lastActivity }]`，按 `lastActivity`（组内 max updatedAt）倒序；跳过空组。
  - 纯函数、可单测。
- `src/lib/storage.js` 新增：
  - `getAllPageData()` → `browser.storageGet(null)`（返回整个本地存储对象；分组前由 `groupMarksByPage` 过滤非 pageData 键）。
  - `setPendingJump(pageKey, mark, now)` → `storageSet({ _readon_pending_jump: { pageKey, mark, ts: now } })`（`now` 默认 `Date.now()`，便于测试）。
  - `getPendingJump()` → 读 `_readon_pending_jump`，返回记录或 `null`。
  - `clearPendingJump()` → `browser.storageRemove('_readon_pending_jump')`。
- `src/lib/browser.js` 新增：
  - `storageRemove(key)` → `chrome.storage.local.remove(key)`。
  - `navigateTab(tabId, url)` → `chrome.tabs.update(tabId, { url: url })`。

## 6. 文件改动

- `manifest.json`：content_scripts 的 `js` 增加 `src/lib/marks.js`、`src/lib/browser.js`、`src/lib/storage.js`（在 `src/content.js` 前），使 content script 能用 `window.ReadOn.{marks,browser,storage}` 消费待跳转。顺序：positioning → marks → browser → storage → content。
- `src/content.js`：init（幂等 guard 之后）调用 `consumePendingJump()`：用 `marks.pageKeyFromURL(location.href)` 比对 `storage.getPendingJump()`，匹配且未过期则等高度稳定后 `scrollToMark` 并 `clearPendingJump`。
- `src/lib/icons.js`：新增 `globe`（组头）、`list`（All marks 按钮）。
- `src/popup.html`：头部结构调整为 `[+ Mark] [All marks]`；其余容器复用。
- `src/popup.css`：头部按钮组、All marks toggle 激活态、组头 `.group-head`、只读行（无展开/更新）、笔记预览 `.note-preview`。
- `src/popup.js`：`view` 状态 + 切换；`renderAll()` 渲染分组只读列表；`jumpTo(mark)` 区分同页/跨页；本页视图渲染保持不变。

`positioning.js`/`time.js` 不改（复用）。

## 7. 测试策略

- **纯函数单测**（`node:test`）：
  - `marks.groupMarksByPage`：多页分组、组内 createdAt 升序、组间 lastActivity 倒序、跳过空组与非 pageData 键、组标题取最近 mark。
  - `storage.setPendingJump`/`getPendingJump`/`clearPendingJump`：写入结构含 ts、读取、清除（mock chrome，含 `remove`）。
  - `storage.getAllPageData`：返回全部、含多页。
- 现有单测保持全绿。
- **手动验收**：切换 This page/All marks；多页分组正确、一页多 mark 显示多行；笔记预览显示；跨页面跳转（导航 + 等稳定 + 定位）；同页跳转直接滚动；目标页懒加载时定位仍准；浅/深双主题。

## 8. 明确不做（YAGNI）

- 后台 service worker（用 storage 待跳转替代）。
- favicon（无远程请求）。
- All Marks 内编辑笔记/删除/更新（回本页视图做）。
- 搜索、批量操作、options 页入口（后续计划）。

## 9. 自检

- 视图切换并入头部、+Mark 在前 → §2。✓
- 一页多 mark = 组头下多行；只读 + 笔记预览 + ▶ → §3。✓
- 跨页面跳转无需 SW，content script 消费待跳转 + 等高度稳定 → §4。✓
- 分组/排序为纯函数可测；待跳转/全量读取在 storage 层可测 → §5/§7。✓
- chrome.* 仍收敛在 browser.js（新增 storageRemove/navigateTab）→ §5。✓
- 数据模型不变 → §5。✓
