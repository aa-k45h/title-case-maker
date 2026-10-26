# TitleCase Engine API

`titlecase.js` is a zero-dependency UMD module. In the browser it exposes a global `TitleCase` object; in Node.js it is available through `require('./titlecase.js')`.

---

## `TitleCase.convert(text, options)`

Converts plain text, Markdown, or HTML into title case while preserving markup, code blocks, inline code, URLs, and email addresses. It never throws.

### Parameters

- `text` (`string`): the input to convert. Non-string input is treated as an empty string.
- `options` (`object`, optional):
  - `scope`: `"headings"` (default) converts only headings; `"all"` converts every line of text.
  - `style`: `"chicago"` (default) or `"ap"`.
  - `preserveAcronyms` (`boolean`, default `true`): keeps 2 to 6 letter all-caps words (API, NASA) uppercase and applies the known-terms list (javascript → JavaScript, seo → SEO).
  - `format`: `"auto"` (default), `"markdown"`, `"html"`, or `"plain"`.

Invalid option values fall back to the defaults.

### Returns

`{ output, format, stats }`

- `output` (`string`): the converted text. Line endings (LF or CRLF) are preserved exactly.
- `format`: the format actually used: `"markdown"`, `"html"`, or `"plain"`.
- `stats`: `{ headingsFound, headingsChanged, wordsChanged, characters, words }`.

### Example

```js
const result = TitleCase.convert(
  '# working with the `fetch` api in javascript\n\nRead more at https://example.com.',
  { scope: 'headings', style: 'chicago' }
);
// result.output  → '# Working with the `fetch` API in JavaScript\n\nRead more at https://example.com.'
// result.format  → 'markdown'
// result.stats   → { headingsFound: 1, headingsChanged: 1, wordsChanged: 3, characters: 79, words: 13 }
```

---

## `TitleCase.detectFormat(text)`

Returns `"html"`, `"markdown"`, or `"plain"`. HTML wins when text matches both.

```js
TitleCase.detectFormat('<h2>hello</h2>'); // 'html'
TitleCase.detectFormat('## hello');       // 'markdown'
TitleCase.detectFormat('hello');          // 'plain'
```

---

## `TitleCase.titleCaseString(str, options)`

Title-cases one string with no Markdown or HTML handling (URLs and emails are still protected). Accepts the same `style` and `preserveAcronyms` options.

```js
TitleCase.titleCaseString('a guide to seo: the basics');           // 'A Guide to SEO: The Basics'
TitleCase.titleCaseString('a walk with a friend', { style: 'ap' }); // 'A Walk With a Friend'
```

---

## `TitleCase.RULES`

Frozen word lists used by the engine, useful for displaying the rules in a UI:

- `articles`, `conjunctions`, `prepositions`
- `chicagoMinorWords`, `apMinorWords`
- `commonAcronyms`: kept uppercase when converting ALL-CAPS lines
- `knownTerms`: fixed casings such as `JavaScript`, `SEO`, `WordPress`

To change the rules, edit the constants at the top of `titlecase.js`.
