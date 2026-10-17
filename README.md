# X Search View

Chrome / Edge browser extension that reformats visible X (Twitter) posts into a clean, search-result-style reading view — like Google results.

## What it does

On any X timeline or profile page, every `<article>` tweet is extracted, sanitized (waits, images/videos collapsed), and re-rendered as a compact card with Google-style styling: muted top line (avatar + author + time), collapsible media, trailing metrics (replies, reposts, likes, views), and a per-post link. No data leaves your browser — this only restructures the DOM you already see.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (MV3), matches `x.com` + `twitter.com`, idle injection |
| `content.js` | Core logic: extract posts, build cards, MutationObserver re-scrape, toggle UI |
| `style.css` | Layout + dark/light theme, responsive to mobile width, follows `prefers-color-scheme` |

## Install

1. Download the folder.
2. Open `chrome://extensions`, enable **Developer mode**.
3. "Load unpacked" → select this directory.
4. Visit any X timeline — posts appear below the header instantly. Click **詳細** to expand metrics; click a post to open in a new tab.
5. Click **元の表示** to hide it again.

## Tech

vanilla ES6 (IIFE, no build step, no dependencies). Content scripts run in an isolated world, so the extension can't see page JS but can always access DOM. Timestamps are formatted `ja-JP` via `Intl`.

## Version history

| Version | What changed |
|---------|--------------|
| 0.6 | Removed per-card separators (`border-bottom: none`); body text styled like Google's muted snippets |
| 0.5 | Follows `prefers-color-scheme`; refined layout to match Google search results |
| 0.4 | Left-biased column, dark theme aligned with supplied Google reference |
