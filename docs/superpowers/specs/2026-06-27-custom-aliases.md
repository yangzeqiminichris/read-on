# ReadOn · 域名/链接自定义别名 设计文档

**日期**：2026-06-27
**状态**：已确认，待进入实现计划
**关联**：在 `options-manager` 分支（未合并，全屏管理页）基础上扩展。复用 theme.css/icons.js/storage/marks。前序：`2026-06-27-options-manager.md`、`2026-06-27-all-marks-cross-page.md`。

## 1. 背景与目标

默认的网站名/页面标题对部分用户区分度不够。允许给**域名**和**链接（页面）**起自定义别名（如把 `python.langchain.com` 标成"LangChain 文档"、把某页标成"入门那篇"），更好辨认。

**范围**：别名的存储 + 在 options 页编辑 + 在 options/All Marks 显示。不改 mark 数据模型。

## 2. 数据

新增 `chrome.storage.local` 保留键 `_readon_aliases`：

```text
_readon_aliases: {
  domains: { [domain]: alias },     // domain = pageKey 第一个 '/' 前部分
  pages:   { [pageKey]: alias },
}
```

- 别名为空白（trim 后为空）→ 删除该条（回退默认）。
- 此键不含 `marks` 数组，故被现有 `onlyPages`/`groupMarksBy*` 的 `Array.isArray(marks)` 过滤天然忽略，不污染分组/导出。
- 导入导出：本设计**不**把别名纳入导出文件（导出仍只含 pages；别名是本机个人标注）。YAGNI；日后可加。

## 3. 显示规则（方案 A）

- **有别名**：别名为主（原字号/字重），其下一行用 `--text-muted` 小字显示原名：
  - 域名头：原名 = 域名（如 `python.langchain.com`）。
  - 页面头：原名 = 页面标题 + ` · ` + pathname（与现状一致）。
- **无别名**：照常显示原名为主；旁边一个**淡色 ✎**（`--text-muted` 再淡一档，用 `square-pen`）提示可命名。
- 解析用纯函数 `marks.aliasOr(map, key, fallback)`：`map[key]` 经 trim 非空则用之，否则 `fallback`。

## 4. 编辑交互（仅 options 页）

- options 页**域名头**与**页面头**名字旁加 `square-pen` ✎ 按钮。
- 点 ✎ → 名字区就地变输入框，预填当前别名（无则空），下方仍显示原名作提示。
- 保存：Enter 或失焦 → trim 后 `setDomainAlias`/`setPageAlias`（空字符串 → 清除该别名）→ 重渲染。
- 取消：Esc → 还原，不保存。
- 复用既有就地编辑手感（参考 popup 改名：捕获阶段 mousedown 兜底提交，避免 popup 环境 blur 不可靠——但 options 是普通页面，blur 可靠，直接用 blur + Enter + Esc 即可）。

## 5. 使用范围

- **options 页**：域名头显示域名别名（可编辑）；页面头显示页面别名（可编辑）。
- **All Marks（popup）**：页面分组头显示**页面别名**（有则用，`groupHeadEl` 处解析），**只读**（保持 popup 简洁，不在此编辑）。域名别名 popup 不涉及（无域名头）。
- 本页视图（popup 当前页 marks）：不涉及（无分组头）。

## 6. 新增 / 改动

- `src/lib/marks.js` 新增纯函数 `aliasOr(map, key, fallback)`：`map && typeof map[key]==='string' && map[key].trim() ? map[key] : fallback`。
- `src/lib/storage.js` 新增（mock chrome 可测）：
  - `getAliases()` → 读 `_readon_aliases`，缺省返回 `{ domains:{}, pages:{} }`。
  - `setDomainAlias(domain, alias)` / `setPageAlias(pageKey, alias)`：读现有 → 设/删该条（trim 空则 `delete`）→ 写回。
- `src/options.js`：渲染前 `aliases = await storage.getAliases()`；`domainHead`/`pageHead` 用 `marks.aliasOr` 决定主名 + 原名小字 + ✎ 编辑；编辑保存后 `reload`（reload 内重新取 aliases）。
- `src/options.css`：别名主名/原名小字（`.alias-sub`）、✎ 按钮（`.rename-btn`，无别名时更淡 `.empty`）、编辑输入（复用 `.name-input` 风格）。
- `src/popup.js`：All Marks `groupHeadEl` 用 `aliases.pages` 解析页面别名（renderAll 先取 `storage.getAliases()` 传入）。
- `src/popup.css`：分组头若显示别名 + 原名小字，复用/新增小字样式。

不改 mark 数据模型；`content.js`/`positioning.js`/`time.js`/`icons.js`（已有 square-pen）不改。

## 7. 测试策略

- **纯函数单测**：`marks.aliasOr`（有值/空白/缺失/非字符串 → fallback）。
- **storage 单测**（mock chrome）：`getAliases` 缺省结构；`setDomainAlias`/`setPageAlias` 设置、覆盖、空字符串清除、与另一类互不干扰。
- 现有单测保持全绿。
- **手动验收**：options 域名/页面起别名 → 别名为主 + 原名小字；清空别名回退默认；Esc 取消；All Marks 页面头显示页面别名（只读）；浅/深双主题；导出文件不含别名、导入不受影响。

## 8. 明确不做（YAGNI）

- 别名纳入导出/导入（个人本机标注，暂不分享）。
- 在 popup 里编辑别名（仅 options 编辑）。
- 域名别名在 All Marks 显示（All Marks 无域名头）。
- 别名搜索（搜索仍按名字/笔记/标题/网址；可后续把别名并入搜索域）。

## 9. 自检

- 域名 + 链接均可起别名、可编辑（用户要求）→ §4/§5。✓
- 别名为主 + 原名小字（方案 A，用户确认）→ §3。✓
- 编辑 ✎ 语义正确（真编辑用铅笔）→ §4。✓
- 数据隔离、不污染分组/导出 → §2。✓
- 纯函数/storage 可测 → §6/§7。✓
- 复用 theme.css/icons(square-pen) → §6。✓
