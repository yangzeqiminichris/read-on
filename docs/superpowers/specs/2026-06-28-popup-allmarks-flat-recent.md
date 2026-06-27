# ReadOn popup All marks 改版：扁平页面卡片 + 最近优先

日期：2026-06-28
状态：已确认（用户逐项确认通过）

## 背景与动机

popup 的 All marks 视图目前是 **域名 › 页面 › marks 两级可折叠 + Collapse/Expand 工具栏**（2026-06-28 HEAD `395fd58`）。对一个 350px 的快速续读弹窗来说这套交互过重：用户要"先找域名、再展开、再找页面"才能续读，且把 full manager 的归类能力缩水搬进了 popup，两边职责糊在一起。

定位拆分：
- **popup = 快速续读入口**——打开、扫一眼、点 ▶ 跳回去。
- **full manager = 整理/检索/批量**——域名分组、搜索、批量删除都留在这里。

ReadOn 的核心痛点是"上次读到哪"，用户最可能想续的就是最近动过的那一页。所以 popup All marks 改成**扁平的页面卡片列表，按最近活动倒序**。

## 范围

只改 popup 的 **All marks 视图**。不动：
- popup 默认视图（当前页 marks 续读闭环）。
- full manager（`options.*`，保留域名 › 页面 › marks 三级 + 搜索 + 批量）。

## 设计

### 结构（扁平页面卡片）

- 不再调用 `marks.groupMarksByDomain`；改成「页面卡片」平铺。
- **砍掉**域名分组层 + Collapse All / Expand All 工具栏（`#all-toolbar`）。
- 每个页面卡片默认**折叠**，露出：页面 header + 该页**最近更新的那一个 mark**（代表行）。
- 点页面 header 切换展开；展开后该页所有 marks **按正序（seq 升序）**铺开。
- 底部 "Open full manager" 固定在 footer，保持不变。

### 页面 header（一行）

`chevron` + `globe` 图标 + 页面标题（有别名用别名，`marks.aliasOr`）+ 右侧 `N marks · 相对时间`。

- 相对时间 = 该页最近活动时间（`formatRelativeTime(latestAt)`）。
- **不显示完整 url**（url/域名归类去 full manager 看），保持轻量。

### 排序

- **页面间**：按该页 `max(updatedAt across its marks)` 倒序（最近动的页在最上）。
- **页内**：正序（seq 升序），与各 mark 在页面里看到的顺序一致。
- 折叠态露出的代表 mark = 该页 `updatedAt` 最大的那条（方案 A）。

### mark 行

复用现有 All marks 只读行样式：名字 + 进度条 + % + ▶。
- ▶ 行为不变：本页 mark 当前页滚动；跨页 mark 走 `browser.openTab` + `jumpToNewTab`（写 `_readon_pending_jump`，目标页 content script 加载时 `consumePendingJump`）。
- 折叠态的代表行同样可点 ▶。
- **笔记预览（灰字）只在展开后的行显示**；折叠代表行不显示笔记预览，保持轻。

## 实现

### 纯函数（可测）

新增 `marks.groupMarksByPageRecent(pageData)`：
- 输入：`storage.getAllPageData()` 的返回（各页面 + 其 marks + 页面元信息）。
- 输出：按最近活动倒序的页面数组，每项含：
  - `latestAt` = 该页 marks 的 `max(updatedAt)`
  - `marks` = 该页 marks，按 seq 升序
  - `recentMark` = 该页 `updatedAt` 最大的 mark（代表行用）
  - 页面元信息（url、title、domain，供 header / 跳转用）
- 不修改 mark 模型、不影响导出。
- 至少覆盖：多页排序、页内 seq 正序、recentMark 选取、单 mark 页、空数据。

### popup.js

- All marks 渲染改用 `groupMarksByPageRecent`。
- 删除域名折叠相关：`collapsedDomains`、`currentDomains`、Collapse/Expand 工具栏 DOM 与逻辑。
- 保留页面级折叠：`collapsedPages`（模块级 `Set`，纯内存，关弹窗即重置）。
- 页面 header 点击切换 `collapsedPages`（守卫 `e.target.closest('button')` 跳过 ▶ 等）。

### popup.html / popup.css

- 移除 `#all-toolbar` 静态 DOM。
- 页面卡片 / 代表行 / 展开行样式复用现有 All marks 只读行 + theme.css 令牌。
- 固定布局（header 固定上、footer 固定下、`#scroll` 只滚列表）保持不变。

### 复用，不新增

- theme.css 令牌、icons.js（globe / chevron / player-play 等）复用，不新增令牌或图标。

## 替用户定的两个小决定（已确认）

- a) popup 不显示完整 url（只标题 + globe）——更轻。
- b) 折叠代表行不显示笔记预览，展开才显示。

## YAGNI / 不做

- 不在 popup 加搜索、域名分组、批量操作（全在 full manager）。
- 不动 full manager 的两级折叠与排序。
- 工具栏曾提过的"排序功能"不在本次范围。
