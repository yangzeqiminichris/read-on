# All Marks — Two-Level Collapsible View

**Date:** 2026-06-27

## Summary

Redesign the "All Marks" popup view from a flat page-grouped list into a two-level collapsible hierarchy (domain → page → marks), with a toolbar for collapse-all / expand-all.

## Scope

Only `popup.js`, `popup.css`, and `popup.html` are changed. No storage, content script, or options page changes.

## Data Layer

`marks.groupMarksByDomain(allData)` already exists in `src/lib/marks.js` and returns:

```js
[{ domain, markCount, lastActivity, pages: [{ pageKey, pageTitle, pageURL, marks, lastActivity }] }]
```

Switch `renderAll` from `groupMarksByPage` to `groupMarksByDomain`.

## State

Add two Sets to popup.js module scope (alongside existing `expandedIds`):

```js
const collapsedDomains = new Set(); // domain strings
const collapsedPages   = new Set(); // pageKey strings
```

- When a domain is collapsed, its pages and marks are not rendered.
- When a page is collapsed, its marks are not rendered.
- Domain collapse takes priority — no need to track page state while domain is collapsed.

## Rendered Structure (All Marks view)

```
[toolbar li]  [Collapse All btn]  [Expand All btn]
[domain-head li]  ▶ github.com  (7 marks)
  [page-head li]  ▶ /user/repo  (2 marks)
    [mark-row li]
    [mark-row li]
  [page-head li]  ▶ /user/repo2  (1 mark)
    [mark-row li]
[domain-head li]  ▶ medium.com  (2 marks)
  ...
[manager-link li]  Open full manager
```

## Components

### Toolbar (`<li class="all-toolbar">`)

- Rendered as first child of `<ul id="mark-list">` when view is `'all'`.
- Two buttons: **Collapse All** and **Expand All**.
  - Collapse All: adds all domain keys to `collapsedDomains`, clears `collapsedPages`, re-renders.
  - Expand All: clears both Sets, re-renders.
- Uses existing `icon-btn` style with text labels.

### Domain Header (`<li class="domain-head">`)

- Left: rotating chevron icon (▶ closed, ▼ open).
- Center: domain string (e.g. `github.com`), mark count badge.
- Entire row is clickable — toggles `collapsedDomains`.
- CSS: `domain-head--collapsed` class rotates chevron back to ▶.

### Page Header (`<li class="page-head">`)

- Reuses existing `groupHeadEl` structure but adds a chevron button.
- Left: globe icon + alias/title/pageKey (existing logic).
- Right: chevron button, toggles `collapsedPages` for this pageKey.
- Hidden when parent domain is collapsed.

### Mark Rows

- `allMarkRow` unchanged (jump-to-new-tab, note preview, bar).
- Hidden when parent domain or page is collapsed.

## CSS

- `.all-toolbar` — flex row, padding matches list padding, gap between buttons.
- `.domain-head` — similar to `.group-head` but bolder; full-width clickable; chevron transitions.
- `.page-head` — existing `.group-head` styles, add right-side chevron button.
- Chevron rotation via `.collapsed` class on the `<li>`, targeting the `svg` child.

## Toolbar Placement

Toolbar `<li>` is inserted at the top of the list on every `renderAll` call. It is not shown in page view.

## No Persistence

Collapse state is in-memory only (resets when popup closes). This matches existing `expandedIds` behavior.

## Out of Scope

- Sorting (placeholder for future toolbar buttons).
- Domain aliases.
- Options page changes.
