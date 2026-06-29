# Microsoft Edge Add-ons listing — ReadOn

Copy-paste source for Partner Center → Microsoft Edge program. Registration is
free (no fee). The same `dist/readon-<version>.zip` is uploaded — no code change
needed. Replace any `<placeholder>` before submitting.

## Basic

- **Name:** ReadOn — Scroll Position Bookmarks (≤45 chars)
- **Category:** Productivity
- **Supported languages:** English

## Short description (≤132 chars)

> Bookmark your exact scroll position on any page and pick up reading right where you left off. Notes, tags, all local.

## Tagline

> Mark the spot. Note the thought. Read on.

## Detailed description

> Mark the spot. Note the thought. Read on.
>
> Native bookmarks remember the page. ReadOn remembers the *spot*.
>
> ReadOn lets you bookmark the exact scroll position inside any web page — long
> docs, articles, papers — so you can return to precisely where you stopped
> reading.
>
> Features
> • Mark a spot with one click and jump straight back to it.
> • Keep one mark per page and update it as you read on.
> • Add notes to any mark.
> • "All marks" view groups everything by site, right in the popup.
> • Full manager page: search, rename, tag (group pages by theme across sites),
>   bulk-delete, and import/export your marks as JSON.
> • 100% local — no account, no server, no tracking. Your data stays in your
>   browser.
>
> How it finds your spot: ReadOn combines a scroll ratio with a nearby text
> anchor, so jumps stay accurate even when page content shifts.

## Search terms (up to 7)

reading position, scroll bookmark, resume reading, read later, scroll position,
bookmark manager, reading tracker

## Permission justifications

- **storage:** Save the user's marks, notes, tags, and aliases in local browser
  storage.
- **activeTab:** Read and restore the scroll position of the page the user is
  actively viewing, triggered by clicking Mark or Jump.
- **scripting:** Inject the content script on demand to capture or restore the
  scroll position on pages opened before the extension loaded.
- **tabs:** Open a saved mark's page and navigate to its URL when the user jumps
  to a mark from the All Marks list.
- **Host access (http/https):** The content script runs on the pages the user
  chooses to mark, to measure and restore the reading position. No page content
  is collected or transmitted.

## Privacy

- Does this extension collect user data? **No data is collected or transmitted.**
  All data stays in the user's browser; it leaves the device only via the user's
  own Export action.
- Privacy policy URL: `https://github.com/yangzeqiminichris/read-on/blob/master/PRIVACY.md`

## Assets to upload

- **Store logo: 300×300** — `docs/store-assets/store-logo-300.png` (generated).
- **Screenshots: 1280×800** (or 640×480), 1–10 images — see the shot list below.
- (Optional) Promotional tile 440×280.

## Package

- Upload `dist/readon-<version>.zip` (run `npm run package`).

## Notes vs Chrome Web Store

- Edge registration is **free**; Chrome charges a one-time $5.
- Edge requires a **300×300** store logo (Chrome uses the 128 icon).
- Listing copy, permissions, and the package are otherwise identical — one build
  serves both stores.

---

## Screenshot shot list (applies to Chrome and Edge)

Target size **1280×800** (Edge also accepts 640×480; Chrome wants 1280×800).
Set the browser zoom to 100%, use a clean window (hide the bookmarks bar and any
unrelated extensions), and pick one color theme (light) for consistency. Take a
normal screenshot, then crop/scale to 1280×800.

Before shooting, set up some realistic data: mark a few pages on 2–3 different
sites (e.g. a docs site, an article, a paper), add a note to one, and add a tag
or two so the manager looks populated.

1. **Hero — mark made on a page**
   - Open a long article/doc, scroll to mid-page, click the ReadOn icon, click
     Mark. Capture the popup open over the article showing one mark row with the
     progress bar and percentage.
   - Goal: communicates the core "save your spot" idea at a glance.

2. **Jump back / one mark per page**
   - Same popup with a mark row, mouse hovering the ▶ (jump) or ⟳ (update)
     button (tooltip visible is a bonus).
   - Goal: shows you can return to / update the position.

3. **All marks — grouped by site**
   - Click "All marks" so the popup shows several pages grouped under their
     domains, with progress bars.
   - Goal: shows it scales across many pages.

4. **Full manager — tags / By tag**
   - Open "Open full manager", switch to the "By tag" view (or show tag chips on
     a page header), ideally with the search box visible.
   - Goal: shows organization (tags, search, cross-site grouping).

5. **Notes (optional 5th)**
   - A mark expanded with a note typed in.
   - Goal: shows the "note the thought" half of the tagline.

Tip: add a short caption to each screenshot in the store form (e.g. "Save your
exact reading spot", "Jump back in one click", "Browse every mark by site",
"Organize with tags", "Add notes as you read").
