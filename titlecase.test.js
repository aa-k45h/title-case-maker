'use strict';

const assert = require('assert');
const TitleCase = require('./titlecase.js');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

console.log('Running TitleCase Test Suite...\n');

// ============================================================================
// 1. Exports & API Safety
// ============================================================================

test('1. Exports required public API methods and RULES object', () => {
  assert.strictEqual(typeof TitleCase.convert, 'function');
  assert.strictEqual(typeof TitleCase.detectFormat, 'function');
  assert.strictEqual(typeof TitleCase.titleCaseString, 'function');
  assert.strictEqual(typeof TitleCase.RULES, 'object');
  assert.ok(Array.isArray(TitleCase.RULES.articles));
  assert.ok(Array.isArray(TitleCase.RULES.conjunctions));
  assert.ok(Array.isArray(TitleCase.RULES.prepositions));
  assert.ok(Array.isArray(TitleCase.RULES.commonAcronyms));
  assert.ok(TitleCase.RULES.commonAcronyms.length >= 60);
});

test('2. Handles empty string, whitespace-only, and invalid inputs without throwing', () => {
  const emptyRes = TitleCase.convert('');
  assert.strictEqual(emptyRes.output, '');
  assert.strictEqual(emptyRes.format, 'plain');
  assert.deepStrictEqual(emptyRes.stats, {
    headingsFound: 0,
    headingsChanged: 0,
    wordsChanged: 0,
    characters: 0,
    words: 0
  });

  const ws = '   \n\r\n\t  ';
  const wsRes = TitleCase.convert(ws);
  assert.strictEqual(wsRes.output, ws);
  assert.strictEqual(wsRes.stats.characters, ws.length);

  const nullRes = TitleCase.convert(null, { scope: 'invalid', style: 'bad', format: 'unknown' });
  assert.strictEqual(nullRes.output, '');
});

test('3. Falls back to defaults when invalid options are provided', () => {
  const res = TitleCase.convert('# a tale of two cities', {
    scope: 'wrong',
    style: 'wrong',
    preserveAcronyms: 'not-a-bool',
    format: 'wrong'
  });
  assert.strictEqual(res.output, '# A Tale of Two Cities');
  assert.strictEqual(res.format, 'markdown');
});

// ============================================================================
// 2. Format Detection (format: "auto")
// ============================================================================

test('4. Detects HTML format for h1-h6, p, div, or body opening tags', () => {
  assert.strictEqual(TitleCase.detectFormat('<h1>title</h1>'), 'html');
  assert.strictEqual(TitleCase.detectFormat('<div class="box">text</div>'), 'html');
  assert.strictEqual(TitleCase.detectFormat('<p>paragraph</p>'), 'html');
  assert.strictEqual(TitleCase.detectFormat('<body>hello</body>'), 'html');
});

test('5. Detects Markdown format for ATX headings and fenced code blocks', () => {
  assert.strictEqual(TitleCase.detectFormat('# Heading 1\nSome text'), 'markdown');
  assert.strictEqual(TitleCase.detectFormat('###### Heading 6'), 'markdown');
  assert.strictEqual(TitleCase.detectFormat('```js\nconst a = 1;\n```'), 'markdown');
  assert.strictEqual(TitleCase.detectFormat('~~~\ncode\n~~~'), 'markdown');
});

test('6. Detects Plain format when neither HTML nor Markdown patterns match', () => {
  assert.strictEqual(TitleCase.detectFormat('Just a plain text heading\n\nAnd a paragraph.'), 'plain');
  assert.strictEqual(TitleCase.detectFormat('Hash#WithoutSpace'), 'plain');
});

test('7. Resolves ambiguity to HTML when text matches both HTML and Markdown', () => {
  const mixed = '# Markdown Heading\n<div>Some HTML content</div>';
  assert.strictEqual(TitleCase.detectFormat(mixed), 'html');
  const res = TitleCase.convert(mixed);
  assert.strictEqual(res.format, 'html');
});

// ============================================================================
// 3. Title Casing Rules (Rules 1 - 9)
// ============================================================================

test('8. Rule 1: Always capitalizes the first and last word, even if minor words', () => {
  assert.strictEqual(TitleCase.titleCaseString('in the beginning and at the end is on'), 'In the Beginning and at the End Is On');
  assert.strictEqual(TitleCase.titleCaseString('the'), 'The');
  assert.strictEqual(TitleCase.titleCaseString('to be or not to'), 'To Be or Not To');
});

test('9. Rule 1: Always capitalizes the first word after a colon or an em dash', () => {
  assert.strictEqual(
    TitleCase.titleCaseString('building a web app: the complete guide to success'),
    'Building a Web App: The Complete Guide to Success'
  );
  assert.strictEqual(
    TitleCase.titleCaseString('wait for it—an unexpected journey into the wild'),
    'Wait for It—An Unexpected Journey into the Wild'
  );
  assert.strictEqual(
    TitleCase.titleCaseString('part one — a new hope'),
    'Part One — A New Hope'
  );
});

test('10. Rule 2: Chicago style lowercases all listed articles, conjunctions, and prepositions', () => {
  const input = 'a walk in the park with a friend from near the river upon a hill into the woods';
  const expected = 'A Walk in the Park with a Friend from near the River upon a Hill into the Woods';
  assert.strictEqual(TitleCase.titleCaseString(input, { style: 'chicago' }), expected);
});

test('11. Rule 2: AP style capitalizes minor words of 4 or more letters (from, with, into, over, onto, upon, near)', () => {
  const input = 'a walk in the park with a friend from near the river upon a hill into the woods over and onto';
  const expected = 'A Walk in the Park With a Friend From Near the River Upon a Hill Into the Woods Over and Onto';
  assert.strictEqual(TitleCase.titleCaseString(input, { style: 'ap' }), expected);
});

test('12. Rule 3: Hyphenated compounds capitalize every part except minor words after the hyphen', () => {
  assert.strictEqual(
    TitleCase.titleCaseString('top-level production-grade self-driving systems'),
    'Top-Level Production-Grade Self-Driving Systems'
  );
  assert.strictEqual(
    TitleCase.titleCaseString('an up-to-date and step-by-step guide for state-of-the-art tools'),
    'An Up-to-Date and Step-by-Step Guide for State-of-the-Art Tools'
  );
});

test('13. Rule 3: Hyphenated compounds in AP style capitalize 4+ letter minor words after the hyphen', () => {
  assert.strictEqual(
    TitleCase.titleCaseString('a push-into-production and jump-over-obstacles plan', { style: 'ap' }),
    'A Push-Into-Production and Jump-Over-Obstacles Plan'
  );
  assert.strictEqual(
    TitleCase.titleCaseString('a push-into-production and jump-over-obstacles plan', { style: 'chicago' }),
    'A Push-into-Production and Jump-over-Obstacles Plan'
  );
});

test('14. Rule 4: Apostrophes and contractions never capitalize the letter after an apostrophe', () => {
  assert.strictEqual(
    TitleCase.titleCaseString("don't stop believing: it's rock 'n' roll for builders' tools"),
    "Don't Stop Believing: It's Rock 'n' Roll for Builders' Tools"
  );
  assert.strictEqual(
    TitleCase.titleCaseString("she'd've thought they're won't and can't"),
    "She'd've Thought They're Won't and Can't"
  );
});

test('15. Rule 5: Words with internal capitals (iPhone, JavaScript, macOS, eBay) are kept untouched', () => {
  assert.strictEqual(
    TitleCase.titleCaseString('developing for iPhone and macOS with JavaScript on eBay and GitHub'),
    'Developing for iPhone and macOS with JavaScript on eBay and GitHub'
  );
});

test('16. Rule 5: Words with digits (3D, H2O, 2nd, v8) follow digit casing rules', () => {
  assert.strictEqual(
    TitleCase.titleCaseString('rendering 3D graphics in H2O on the 2nd floor with v8 engine'),
    'Rendering 3D Graphics in H2O on the 2nd Floor with V8 Engine'
  );
});

test('17. Rule 6: Acronyms of 2-6 letters are preserved when preserveAcronyms is true and lowercased/titlecased when false', () => {
  assert.strictEqual(
    TitleCase.titleCaseString('using the NASA API with HTML and JSON', { preserveAcronyms: true }),
    'Using the NASA API with HTML and JSON'
  );
  assert.strictEqual(
    TitleCase.titleCaseString('using the NASA API with HTML and JSON', { preserveAcronyms: false }),
    'Using the Nasa Api with Html and Json'
  );
});

test('18. Rule 7: ALL-CAPS lines convert to title case normally while keeping built-in common acronyms uppercase', () => {
  const input = 'MASTERING REST API DESIGN WITH JSON AND SQL IN THE USA FOR NASA';
  const expected = 'Mastering REST API Design with JSON and SQL in the USA for NASA';
  assert.strictEqual(TitleCase.titleCaseString(input), expected);
});

test('19. Rule 8: Leading and trailing punctuation or quote marks are skipped when finding first and last word', () => {
  assert.strictEqual(
    TitleCase.titleCaseString('"in the dark of the night, who is out?"'),
    '"In the Dark of the Night, Who Is Out?"'
  );
  assert.strictEqual(
    TitleCase.titleCaseString('([«to the lighthouse and beyond!»])'),
    '([«To the Lighthouse and Beyond!»])'
  );
});

test('20. Rule 9: Unicode and non-ASCII letters (é, ü, ñ, å, ö) are handled properly', () => {
  assert.strictEqual(
    TitleCase.titleCaseString('el niño and the café über straße in malmö'),
    'El Niño and the Café Über Straße in Malmö'
  );
  assert.strictEqual(
    TitleCase.titleCaseString('ÉCLAIRS AND CRÈME BRÛLÉE IN THE CAFÉ'),
    'Éclairs and Crème Brûlée in the Café'
  );
});

// ============================================================================
// 4. Scope: Headings (Markdown, HTML, Plain Text)
// ============================================================================

test('21. Markdown headings: converts H1 through H5, preserves closing hashes, leaves H6 and body untouched', () => {
  const md = [
    '# heading one in the cloud',
    '## heading two with closing hashes ##',
    '### heading three for you',
    '#### heading four on the web',
    '##### heading five into the future',
    '###### heading six should not change at all',
    'This body paragraph in the document should not change.'
  ].join('\n');

  const res = TitleCase.convert(md, { scope: 'headings', format: 'markdown' });
  const expected = [
    '# Heading One in the Cloud',
    '## Heading Two with Closing Hashes ##',
    '### Heading Three for You',
    '#### Heading Four on the Web',
    '##### Heading Five into the Future',
    '###### heading six should not change at all',
    'This body paragraph in the document should not change.'
  ].join('\n');

  assert.strictEqual(res.output, expected);
  assert.strictEqual(res.stats.headingsFound, 5);
  assert.strictEqual(res.stats.headingsChanged, 5);
});

test('22. HTML headings: converts H1 to H5 with attributes, multi-line content, and leaves H6 untouched', () => {
  const html = [
    '<H1 class="main-title" data-id="1">welcome to the jungle of code</H1>',
    '<h2>a multi-line\nheading in the browser</h2>',
    '<h6>small heading in the footer</h6>',
    '<p>paragraph text in the body</p>'
  ].join('\n');

  const res = TitleCase.convert(html, { scope: 'headings', format: 'html' });
  const expected = [
    '<H1 class="main-title" data-id="1">Welcome to the Jungle of Code</H1>',
    '<h2>A Multi-Line\nHeading in the Browser</h2>',
    '<h6>small heading in the footer</h6>',
    '<p>paragraph text in the body</p>'
  ].join('\n');

  assert.strictEqual(res.output, expected);
  assert.strictEqual(res.stats.headingsFound, 2);
  assert.strictEqual(res.stats.headingsChanged, 2);
});

test('23. HTML headings: treats nested tags inside heading as ONE title for first/last word rules', () => {
  const html = '<h3><em>in</em> the middle of <a href="[https://example.com/in/the/path](https://example.com/in/the/path)" title="in the attr">the</a> <span class="end">by</span></h3>';
  const res = TitleCase.convert(html, { scope: 'headings', format: 'html' });
  // "in" is the first word of the heading -> "In"
  // "the" inside <a> is a middle word -> stays "the" (not treated as first/last of <a>!)
  // "by" inside <span> is the last word of the heading -> "By"
  assert.strictEqual(
    res.output,
    '<h3><em>In</em> the Middle of <a href="[https://example.com/in/the/path](https://example.com/in/the/path)" title="in the attr">the</a> <span class="end">By</span></h3>'
  );
});

test('24. Plain text headings: detects isolated short lines without terminal punctuation (.,;)', () => {
  const plain = [
    'introduction to the system',
    '',
    'This is a sentence that ends with a period.',
    '',
    'another heading without period',
    '',
    'not a heading because of comma,',
    '',
    'not a heading because of semicolon;',
    '',
    'First line of a two-line paragraph',
    'Second line of a two-line paragraph'
  ].join('\n');

  const res = TitleCase.convert(plain, { scope: 'headings', format: 'plain' });
  const expected = [
    'Introduction to the System',
    '',
    'This is a sentence that ends with a period.',
    '',
    'Another Heading Without Period',
    '',
    'not a heading because of comma,',
    '',
    'not a heading because of semicolon;',
    '',
    'First line of a two-line paragraph',
    'Second line of a two-line paragraph'
  ].join('\n');

  assert.strictEqual(res.output, expected);
  assert.strictEqual(res.stats.headingsFound, 2);
  assert.strictEqual(res.stats.headingsChanged, 2);
});

test('25. Plain text headings: rejects lines over 100 characters', () => {
  const longLine = 'a '.repeat(51).trim(); // 101 chars
  assert.ok(longLine.length > 100);
  const res = TitleCase.convert(longLine, { scope: 'headings', format: 'plain' });
  assert.strictEqual(res.output, longLine);
  assert.strictEqual(res.stats.headingsFound, 0);
});

test('26. Plain text headings: detects ALL-CAPS lines <= 100 chars with >= 2 words even without blank lines', () => {
  const plain = [
    'Some intro text right before.',
    'CHAPTER ONE IN THE BEGINNING WITH API',
    'Immediate body text right after.',
    'SINGLEWORDCAPS',
    'More body text.'
  ].join('\n');

  const res = TitleCase.convert(plain, { scope: 'headings', format: 'plain' });
  const expected = [
    'Some intro text right before.',
    'Chapter One in the Beginning with API',
    'Immediate body text right after.',
    'SINGLEWORDCAPS',
    'More body text.'
  ].join('\n');

  assert.strictEqual(res.output, expected);
  assert.strictEqual(res.stats.headingsFound, 1);
  assert.strictEqual(res.stats.headingsChanged, 1);
});

test('27. Never applies plain-text heading heuristics when format is markdown or html', () => {
  const md = 'isolated line in markdown\n\n# actual markdown heading';
  const resMd = TitleCase.convert(md, { scope: 'headings', format: 'markdown' });
  assert.strictEqual(resMd.output, 'isolated line in markdown\n\n# Actual Markdown Heading');

  const html = 'isolated line in html\n\n<h1>actual html heading</h1>';
  const resHtml = TitleCase.convert(html, { scope: 'headings', format: 'html' });
  assert.strictEqual(resHtml.output, 'isolated line in html\n\n<h1>Actual HTML Heading</h1>');
});

// ============================================================================
// 5. Scope: All
// ============================================================================

test('28. Scope "all" in Markdown converts list items, blockquotes, emphasis, and links while keeping syntax', () => {
  const md = [
    '# main title in the doc',
    '- first item in the list',
    '* second item with *italic text in it*',
    '1. numbered item with [a link to the site](https://example.com/path/to/page)',
    '> a wise quote from the past'
  ].join('\n');

  const res = TitleCase.convert(md, { scope: 'all', format: 'markdown' });
  const expected = [
    '# Main Title in the Doc',
    '- First Item in the List',
    '* Second Item with *Italic Text in It*',
    '1. Numbered Item with [a Link to the Site](https://example.com/path/to/page)',
    '> A Wise Quote from the Past'
  ].join('\n');

  assert.strictEqual(res.output, expected);
});

test('29. Scope "all" in HTML converts all text nodes per block while preserving tags and attributes', () => {
  const html = '<div class="wrapper"><p>a paragraph in the <strong>middle of</strong> the page</p><ul><li>an item in a list</li></ul></div>';
  const res = TitleCase.convert(html, { scope: 'all', format: 'html' });
  const expected = '<div class="wrapper"><p>A Paragraph in the <strong>Middle of</strong> the Page</p><ul><li>An Item in a List</li></ul></div>';
  assert.strictEqual(res.output, expected);
});

test('30. Scope "all" in Plain Text converts every line independently', () => {
  const plain = 'first line in the file.\nsecond line of the file.';
  const res = TitleCase.convert(plain, { scope: 'all', format: 'plain' });
  assert.strictEqual(res.output, 'First Line in the File.\nSecond Line of the File.');
});

// ============================================================================
// 6. Preservation System
// ============================================================================

test('31. Preserves Markdown fenced code blocks (backticks and tildes) and indented code blocks', () => {
  const md = [
    '# heading before code',
    '',
    '```javascript',
    '# not a heading inside backtick fence',
    'const x = "in the code";',
    '```',
    '',
    '~~~python',
    '# not a heading inside tilde fence',
    '~~~',
    '',
    '    # not a heading in 4-space indented code block',
    '\t# not a heading in tab-indented code block'
  ].join('\n');

  const res = TitleCase.convert(md, { scope: 'all', format: 'markdown' });
  assert.ok(res.output.includes('# Heading Before Code'));
  assert.ok(res.output.includes('# not a heading inside backtick fence'));
  assert.ok(res.output.includes('# not a heading inside tilde fence'));
  assert.ok(res.output.includes('    # not a heading in 4-space indented code block'));
  assert.ok(res.output.includes('\t# not a heading in tab-indented code block'));
});

test('32. Preserves inline code in single and double backticks inside headings and body', () => {
  const md = '# using `array.prototype.map` and `` `template` literals `` in javascript';
  const res = TitleCase.convert(md, { scope: 'headings', format: 'markdown' });
  assert.strictEqual(
    res.output,
    '# Using `array.prototype.map` and `` `template` literals `` in JavaScript'
  );
});

test('33. Preserves HTML comments, <script>, <style>, <pre>, and <code> contents completely', () => {
  const html = [
    '<!-- <h1>comment heading should not change</h1> -->',
    '<script>const title = "<h1>hello world</h1>";</script>',
    '<style>h1 { color: red; content: "hello world"; }</style>',
    '<pre>raw preformatted text in the block</pre>',
    '<h1>using <code>std::vector::push_back</code> in c++</h1>'
  ].join('\n');

  const res = TitleCase.convert(html, { scope: 'all', format: 'html' });
  const expected = [
    '<!-- <h1>comment heading should not change</h1> -->',
    '<script>const title = "<h1>hello world</h1>";</script>',
    '<style>h1 { color: red; content: "hello world"; }</style>',
    '<pre>raw preformatted text in the block</pre>',
    '<h1>Using <code>std::vector::push_back</code> in C++</h1>'
  ].join('\n');

  assert.strictEqual(res.output, expected);
});

test('34. Preserves URLs (http, https, ftp, www.) and email addresses untouched', () => {
  const input = '# connect to https://api.example.com/v1/users or ftp://files.example.org or www.example.com or email support@example.com today';
  const res = TitleCase.convert(input, { scope: 'headings', format: 'markdown' });
  assert.strictEqual(
    res.output,
    '# Connect to https://api.example.com/v1/users or ftp://files.example.org or www.example.com or Email support@example.com Today'
  );
});

test('35. Converts Markdown link text and image alt text while preserving their URLs intact', () => {
  const md = '# read [the guide to APIs](https://example.com/the-guide/to_apis) and view ![a diagram of the system](https://example.com/img/the_diagram.png)';
  const res = TitleCase.convert(md, { scope: 'headings', format: 'markdown' });
  assert.strictEqual(
    res.output,
    '# Read [the Guide to APIs](https://example.com/the-guide/to_apis) and View ![a Diagram of the System](https://example.com/img/the_diagram.png)'
  );
});

// ============================================================================
// 7. Quality, Line Endings, Round-Trip & Performance
// ============================================================================

test('36. Preserves CRLF (\\r\\n) and LF (\\n) line endings and trailing newlines byte-for-byte', () => {
  const crlfText = '# first heading in the doc\r\n\r\nParagraph text.\r\n## second heading in the doc\r\n\r\n';
  const res = TitleCase.convert(crlfText);
  assert.strictEqual(
    res.output,
    '# First Heading in the Doc\r\n\r\nParagraph text.\r\n## Second Heading in the Doc\r\n\r\n'
  );
});

test('37. Round-trip with no word changes returns the exact input byte-for-byte', () => {
  const alreadyCased = [
    '# A Properly Cased Heading in the Document',
    '',
    'Here is a paragraph with `inline_code`, https://example.com/test, and [A Link](https://example.com).',
    '',
    '```js',
    'function test() { return true; }',
    '```',
    ''
  ].join('\r\n');

  const res = TitleCase.convert(alreadyCased);
  assert.strictEqual(res.output, alreadyCased);
  assert.strictEqual(res.stats.headingsFound, 1);
  assert.strictEqual(res.stats.headingsChanged, 0);
  assert.strictEqual(res.stats.wordsChanged, 0);
});

test('38. Accurately reports stats (headingsFound, headingsChanged, wordsChanged, characters, words)', () => {
  const text = '# the quick brown fox\n\n## Already Cased\n\nSome body text.';
  const res = TitleCase.convert(text);
  assert.strictEqual(res.stats.headingsFound, 2);
  assert.strictEqual(res.stats.headingsChanged, 1);
  assert.strictEqual(res.stats.wordsChanged, 4); // the, quick, brown, fox
  assert.strictEqual(res.stats.characters, text.length);
  assert.strictEqual(res.stats.words, 9);
});

test('39. Does not mutate options object passed by caller (pure function check)', () => {
  const userOpts = Object.freeze({ scope: 'headings', style: 'ap' });
  const res = TitleCase.convert('# a walk with a friend', userOpts);
  assert.strictEqual(res.output, '# A Walk With a Friend');
});

test('40. Processes 1 MB of text in under 300 ms', () => {
  const block = '# a heading in the document with some words\n\nThis is a standard paragraph with several words to simulate a real document in production.\n\n';
  const repeats = Math.ceil((1024 * 1024) / block.length);
  const oneMegabyteText = block.repeat(repeats);
  assert.ok(oneMegabyteText.length >= 1024 * 1024);

  // Warm up the JIT first so the timing reflects steady-state speed, not compile time
  TitleCase.convert(oneMegabyteText.slice(0, 200000), { scope: 'headings', format: 'markdown' });

  const start = Date.now();
  const res = TitleCase.convert(oneMegabyteText, { scope: 'headings', format: 'markdown' });
  const elapsed = Date.now() - start;

  assert.ok(res.output.startsWith('# A Heading in the Document with Some Words'));
  assert.ok(
    elapsed < 300,
    `Expected 1 MB processing in < 300 ms, but took ${elapsed} ms`
  );
});

test('41. Handles Markdown links with parentheses inside the URL destination', () => {
  const md = '# read [the story of rust](https://en.wikipedia.org/wiki/Rust_(programming_language)) today';
  const res = TitleCase.convert(md);
  assert.strictEqual(
    res.output,
    '# Read [the Story of Rust](https://en.wikipedia.org/wiki/Rust_(programming_language)) Today'
  );
});

test('42. Handles possessive acronyms in all-caps and normal headings', () => {
  assert.strictEqual(
    TitleCase.titleCaseString("learning NASA's new API's features"),
    "Learning NASA's New API's Features"
  );
  assert.strictEqual(
    TitleCase.titleCaseString("EXPLORING NASA'S NEW API"),
    "Exploring NASA's New API"
  );
});

test('43. Hyphenated compound mid-title capitalizes its first part even if it is a minor word', () => {
  assert.strictEqual(TitleCase.titleCaseString('keeping your store up-to-date'), 'Keeping Your Store Up-to-Date');
  assert.strictEqual(TitleCase.titleCaseString('a guide to in-house teams'), 'A Guide to In-House Teams');
});

test('44. Known terms get their correct casing when preserveAcronyms is on', () => {
  assert.strictEqual(TitleCase.titleCaseString('top 10 seo tips for shopify and wordpress'), 'Top 10 SEO Tips for Shopify and WordPress');
  assert.strictEqual(TitleCase.titleCaseString('learn javascript', { preserveAcronyms: false }), 'Learn Javascript');
});

test('45. Ambiguous all-caps words (IT, SPA, PIN) are not forced uppercase in ALL-CAPS lines', () => {
  assert.strictEqual(TitleCase.titleCaseString('IT IS TIME FOR A SPA DAY'), 'It Is Time for a Spa Day');
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n--------------------------------------------------');
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('--------------------------------------------------');

if (failed > 0) {
  process.exit(1);
}