# Chrome Web Store listing — ReadOn

Copy-paste source for the Web Store developer dashboard. Replace any
`<placeholder>` before submitting.

## Basic

- **Name:** ReadOn — Scroll Position Bookmarks (≤45 chars)
- **Category:** Productivity
- **Language:** English

## Short description (≤132 chars)

> Bookmark your exact scroll position on any page and pick up reading right where you left off. Notes, tags, all local.

## Detailed description

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

## Single purpose (required)

> ReadOn saves and restores your reading position (scroll location) within web
> pages, so you can resume long reads where you left off.

## Permission justifications (required)

- **storage:** Save the user's marks, notes, tags, and aliases in local browser
  storage.
- **activeTab:** Read and restore the scroll position of the page the user is
  actively viewing, triggered by the user clicking Mark or Jump.
- **scripting:** Inject the content script on demand to capture or restore the
  scroll position on pages that were already open before the extension loaded.
- **tabs:** Open a saved mark's page in a tab and navigate to its URL when the
  user jumps to a mark from the All Marks list.
- **Host access (http/https):** The content script must run on the pages the user
  chooses to mark in order to measure and restore the reading position. No page
  content is collected or transmitted.

## Data usage disclosures (dashboard checkboxes)

- Does this item collect user data? **No data is collected or transmitted.**
- Sold to third parties: **No.**
- Used for purposes unrelated to core functionality: **No.**
- Privacy policy URL: `<host PRIVACY.md and paste the URL>`

## Assets to upload

- Store icon: 128×128 — `src/icons/icon128.png` (already in repo).
- Screenshots: 1280×800 (or 640×400), 1–5 images. Suggested shots:
  1. Popup after marking a page (progress bar + mark row).
  2. "All marks" grouped view.
  3. Full manager with tags / By tag view.
  4. A note open on a mark.
- (Optional) Small promo tile 440×280.

## Submission notes

- Package to upload: run `npm run package` → `dist/readon-<version>.zip`.
- A privacy policy URL is required because the extension stores user-entered
  data (even though it never leaves the device). Host `PRIVACY.md` somewhere
  public (e.g. GitHub repo file or GitHub Pages) and paste that URL.
- First review typically takes a few business days; broad host access
  (`http/https`) may add scrutiny — the justification above covers it.
