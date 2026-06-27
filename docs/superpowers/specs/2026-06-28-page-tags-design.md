# Page Tags (Cross-Domain Thematic Grouping) — Design

**Date:** 2026-06-28

## Problem

Marks are currently organized only by domain (domain → page → marks). As marks accumulate, users want to group pages **thematically across domains** (e.g. collect a LangChain doc, a Zhihu article, and a GitHub repo all under "LangChain"). Domain grouping fundamentally cannot express this.

## Solution Summary

Add **page-level tags**. A page can carry up to **3 tags**. Tags are multi-assignment (a page can be under several tags at once) and live entirely in the **full manager (options page)** for v1. A new **By tag** view groups tag → page → marks alongside the existing **By domain** view.

## Decisions (settled during brainstorming)

- **Mechanism:** tags (multi-assignment), not exclusive folders.
- **Granularity:** page-level. Tags attach to `pageKey`; all marks under a page share its tags.
- **Limit:** max 3 tags per page.
- **Scope:** full manager (options page) only. Popup unchanged in v1.
- **Export/import:** tags are NOT included in export in v1 (consistent with aliases; keeps export format unchanged). Possible follow-up.
- **Global tag management:** no separate rename/delete-tag UI in v1. Tags are added/removed on the page header; a tag disappears from the universe when no page references it.

## Data Model

New storage key `_readon_tags` (a `_readon_`-prefixed non-pageData key, like `_readon_aliases`; never enters the mark model or export):

```js
_readon_tags = { pages: { "github.com/user/repo": ["LangChain", "待读"] } }
```

- The **tag universe** is derived as the sorted, de-duplicated union of all values — no separate registry.
- Tag names are trimmed; empty strings rejected. Duplicate tag on the same page is a no-op. Case-sensitive match (treat "AI" and "ai" as distinct — simplest, predictable).

### storage.js additions

- `getTags()` → `{ pages: { [pageKey]: string[] } }` (normalizes missing key to `{ pages: {} }`).
- `getAllTags()` → `string[]` sorted union of all assigned tag names.
- `addPageTag(pageKey, tag)` → adds trimmed tag if not present and the page has < 3 tags. Returns `true` on success, `false` if rejected (empty / duplicate / already 3).
- `removePageTag(pageKey, tag)` → removes tag from that page; deletes the page entry when its array becomes empty; deletes the whole `_readon_tags` write cleanly.

### marks.js additions (pure functions, unit-tested)

- `groupMarksByTag(allData, tags)` → returns an array of tag groups:
  ```js
  [{ tag: "LangChain", pages: [ <pageGroup>, ... ], markCount: N }, ...]
  ```
  - Reuses existing `groupMarksByPage(allData)` to build page groups, then buckets each page group into each of its tags (`tags.pages[pageKey]`).
  - Pages with no tags collect into a final group with `tag: null` (rendered as "Untagged").
  - Tag groups are ordered alphabetically by tag name; the `null`/Untagged group is always last.
  - Within a tag group, pages keep `groupMarksByPage`'s ordering (recent activity first).
  - `markCount` is the sum of marks across the group's pages.

## UI (options page)

### View toggle

Add a **By domain / By tag** segmented toggle on the existing toolbar row (the row that currently holds Collapse All / Expand All), to the left of those buttons. Default **By domain** (current behavior). Module state `view = 'domain' | 'tag'`.

- **By domain:** unchanged — `groupMarksByDomain`.
- **By tag:** `groupMarksByTag(allData, tags)` → renders **tag header › page header › mark rows**, using the same collapsible behavior, fixed layout, and Collapse/Expand toolbar as the domain view. A page with multiple tags appears once under each of its tag headers.

### Tag header (`tagHead`) — By tag view only

Mirrors `domainHead` structure: a tag icon + tag name + page/mark count + collapse chevron + whole-row click to collapse. The Untagged group shows label "Untagged" in muted style. No checkbox/rename on the tag header in v1.

### Tag assignment on the page header (`pageHead`) — both views

Extend the existing `pageHead` (which already has alias + rename button):

- Render the page's current tags as small **chips**, each with an `×` to remove (`removePageTag` → `reload`).
- An **`+ Tag`** button opens a small inline input with a `<datalist>` suggesting existing tag names (`getAllTags()`). Enter / blur commits via `addPageTag` → `reload`. Escape cancels.
- When the page already has **3 tags**, the `+ Tag` button is hidden.
- Clicking chips / `×` / `+ Tag` / the input must NOT toggle row collapse — covered by the existing `e.target.closest('button, input')` guard; chips' `×` are buttons, the add-input is an input. The chip container itself should also stop the row-collapse click (guard already excludes non-button/input, so make `×` a `<button>` and the add control an `<input>`/`<button>`).

### Collapse state

Separate in-memory collapse Sets per view so switching views doesn't cross-contaminate:
- domain view: existing `collapsedDomains` / `collapsedPages`.
- tag view: new `collapsedTags` (keyed by tag name, with `null`→a sentinel like `"untagged"`) and reuse `collapsedPages` for page-level (a page collapses independently of which tag header it sits under — acceptable; same pageKey collapsed in all its tag groups). If per-tag-instance page collapse is desired later, revisit; v1 keeps it simple with shared `collapsedPages`.

### Search interaction

`filteredData()` applies in both views. While searching, ignore collapse state and expand everything, and hide the Collapse/Expand toolbar — identical to current behavior. The view toggle remains visible while searching.

## Components / Files

- `src/lib/storage.js` — add `getTags`, `getAllTags`, `addPageTag`, `removePageTag`.
- `src/lib/marks.js` — add `groupMarksByTag`.
- `src/options.js` — view toggle state + rendering, `tagHead`, tag chips + add-tag control on `pageHead`, `collapsedTags`.
- `src/options.css` — view toggle, tag chips, add-tag control, tag header styles.
- `src/options.html` — view-toggle markup in the toolbar row.
- `test/marks.test.js` — `groupMarksByTag` cases.
- `test/storage.test.js` — tag add/remove/limit cases (if storage has existing test patterns to follow).

## Error / Edge Handling

- Adding a 4th tag: `addPageTag` returns `false`; UI already hid the button, so this is defense-in-depth.
- Removing the last tag of a page: page entry deleted from `_readon_tags.pages`.
- A tag referenced by zero pages vanishes from `getAllTags()` and the By tag view automatically.
- Empty / whitespace-only tag input: rejected, no-op.
- By tag view with no tags anywhere: every page falls into the Untagged group (single group). Toolbar still works.

## Testing

- Pure-function `groupMarksByTag`: empty data; single page multiple tags (appears in each group); cross-domain pages sharing one tag; untagged pages bucketed last; alphabetical tag ordering; markCount correctness.
- storage tag ops can be covered if the existing storage tests use a mockable `browser` layer; otherwise rely on the pure-function tests + manual verification.

## Out of Scope (v1)

- Popup tag UI / by-tag view.
- Tags in export/import.
- Global tag rename/delete management screen.
- Tag colors, drag-and-drop, per-tag-instance page collapse.
- Sorting (separate future feature).
