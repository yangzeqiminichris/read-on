# ReadOn UI 重做 · 设计文档（暖色阅读方向）

**日期**：2026-06-26
**状态**：已确认，待进入实现计划
**关联**：在 MVP（master `501bc63`）基础上重做 popup 视觉，并建立可复用的设计系统。前序设计见 `2026-06-26-scroll-bookmark-extension-design.md`。

## 1. 背景与目标

当前 popup 能用但偏 demo 感（系统字体、单一蓝按钮、极简边框）。目标：把视觉提升到产品级，并**建立设计系统地基**（集中的设计令牌 + 组件规范），使后续功能（笔记、All Marks、options 页等）直接继承、无需二次重样式。

**本次范围**：仅重做 popup 视觉 + 新建 `theme.css` 设计令牌 + 新增"创建时间"显示。**行为完全不变**（建 mark / 跳转 / update / 就地改名逻辑不动），不加新功能。现有 27 个单测保持绿。

**明确不做**：笔记、行展开 `⌄`、删除 UI、All Marks、导入导出、options 页（这些后续计划做，但都要继承本设计系统）。

## 2. 设计方向

**暖色阅读**（Readwise / Pocket 路线）：米色纸感 + 赤陶色主色，圆角卡片行，每行带进度条把"读到哪"可视化。契合"陪你读长文档"的产品定位。**浅色 + 深色双主题**，深色为暖棕夜读色调。

## 3. 设计令牌（`src/theme.css`）

所有颜色/间距/圆角/字体收敛为 `:root` 上的 CSS 自定义属性；浅色为默认，深色用 `@media (prefers-color-scheme: dark)` 覆盖同名变量。`popup.html`（及后续 options 页）引入此文件。这是设计系统的单一可改点。

### 3.1 颜色

**浅色（默认）**

| 令牌 | 值 | 用途 |
|---|---|---|
| `--bg` | `#FAF6EF` | 弹窗纸感底 |
| `--surface` | `#FFFFFF` | mark 行卡片 |
| `--border` | `#EFE7DA` | 卡片/分隔 hairline |
| `--border-strong` | `#EADFCF` | 弹窗外框/强调边 |
| `--text` | `#2C2722` | 主文字 |
| `--text-secondary` | `#8A7E6E` | 次要文字 |
| `--text-muted` | `#A89A86` | 时间/百分比/提示 |
| `--accent` | `#C2683C` | 主色（赤陶） |
| `--accent-hover` | `#AD5A30` | 主按钮 hover |
| `--accent-on` | `#FFFFFF` | 主色上的文字/图标 |
| `--track` | `#F0E8DB` | 进度条底槽 |
| `--row-hover` | `#FBF7F0` | 行 hover 底 |

**深色（`prefers-color-scheme: dark`）**

| 令牌 | 值 |
|---|---|
| `--bg` | `#1E1B18` |
| `--surface` | `#29241E` |
| `--border` | `#3A342C` |
| `--border-strong` | `#342F28` |
| `--text` | `#EDE6DA` |
| `--text-secondary` | `#A99E8C` |
| `--text-muted` | `#A99E8C` |
| `--accent` | `#E0875A` |
| `--accent-hover` | `#EC9869` |
| `--accent-on` | `#231A13` |
| `--track` | `#3A332B` |
| `--row-hover` | `#322C25` |

### 3.2 字体

系统字体栈（零打包）：`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif`。
字重仅 **400 / 500**。字号：品牌标题 15px、行名 13px、次要（时间/百分比）11px、按钮 13px。

令牌：`--font-sans`（同上栈）。

### 3.3 间距与圆角

- 间距阶：`--space-1: 4px` / `--space-2: 8px` / `--space-3: 12px` / `--space-4: 16px`。
- 圆角：`--radius-button: 9px` / `--radius-card: 11px` / `--radius-popup: 14px` / `--radius-pill: 99px`。
- 弹窗宽度：**350px**（原 320px）。
- 间距/留白以双主题精修稿为准：头部 padding `13px 15px`、行卡片 padding `11px 13px`、行间距 8px、列表外距 `0 9px 10px`。

## 4. 组件规范

所有组件只用 §3 令牌，不写裸 hex。

- **主按钮（Mark）**：`background: var(--accent)`，`color: var(--accent-on)`，`border-radius: var(--radius-button)`，padding `7px 13px`，13px/500；左侧 `plus` 图标 14px；hover → `--accent-hover`；active `scale(.98)`。
- **幽灵图标按钮（跳转/更新）**：透明底无边，`padding:4px`，hover 底 `--row-hover`，圆角 6px。跳转图标用 `--accent` 着色，更新图标用 `--text-muted`。均带 `aria-label`。
- **mark 行卡片**：`background: var(--surface)`，`border: 1px solid var(--border)`，`border-radius: var(--radius-card)`，padding `11px 13px`，行间距 8px。hover 时底色 `--row-hover`。
- **行内容布局**（左列 flex:1 + 跳转 + 更新 图标）：
  - 第一行：行名（左，13px/500，溢出省略）+ 创建时间（右，11px，`--text-muted`，不换行）。
  - 第二行：进度条（flex:1，高 4px，底 `--track`，填充 `--accent`，`--radius-pill`）+ 百分比（11px，`--text-muted`，min-width 26px）。
- **就地改名输入框**：复用行卡片位置，输入框 `font:inherit`，宽度撑满，`border:1px solid var(--accent)`，圆角 6px。提交行为同 MVP（Enter / 失焦 / 点击别处，原地替换为文本——保留 MVP 已修复的交互）。
- **toast**：底部居中，`background: var(--accent)`，`color: var(--accent-on)`（赤陶主色，贴合暖色调），11–12px，圆角 `--radius-button`，1.5s 自动消失。
- **空状态**：居中，`bookmark-plus` 图标（28px，`--text-muted`）+ 一行邀请文案 "Mark a spot to pick up where you left off."（`--text-secondary`）。
- **受限页状态**：居中灰字 "This page can't be marked."，Mark 按钮置灰。

## 5. 创建时间显示

每行右上角显示 mark 的 `createdAt` 相对时间。逻辑抽成**纯函数** `formatRelativeTime(timestamp, now)`，放 `src/lib/time.js`（UMD，单测覆盖）。

规则（`diff = now - timestamp`）：

| 条件 | 输出 |
|---|---|
| `diff < 60s` | `just now` |
| `diff < 60min` | `N minute ago` / `N minutes ago` |
| `diff < 24h` | `N hour ago` / `N hours ago` |
| `diff < 7天` | `N day ago` / `N days ago` |
| `diff ≥ 7天`，同年 | 具体日期 `Jun 12`（英文月缩写 + 日） |
| `diff ≥ 7天`，跨年 | `Jun 12, 2025` |

- 单复数正确（1 minute ago，2 minutes ago）。
- 月份用固定英文缩写数组（Jan…Dec），不依赖 locale，保证测试确定性。
- 未来时间（`diff < 0`）按 `just now` 处理（容错时钟漂移）。

## 6. 图标（内嵌 Lucide SVG）

supericons MCP 的 `get_icon`/`search_icons` 当前返回 401（server 端鉴权问题），但要用的就是 Lucide 一套，而 Lucide 是 ISC 开源。**直接内嵌官方 Lucide SVG**：`viewBox="0 0 24 24"`、`fill="none"`、`stroke="currentColor"`、`stroke-width="2"`、`stroke-linecap="round"`、`stroke-linejoin="round"`，靠 `currentColor` 继承父色。日后 MCP 修好可同名替换。

放置方式：建 `src/lib/icons.js`（UMD），导出 `icons` 对象（id → SVG 内部 path 字符串）与 `iconEl(id, sizePx)` 工厂，popup 用它生成图标节点（避免 `innerHTML` 注入、合 CSP）。

本次 MVP 需要的图标：

| slot | Lucide id |
|---|---|
| 品牌 | `bookmark` |
| 新建 mark | `plus` |
| 跳转 | `play` |
| 更新位置 | `rotate-cw` |
| 空状态 | `bookmark-plus` |

后续功能预留（本次不内嵌，用到再加）：`chevron-down`（展开）、`trash-2`（删除）、`square-pen`（笔记）、`download`/`upload`（导入导出）。

## 7. 架构与文件改动

- 新增 `src/theme.css`：§3 全部令牌（浅 + 深）。
- 新增 `src/lib/time.js`：`formatRelativeTime`（纯函数，UMD）。
- 新增 `src/lib/icons.js`：Lucide SVG 表 + `iconEl()`（UMD）。
- 重写 `src/popup.css`：改用 `theme.css` 令牌实现 §4 组件，移除裸色值。
- 改 `src/popup.html`：引入 `theme.css`（在 popup.css 前）；脚本顺序加入 `time.js`、`icons.js`（在 popup.js 前）。
- 改 `src/popup.js`：
  - 用 `iconEl()` 渲染品牌/Mark/跳转/更新图标，替换 emoji `▶`/`⟳`。
  - 行渲染改为 §4.行内容布局（含进度条 + `formatRelativeTime(mark.createdAt, Date.now())`）。
  - 空状态/受限态用新样式与图标。
  - **业务逻辑与消息流不变**（建/跳/更新/改名、ensureContentScript、错误 toast 全保留）。
- `manifest.json`：`web_accessible_resources` 无需改（图标内嵌，非独立文件）；content script 不涉及。

数据模型不变（`createdAt` 已存在）。`browser.js`/`storage.js`/`marks.js`/`positioning.js`/`content.js` 不改。

## 8. 测试策略

- **纯函数单测**（`node:test`）：`formatRelativeTime` 覆盖 just now / 分 / 时 / 天的单复数边界、7 天阈值、同年 vs 跨年、未来时间容错。
- 现有 27 个单测**保持全绿**（被改文件 popup/theme/icons 不在单测范围，纯函数库未动）。
- **手动视觉验收**：浅色 + 深色（系统切换）下 popup 渲染正确；图标显示正常（非空白）；建/跳/更新/改名行为照旧；空状态/受限态正确；长行名省略号；时间三种格式正确。

## 9. 自检

- 所有颜色经 CSS 令牌、浅深双主题 → §3 ✓
- 行为不变、不加新功能 → §1、§7 ✓
- 创建时间为纯函数、可测 → §5 ✓
- 图标内嵌 Lucide、CSP 安全、无远程依赖 → §6 ✓
- 设计系统可被后续功能复用（theme.css + icons.js）→ §7 ✓
