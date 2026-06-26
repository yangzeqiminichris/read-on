# ReadOn · 行展开 + 删除 + 笔记 设计文档

**日期**：2026-06-26
**状态**：已确认，待进入实现计划
**关联**：在 UI 重做（master `181ebeb`，暖色阅读）基础上扩展。复用 `theme.css` 令牌、`icons.js`、`time.js`。前序：`2026-06-26-scroll-bookmark-extension-design.md`（§6② 已勾画此交互）、`2026-06-26-ui-redesign-warm-reading.md`。

## 1. 背景与目标

补齐两个缺口：(1) 目前**没有删除功能**——连轻量党都需要删掉建错的 mark；(2) **笔记党核心**——在 mark 上写心得。交互上给每个 mark 行加"展开"，展开后露出创建/更新时间、笔记编辑、删除。直接在现有暖色阅读行 UI 上扩展。

**范围**：仅 popup 当前页面 marks 的行展开 / 笔记 / 删除。**不含**：All Marks 跨页面、导入导出、options 页（后续计划）。

## 2. 交互设计

### 2.1 行展开

- 每个 mark 行的图标区在 `▶ 跳转`、`⟳ 更新` 之后新增第三个 **`⌄` 展开按钮**（`chevron-down`）。展开时图标旋转 180°朝上（CSS `transform: rotate(180deg)`，不另加图标）。
- 展开状态保存在 popup 内存 `expandedIds`（Set）。`render()` 读取它——因此点 `⟳` 更新触发的重渲染后，已展开的行保持展开。
- 允许多行同时展开（各自独立 toggle，非手风琴）。

### 2.2 展开面板（卡片内、`meta` 下方）

顶部 1px 分隔线（`border-top: 1px solid var(--border)`）。自上而下：

1. **时间行**（11px，`--text-muted`）：`Created {formatDateTime(createdAt)}`；当 `updatedAt !== createdAt` 时追加 ` · Updated {formatRelativeTime(updatedAt, now)}`。
2. **笔记 textarea**：宽度撑满，`placeholder="Add a note…"`，底色 `var(--bg)`（白卡上呈内陷），`border: 1px solid var(--border)`，圆角 8px，`resize:none`，min-height ≈ 48px，12px 字。**失焦（blur）自动保存** → `storage.setNote(pageKey, id, value)`；保存只持久化、**不重渲染**（保持焦点与展开态）。同时更新内存中 `mark.note`，使下次渲染的折叠标记正确。
3. **删除区**（右对齐）：`🗑 Delete`（`trash-2` 图标 + 文字，`--danger` 色，透明底）。点击 → **就地两步确认**：该区域替换为 `Delete this mark?` + `Cancel` + `Delete`（确认按钮 `background: var(--danger)`、`color: var(--danger-on)`）。点 Cancel 还原；点 Delete → `storage.deleteMark(pageKey, id)` → `render()`。

### 2.3 折叠态笔记标记

行折叠且 `note` 非空时，名字右侧紧跟一个小 `✎`（`square-pen`，12px，`--text-muted`，`title="Has note"`）。展开时不显示该标记（面板里已有笔记）。

## 3. 数据与存储

数据模型不变：`mark` 已含 `note`（默认 `''`）、`createdAt`、`updatedAt`。

- `src/lib/marks.js`：已有纯函数 `removeMark(pageData, markId)`（保留 `nextSeq`、已被测）——复用，不改。
- `src/lib/storage.js` 新增（均 async、经 `browser` wrapper，可用 mock chrome 单测）：
  - `deleteMark(pageKey, markId)`：读 pageData → `marks.removeMark` → 写回。
  - `setNote(pageKey, markId, note)`：读 pageData → 把该 mark 的 `note` 置为传入值（其余字段不动，**不改 `updatedAt`**，与 `setMarkName` 一致）→ 写回。
- `src/lib/time.js` 新增纯函数 `formatDateTime(timestamp, now)`：绝对日期时间，确定性、不依赖 locale。
  - 同年：`Jun 12, 14:30`；跨年：`Jun 12, 2025, 14:30`。
  - 月份用既有 `MONTHS` 缩写数组；时:分为 24 小时制、两位零填充（`getHours`/`getMinutes`）。

## 4. 设计系统扩展

- `src/theme.css` 新增令牌：
  - 浅色：`--danger: #B23B3B`、`--danger-on: #FFFFFF`。
  - 深色：`--danger: #E06B6B`、`--danger-on: #231A13`。
- `src/lib/icons.js` 新增官方 Lucide（同既有规范：`viewBox 0 0 24 24`、stroke currentColor）：
  - `chevron-down`：`<path d="m6 9 6 6 6-6"/>`
  - `trash-2`：`<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>`
  - `square-pen`：`<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>`
- `src/popup.css` 新增样式：`.icon-btn.expand`（含展开旋转 `.mark-row.expanded .icon-btn.expand svg { transform: rotate(180deg); }`）、`.row-detail`（分隔线 + 间距）、`.detail-meta`、`.note-input`（textarea）、`.row-delete`/`.delete-confirm`、`.danger-btn`、`.name-note-flag`（折叠笔记标记）。

## 5. popup.js 改动

- 顶部维护 `const expandedIds = new Set();`。
- `renderRow(mark, editing)`：
  - 名字区：折叠且 `mark.note` 非空时，名字后追加 `✎`（`icons.el('square-pen', 12)`，套 `.name-note-flag`）。
  - 图标区追加 `expand` 按钮（`chevron-down`，`aria-label` "Expand"/"Collapse"），点击：`expandedIds.has(id) ? delete : add` 后 `render()`（保持其它行展开态）。
  - 若 `expandedIds.has(mark.id)`：`li.classList.add('expanded')` 并 append `.row-detail` 面板（时间行 + textarea + 删除区）。
    - textarea：`addEventListener('blur', …)` → `storage.setNote` + `mark.note = value`（不 render）。
    - 删除按钮：点击进入两步确认（替换删除区内容为确认 UI）；Delete → `await storage.deleteMark(...)` → `render()`；Cancel → 还原删除区。
- `render(editId)` 不变（仍重建列表），但渲染时依据 `expandedIds` 决定每行是否展开。
- 业务逻辑（capture/ensureContentScript/跳转/更新/改名）保持不变。

## 6. 边界处理

- 删除后列表为空 → 显示既有空状态。
- 笔记很长 → textarea 固定 min-height，内部滚动（`overflow:auto`）；折叠标记只表"有无"，不预览全文。
- `setNote` 写入空字符串（清空笔记）合法 → 折叠标记随之消失（下次渲染）。
- 同一行边编辑名字边展开：改名为 `row-top` 内的就地输入（既有），展开面板独立于其下，互不冲突。

## 7. 测试策略

- **纯函数单测**（`node:test`）：
  - `time.formatDateTime`：同年、跨年、零填充（如 09:05）。
  - `storage.deleteMark`：删除后 pageData.marks 不含该 id、`nextSeq` 不变（防复用）。
  - `storage.setNote`：只改 `note`，不动 `name`/`createdAt`/`updatedAt`；清空亦可。
- 现有单测保持全绿。
- **手动验收**：展开/折叠（含 `⟳` 后保持展开）；笔记输入失焦自动保存、重开仍在；折叠态 `✎` 标记随有无笔记出现/消失；删除两步确认（Cancel/Delete）；删空显示空状态；浅/深双主题下面板、危险色、textarea 正常。

## 8. 明确不做（YAGNI）

- 笔记 Markdown / 富文本（纯文本）。
- 删除撤销（用两步确认替代）。
- 笔记折叠预览全文（只标"有无"）。
- 跨页面 / 导出（后续计划）。

## 9. 自检

- 删除（基础缺口）+ 笔记（笔记党核心）均覆盖 → §2。✓
- 复用既有 `removeMark`、`theme.css`、`icons.js`、`time.js` → §3/§4。✓
- 纯函数可测（formatDateTime / deleteMark / setNote）→ §7。✓
- 数据模型不变、业务逻辑不变 → §3/§5。✓
- 设计系统继续扩展（--danger + 3 图标）供后续复用 → §4。✓
