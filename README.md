# ReadOn

Bookmark a scroll position on any page and pick up reading where you left off.

ReadOn is a lightweight Chrome extension (Manifest V3) for people who read long
documents — docs, articles, papers — and want to return to the exact spot they
stopped at. Native bookmarks only remember the page; ReadOn remembers the
position *within* the page.

## Features

- **Mark a spot** — one click saves your current scroll position on the page.
- **Pick up where you left off** — jump straight back to the saved position.
- **Update in place** — keep one mark per page and move it as you read on.
- **Notes** — attach a note to any mark.
- **All marks** — browse every mark across pages, grouped by domain, from the popup.
- **Full manager** — a dedicated page to search, rename (aliases), tag, and
  bulk-delete marks, plus JSON import/export for backup and sharing.
- **Tags** — group pages by theme across domains (up to 3 tags per page).
- **Local only** — everything is stored in your browser. No account, no server.

## How positioning works

ReadOn locates your spot with two complementary signals: a scroll *ratio*
(roughly where you were) refined by a *text anchor* (the nearest matching text to
that ratio). If the anchor can't be found, it falls back to the ratio alone, so
jumps stay robust even when page content shifts.

## Install (development)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's root folder
   (the one containing `manifest.json`).

## Build a store package

```bash
npm run package
```

This writes `dist/readon-<version>.zip` containing only the files the extension
needs (manifest, `src/`, icons) — ready to upload to the Chrome Web Store.

## Development

```bash
npm test        # run the unit test suite (node:test)
```

Shared libraries under `src/lib/` are written as UMD modules so the same file
runs in Node (for tests), in the content script, and in the popup/options pages —
no build step.

To regenerate the extension icons from `src/icons/source.png`:

```bash
node src/icons/gen-icons-from-source.mjs
```

## Privacy

ReadOn stores all data locally in your browser and sends nothing to any server.
See [PRIVACY.md](PRIVACY.md).

## License

MIT (see `LICENSE`).
