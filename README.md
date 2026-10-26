# Title Case Maker

Convert Markdown, HTML, and plain-text headings (or whole documents) into proper title case, following Chicago or AP style. Everything runs in the browser; nothing you paste is uploaded anywhere.

## Features

- Paste text or drop a `.txt`, `.md`, or `.html` file
- Convert **headings only** (H1–H5) or **all text**
- **Chicago** or **AP** style
- Keeps acronyms and known terms correct (API, SEO, JavaScript, WordPress)
- Never touches code blocks, inline code, HTML tags and attributes, URLs, or email addresses
- Highlights every changed word, with copy and download
- Light and dark themes

## Run it locally

Open `index.html` in any modern browser. No build step or install is needed.

## Deploy on GitHub Pages

1. Push `index.html` and `titlecase.js` to a GitHub repository.
2. Go to **Settings → Pages**, set the source to your main branch and the root folder, and save.
3. The site goes live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | The interface |
| `titlecase.js` | The title-casing engine (works in the browser and Node.js) |
| `titlecase.test.js` | Test suite: run with `node titlecase.test.js` |
| `API.md` | Engine API reference |

## Changing the look

All colours are CSS variables at the top of `index.html` (`:root` for light, `:root[data-theme="dark"]` for dark). Change those values to apply a new palette.

## Changing the rules

The word lists (articles, prepositions, acronyms, known terms) are constants at the top of `titlecase.js`. Run the tests after editing them.
