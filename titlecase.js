/**
 * TitleCase Engine
 * A zero-dependency, browser and Node.js compatible UMD module for converting
 * plain text, Markdown, and HTML into Chicago or AP style Title Case.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    root.TitleCase = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ============================================================================
  // 1. WORD LISTS & CONSTANTS (Rule 2, Rule 7)
  // ============================================================================

  const ARTICLES = ['a', 'an', 'the'];

  const CONJUNCTIONS = ['and', 'but', 'for', 'or', 'nor', 'so', 'yet'];

  const PREPOSITIONS = [
    'in', 'on', 'at', 'to', 'by', 'of', 'off', 'out', 'up', 'via',
    'per', 'as', 'from', 'with', 'into', 'over', 'onto', 'upon', 'near'
  ];

  // Built-in set of ~65 common acronyms kept uppercase even when converting ALL-CAPS lines (Rule 7)
  const COMMON_ACRONYMS = [
    'AI', 'AJAX', 'API', 'AR', 'ASCII', 'AWS', 'BIOS', 'CEO',
    'CFO', 'CLI', 'CMS', 'COO', 'CPU', 'CRM', 'CSS', 'CSV', 'CTO', 'CV',
    'DB', 'DNS', 'DOM', 'DVD', 'ERP', 'EU', 'FAQ', 'FBI', 'FTP', 'GB',
    'GDP', 'GIF', 'GPU', 'GUI', 'HTML', 'HTTP', 'HTTPS', 'IDE', 'IO',
    'IOS', 'IOT', 'IP', 'IRS', 'ISO', 'JPEG', 'JPG', 'JS', 'JSON',
    'JWT', 'KB', 'LAN', 'LED', 'LLM', 'MB', 'MIME', 'ML',
    'MVP', 'NASA', 'NATO', 'NFT', 'NLP', 'NPM', 'OAuth', 'OEM', 'ORM',
    'OS', 'PC', 'PDF', 'PHP', 'PNG', 'QA', 'QR',
    'RAM', 'REST', 'RGB', 'ROI', 'ROM', 'MHz', 'GHz', 'RSS', 'SDK', 'SEO',
    'SLA', 'SMS', 'SMTP', 'SOAP', 'SQL', 'SSH', 'SSL',
    'SSD', 'SVG', 'SWOT', 'TB', 'TCP', 'TLS', 'TV', 'UDP', 'UI', 'UK',
    'URI', 'URL', 'USB', 'USA', 'UTC', 'UTF', 'UUID', 'UX', 'VIP',
    'VM', 'VPN', 'VR', 'WAN', 'WASM', 'WIFI', 'WWW', 'XML', 'XSS', 'YAML', 'ZIP'
  ].filter(w => /^[A-Z0-9]+$/.test(w));
  // Ambiguous words that are also ordinary English (IT, AM, PIN, SPA, MAC...) are
  // intentionally excluded so ALL-CAPS headings like "IT IS TIME" convert correctly.

  // Known terms with fixed casing. When a word matches one of these (in any case)
  // and preserveAcronyms is on, it is written exactly like this. Ambiguous words
  // (it, us, am, pm, id) are deliberately left out.
  const KNOWN_TERMS = [
    'AI', 'API', 'APIs', 'AWS', 'CMS', 'CRM', 'CSS', 'CSV', 'DNS', 'FAQ', 'FAQs', 'GPU',
    'HTML', 'HTML5', 'CSS3', 'HTTP', 'HTTPS', 'JSON', 'JWT', 'LLM', 'LLMs', 'NASA', 'PDF',
    'PHP', 'REST', 'ROI', 'SaaS', 'SDK', 'SEO', 'SQL', 'SSL', 'SVG', 'UI', 'URL', 'URLs',
    'UX', 'XML', 'YAML', 'B2B', 'B2C', 'D2C',
    'JavaScript', 'TypeScript', 'GitHub', 'GitLab', 'WordPress', 'WooCommerce', 'Shopify',
    'PayPal', 'YouTube', 'LinkedIn', 'iPhone', 'iPad', 'iOS', 'macOS', 'eBay', 'ChatGPT',
    'OpenAI', 'Node.js', 'React', 'Vue', 'Next.js', 'jQuery', 'MySQL', 'PostgreSQL',
    'MongoDB', 'GraphQL', 'DevOps', 'Magento', 'BigCommerce', 'eCommerce'
  ];
  const KNOWN_TERMS_MAP = new Map(KNOWN_TERMS.map(t => [t.toLowerCase(), t]));

  const CHICAGO_MINOR_SET = new Set([...ARTICLES, ...CONJUNCTIONS, ...PREPOSITIONS]);
  const AP_MINOR_SET = new Set(
    [...CHICAGO_MINOR_SET].filter(word => word.length < 4)
  );
  const COMMON_ACRONYMS_SET = new Set(COMMON_ACRONYMS);

  const RULES = Object.freeze({
    articles: Object.freeze([...ARTICLES]),
    conjunctions: Object.freeze([...CONJUNCTIONS]),
    prepositions: Object.freeze([...PREPOSITIONS]),
    chicagoMinorWords: Object.freeze([...CHICAGO_MINOR_SET]),
    apMinorWords: Object.freeze([...AP_MINOR_SET]),
    commonAcronyms: Object.freeze([...COMMON_ACRONYMS_SET]),
    knownTerms: Object.freeze([...KNOWN_TERMS])
  });

  const DEFAULT_OPTIONS = Object.freeze({
    scope: 'headings',
    style: 'chicago',
    preserveAcronyms: true,
    format: 'auto'
  });

  // ============================================================================
  // 2. UNICODE & CHARACTER HELPERS (Rule 9)
  // ============================================================================

  const RE_LETTER = /\p{L}/u;
  const RE_UPPER = /\p{Lu}/u;
  const RE_LOWER = /\p{Ll}/u;
  const RE_ALPHANUM = /[\p{L}\p{N}]/u;
  const RE_DIGIT = /\p{N}/u;

  function hasLetters(str) {
    return RE_LETTER.test(str);
  }

  function isAllUpperCase(str) {
    return hasLetters(str) && !RE_LOWER.test(str) && RE_UPPER.test(str);
  }

  function isAllLowerCase(str) {
    return hasLetters(str) && !RE_UPPER.test(str) && RE_LOWER.test(str);
  }

  function hasInternalCaps(str) {
    // True for mixed-case words with an uppercase letter after the first character
    // (iPhone, JavaScript, eBay). Regex-based for speed on large documents.
    if (str.length <= 1) return false;
    const rest = str.replace(/^./su, '');
    return RE_LOWER.test(str) && RE_UPPER.test(rest);
  }

  const RE_FIRST_LETTER = /\p{L}/u;

  function capitalizeFirstLetter(str) {
    // Uppercase the first letter and lowercase every letter after it.
    const m = RE_FIRST_LETTER.exec(str);
    if (!m) return str;
    const i = m.index;
    return str.slice(0, i) + m[0].toUpperCase() + str.slice(i + m[0].length).toLowerCase();
  }

  /**
   * Normalizes options, falling back to defaults for any invalid or missing values.
   */
  function normalizeOptions(options) {
    const opts = Object.assign({}, DEFAULT_OPTIONS);
    if (options && typeof options === 'object') {
      if (options.scope === 'headings' || options.scope === 'all') {
        opts.scope = options.scope;
      }
      if (options.style === 'chicago' || options.style === 'ap') {
        opts.style = options.style;
      }
      if (typeof options.preserveAcronyms === 'boolean') {
        opts.preserveAcronyms = options.preserveAcronyms;
      }
      if (
        options.format === 'auto' ||
        options.format === 'markdown' ||
        options.format === 'html' ||
        options.format === 'plain'
      ) {
        opts.format = options.format;
      }
    }
    return opts;
  }

  // ============================================================================
  // 3. FORMAT DETECTION
  // ============================================================================

  const RE_HTML_DETECT = /<(?:h[1-6]|p|div|body)(?:\s[^>]*)?>/i;
  const RE_MD_HEADING_DETECT = /^#{1,6}\s/m;
  const RE_MD_FENCE_DETECT = /^(?:`{3,}|~{3,})/m;

  /**
   * Detects whether input text is HTML, Markdown, or Plain text.
   * Priority: HTML > Markdown > Plain.
   */
  function detectFormat(text) {
    if (typeof text !== 'string' || text.length === 0) {
      return 'plain';
    }
    if (RE_HTML_DETECT.test(text)) {
      return 'html';
    }
    if (RE_MD_HEADING_DETECT.test(text) || RE_MD_FENCE_DETECT.test(text)) {
      return 'markdown';
    }
    return 'plain';
  }

  // ============================================================================
  // 4. MASKING / PRESERVATION SYSTEM
  // ============================================================================

  /**
   * Creates a mask manager that replaces protected regions with safe private-use
   * placeholders (\uE000{index}\uE001) that contain no letters, digits, or standard
   * punctuation, ensuring word tokenization skips them seamlessly.
   */
  function createMasker() {
    const tokens = [];
    return {
      mask(str) {
        const id = tokens.length;
        tokens.push(str);
        return '\uE000' + id + '\uE001';
      },
      unmask(str) {
        if (tokens.length === 0 || str.indexOf('\uE000') === -1) return str;
        // Unmask iteratively in case masks were nested (e.g., inline URLs masked after block masks)
        let result = str;
        let safety = 10;
        while (result.indexOf('\uE000') !== -1 && safety-- > 0) {
          result = result.replace(/\uE000(\d+)\uE001/g, function (_, id) {
            return tokens[Number(id)];
          });
        }
        return result;
      }
    };
  }

  // Regex for inline URLs and emails
  const RE_URL_OR_EMAIL = /\b(?:(?:https?|ftp):\/\/[^\s<>()"'`]+|www\.[^\s<>()"'`]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

  /**
   * Masks URLs and email addresses within a text segment, leaving trailing sentence
   * punctuation (.,;!? etc.) outside the mask.
   */
  function maskUrlsAndEmails(text, masker) {
    return text.replace(RE_URL_OR_EMAIL, function (match) {
      // Strip trailing punctuation that belongs to surrounding prose
      let url = match;
      let trailing = '';
      while (url.length > 0 && /[.,;:!?)}\]"']$/.test(url)) {
        // Keep closing paren if url has matching opening paren
        if (url.endsWith(')') && (url.match(/\(/g) || []).length >= (url.match(/\)/g) || []).length) {
          break;
        }
        trailing = url.slice(-1) + trailing;
        url = url.slice(0, -1);
      }
      return masker.mask(url) + trailing;
    });
  }

  /**
   * Masks Markdown inline code (`code` or ``code``) and link/image destinations `[text](url)`.
   * Link text and image alt text remain exposed for title-casing!
   */
  function maskMarkdownInline(text, masker) {
    let out = '';
    let i = 0;
    const len = text.length;

    while (i < len) {
      // 1. Check for inline code backticks (` or `` etc.)
      if (text[i] === '`') {
        let tickCount = 0;
        let start = i;
        while (i < len && text[i] === '`') {
          tickCount++;
          i++;
        }
        const closingTicks = '`'.repeat(tickCount);
        const closeIdx = text.indexOf(closingTicks, i);
        if (closeIdx !== -1) {
          i = closeIdx + tickCount;
          out += masker.mask(text.slice(start, i));
          continue;
        } else {
          // Unclosed backticks, emit as-is
          out += closingTicks;
          continue;
        }
      }

      // 2. Check for Markdown link or image: `[alt](url)` or `![alt](url)`
      // We leave `[` and `alt` exposed, and mask `(url)` (and optional title)
      if (text[i] === ']' && i + 1 < len && text[i + 1] === '(') {
        out += ']';
        i++; // now at '('
        const parenStart = i;
        i++; // skip '('
        let depth = 1;
        while (i < len && depth > 0) {
          if (text[i] === '\\' && i + 1 < len) {
            i += 2;
            continue;
          }
          if (text[i] === '(') depth++;
          else if (text[i] === ')') depth--;
          i++;
        }
        if (depth === 0) {
          out += masker.mask(text.slice(parenStart, i));
          continue;
        } else {
          out += text.slice(parenStart, i);
          continue;
        }
      }

      // 3. Check for inline HTML tags inside Markdown (e.g. <code>...</code> or <a href="...">)
      if (text[i] === '<') {
        const rest = text.slice(i);
        const codeBlockMatch = rest.match(/^<(code|pre|script|style)(?:\s[^>]*)?>[\s\S]*?<\/\1>/i);
        if (codeBlockMatch) {
          out += masker.mask(codeBlockMatch[0]);
          i += codeBlockMatch[0].length;
          continue;
        }
        const commentMatch = rest.match(/^<!--[\s\S]*?-->/);
        if (commentMatch) {
          out += masker.mask(commentMatch[0]);
          i += commentMatch[0].length;
          continue;
        }
        const tagMatch = rest.match(/^<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?>/);
        if (tagMatch) {
          out += masker.mask(tagMatch[0]);
          i += tagMatch[0].length;
          continue;
        }
      }

      out += text[i];
      i++;
    }

    return maskUrlsAndEmails(out, masker);
  }

  // ============================================================================
  // 5. CORE TITLE-CASING ENGINE (Rules 1-9)
  // ============================================================================

  /**
   * Counts total words in a string for stats calculation.
   */
  function countWordsInString(str) {
    if (!str) return 0;
    // Remove HTML tags if any for accurate word stats, or count word tokens
    let count = 0;
    const regex = /[\p{L}\p{N}]+(?:['’'-][\p{L}\p{N}]+)*/gu;
    while (regex.exec(str) !== null) {
      count++;
    }
    return count;
  }

  /**
   * Converts a single word part (either a standalone word or one segment of a hyphenated word).
   */
  function convertSinglePart(part, context) {
    const {
      isFirstWord,
      isLastWord,
      forceCapBefore,
      isSubpart,
      isAllCapsLine,
      opts
    } = context;

    // Must contain at least one letter to be cased
    if (!hasLetters(part)) {
      return part;
    }

    // Rule 4: Rock 'n' Roll — handle standalone `'n'` or `'n`
    const lowerPart = part.toLowerCase();
    if (lowerPart === "'n'" || lowerPart === "’n’" || lowerPart === "'n" || lowerPart === "’n") {
      if (isFirstWord || isLastWord || forceCapBefore) {
        return part.replace(/n/i, 'N');
      }
      return part.replace(/N/g, 'n');
    }

    // Strip leading/trailing apostrophes if attached to word, preserving them around the core word
    let leadApos = '';
    let trailApos = '';
    let core = part;

    const leadMatch = core.match(/^(['’']+)/);
    if (leadMatch) {
      leadApos = leadMatch[1];
      core = core.slice(leadApos.length);
    }
    const trailMatch = core.match(/(['’']+)$/);
    if (trailMatch && core.length > trailMatch[1].length) {
      trailApos = trailMatch[1];
      core = core.slice(0, core.length - trailApos.length);
    }

    if (!hasLetters(core)) {
      return part;
    }

    // Known terms (javascript -> JavaScript, html -> HTML) when acronym preservation is on
    if (opts.preserveAcronyms) {
      const known = KNOWN_TERMS_MAP.get(core.toLowerCase());
      if (known) return leadApos + known + trailApos;
    }

    // Rule 5: Words containing digits (3D, H2O, 2nd)
    if (RE_DIGIT.test(core)) {
      // Kept as written, with the first character capitalized ONLY if it is a letter
      // in an otherwise all-lowercase word (e.g., "v8" -> "V8", "2nd" -> "2nd", "3D" -> "3D").
      const firstChar = Array.from(core)[0];
      if (RE_LETTER.test(firstChar) && isAllLowerCase(core)) {
        return leadApos + capitalizeFirstLetter(core) + trailApos;
      }
      return part;
    }

    // Rule 5: Words with internal capitals (iPhone, JavaScript, macOS, eBay) are kept as written
    if (!isAllCapsLine && hasInternalCaps(core)) {
      return part;
    }

    // Rule 7: All-caps line handling
    // If the whole title/line was ALL CAPS, only keep words from COMMON_ACRONYMS uppercase.
    if (isAllCapsLine) {
      const upperCore = core.replace(/['’']s$/i, '');
      const posSuffix = core.slice(upperCore.length);
      if (COMMON_ACRONYMS_SET.has(upperCore.toUpperCase())) {
        return leadApos + upperCore.toUpperCase() + posSuffix.toLowerCase() + trailApos;
      }
      // Otherwise fall through to normal title casing by lowercasing core first
      core = core.toLowerCase();
    } else {
      // Rule 6: Acronyms (preserveAcronyms: true)
      // An all-caps word of 2 to 6 letters (API, NASA, HTML) stays uppercase.
      const coreWithoutPossessive = core.replace(/['’']s$/i, '');
      const letterCount = Array.from(coreWithoutPossessive).filter(ch => RE_LETTER.test(ch)).length;
      if (isAllUpperCase(coreWithoutPossessive) && letterCount >= 2 && letterCount <= 6) {
        if (opts.preserveAcronyms) {
          const suffix = core.slice(coreWithoutPossessive.length);
          return leadApos + coreWithoutPossessive + (suffix ? suffix.toLowerCase() : '') + trailApos;
        } else {
          core = core.toLowerCase();
        }
      } else if (isAllUpperCase(coreWithoutPossessive) && letterCount > 6) {
        // Longer all-caps word when not an acronym: convert to normal title case
        core = core.toLowerCase();
      }
    }

    const lowerCore = core.toLowerCase();
    const minorSet = opts.style === 'ap' ? AP_MINOR_SET : CHICAGO_MINOR_SET;
    const isMinor = minorSet.has(lowerCore);

    // Determine whether this word/part should be capitalized:
    // - Rule 1: First or last word of title, or first word after ':' or em dash '—'
    // - Rule 2: In AP style, capitalize any word of 4+ letters
    // - Rule 3: Hyphenated compounds: capitalize every part, except a minor word after the hyphen stays lowercase
    let shouldCapitalize = false;

    if (!isSubpart) {
      if (isFirstWord || isLastWord || forceCapBefore) {
        shouldCapitalize = true;
      } else if (opts.style === 'ap' && Array.from(lowerCore).length >= 4) {
        shouldCapitalize = true;
      } else if (!isMinor) {
        shouldCapitalize = true;
      }
    } else {
      // Subpart after a hyphen (Rule 3)
      // Minor word after hyphen stays lowercase (e.g. Up-to-Date, Step-by-Step)
      if (opts.style === 'ap' && Array.from(lowerCore).length >= 4) {
        shouldCapitalize = true;
      } else if (!isMinor) {
        shouldCapitalize = true;
      }
    }

    if (!shouldCapitalize) {
      return leadApos + lowerCore + trailApos;
    }

    // Rule 4: Apostrophes and contractions (don't -> Don't, it's -> It's, o'connor -> O'Connor is name,
    // rule says: "Never capitalize the letter after an apostrophe.")
    const aposParts = core.split(/(['’'])/);
    let resultCore = '';
    let capitalizedFirst = false;

    for (let i = 0; i < aposParts.length; i++) {
      const seg = aposParts[i];
      if (seg === "'" || seg === '’') {
        resultCore += seg;
      } else if (!capitalizedFirst && hasLetters(seg)) {
        resultCore += capitalizeFirstLetter(seg);
        capitalizedFirst = true;
      } else {
        resultCore += seg.toLowerCase();
      }
    }

    return leadApos + resultCore + trailApos;
  }

  // A word token: letters/digits joined by apostrophes or hyphens, or a standalone 'n'
  const RE_WORD_TOKEN = /'(?:n|N)'|’(?:n|N)’|[\p{L}\p{N}]+(?:['’'-][\p{L}\p{N}]+)*['’']*/gu;

  /**
   * Core title-case processor for a single logical title (which may consist of one
   * or more text segments, e.g., across nested HTML tags within an <h1>..</h1>).
   *
   * Returns { segments: string[], wordsChanged: number, headingChanged: boolean }
   */
  function processTitleSegments(segments, opts, forceAllCapsContext) {
    // 1. Check if the entire combined visible text of this title is ALL CAPS (Rule 7)
    // Ignore masked spans (\uE000\d+\uE001) when checking letters
    const visibleCombined = segments.join('').replace(/\uE000\d+\uE001/g, '');
    const letterMatches = visibleCombined.match(/\p{L}/gu) || [];
    const isAllCapsLine =
      forceAllCapsContext !== undefined
        ? forceAllCapsContext
        : letterMatches.length >= 2 && isAllUpperCase(visibleCombined);

    // 2. Locate all word tokens across all segments
    // A word token is a contiguous sequence of letters, digits, apostrophes, and hyphens,
    // or standalone `'n'`
    const allTokens = [];
    for (let sIdx = 0; sIdx < segments.length; sIdx++) {
      const seg = segments[sIdx];
      let match;
      RE_WORD_TOKEN.lastIndex = 0;
      while ((match = RE_WORD_TOKEN.exec(seg)) !== null) {
        const word = match[0];
        // Ignore tokens that have no letters and no digits (shouldn't happen)
        if (!RE_ALPHANUM.test(word)) continue;
        allTokens.push({
          segIndex: sIdx,
          start: match.index,
          end: match.index + word.length,
          text: word
        });
      }
    }

    if (allTokens.length === 0) {
      return { segments: segments.slice(), wordsChanged: 0, headingChanged: false };
    }

    // Rule 8: Punctuation and quotes: skip leading and trailing punctuation or quote marks
    // when deciding the "first" and "last" word. Because RE_WORD_TOKEN only matches alphanumeric
    // words (skipping any surrounding quotes/punctuation), the first token containing a letter or
    // alphanumeric is the first word, and the last token is the last word.
    const firstWordIdx = 0;
    const lastWordIdx = allTokens.length - 1;

    // 3. Determine which tokens immediately follow a colon `:` or an em dash `—` (or `--` / `&#8212;`)
    for (let tIdx = 0; tIdx < allTokens.length; tIdx++) {
      const tok = allTokens[tIdx];
      tok.isFirstWord = tIdx === firstWordIdx;
      tok.isLastWord = tIdx === lastWordIdx;
      tok.forceCapBefore = false;

      if (tIdx > 0) {
        const prevTok = allTokens[tIdx - 1];
        let between = '';
        if (prevTok.segIndex === tok.segIndex) {
          between = segments[tok.segIndex].slice(prevTok.end, tok.start);
        } else {
          between = segments[prevTok.segIndex].slice(prevTok.end);
          for (let m = prevTok.segIndex + 1; m < tok.segIndex; m++) {
            between += segments[m];
          }
          between += segments[tok.segIndex].slice(0, tok.start);
        }
        // Strip masked tags/spans when checking for ':' or em-dash '—'
        const cleanBetween = between.replace(/\uE000\d+\uE001/g, '');
        if (/[:\u2014]/.test(cleanBetween)) {
          tok.forceCapBefore = true;
        }
      }
    }

    // 4. Convert each token and rebuild segments
    let wordsChanged = 0;
    let headingChanged = false;

    for (let tIdx = 0; tIdx < allTokens.length; tIdx++) {
      const tok = allTokens[tIdx];
      const rawWord = tok.text;

      // Rule 3: Hyphenated compounds
      const hyphenParts = rawWord.split('-');
      const convertedParts = hyphenParts.map((part, pIdx) =>
        convertSinglePart(part, {
          // The first part of a hyphenated compound is always capitalized
          // (Up-to-Date, Step-by-Step), since the compound as a whole is a major word.
          isFirstWord: (tok.isFirstWord || hyphenParts.length > 1) && pIdx === 0,
          isLastWord: tok.isLastWord && pIdx === hyphenParts.length - 1,
          forceCapBefore: tok.forceCapBefore && pIdx === 0,
          isSubpart: pIdx > 0,
          isAllCapsLine,
          opts
        })
      );

      tok.replacement = convertedParts.join('-');
      if (tok.replacement !== rawWord) {
        wordsChanged++;
        headingChanged = true;
      }
    }

    // Reconstruct each segment from right to left
    const newSegments = segments.slice();
    for (let tIdx = allTokens.length - 1; tIdx >= 0; tIdx--) {
      const tok = allTokens[tIdx];
      if (tok.replacement !== tok.text) {
        const s = newSegments[tok.segIndex];
        newSegments[tok.segIndex] = s.slice(0, tok.start) + tok.replacement + s.slice(tok.end);
      }
    }

    return {
      segments: newSegments,
      wordsChanged,
      headingChanged
    };
  }

  /**
   * Public helper: converts one plain string with no markup handling (still preserves inline URLs/emails).
   */
  function titleCaseString(str, options) {
    if (typeof str !== 'string' || str.length === 0) {
      return typeof str === 'string' ? str : '';
    }
    const opts = normalizeOptions(options);
    const masker = createMasker();
    const masked = maskUrlsAndEmails(str, masker);
    const res = processTitleSegments([masked], opts);
    return masker.unmask(res.segments[0]);
  }

  // ============================================================================
  // 6. FORMAT-SPECIFIC PROCESSORS (Markdown, HTML, Plain)
  // ============================================================================

  /**
   * Splits text into lines while preserving exact line endings (\r\n or \n).
   */
  function splitLinesWithEndings(text) {
    const lines = [];
    const re = /([^\r\n]*)(\r\n|\n|$)/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match.index === text.length && match[0] === '') break;
      lines.push({
        content: match[1],
        ending: match[2]
      });
      if (match[2] === '') break;
    }
    return lines;
  }

  /**
   * Process Markdown text according to scope ("headings" or "all").
   */
  function processMarkdown(text, opts) {
    let headingsFound = 0;
    let headingsChanged = 0;
    let wordsChanged = 0;

    const lines = splitLinesWithEndings(text);
    let inFence = false;
    let fenceChar = '';
    let fenceLen = 0;
    let prevLineBlank = true;
    let inIndentedCode = false;

    const outLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].content;
      const ending = lines[i].ending;
      const trimmed = line.trim();

      // 1. Check for fenced code block start/end (``` or ~~~)
      const fenceMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[1];
        if (!inFence) {
          inFence = true;
          fenceChar = marker[0];
          fenceLen = marker.length;
          inIndentedCode = false;
          outLines.push(line + ending);
          prevLineBlank = false;
          continue;
        } else if (marker[0] === fenceChar && marker.length >= fenceLen && /^[ \t]*$/.test(line.slice(fenceMatch[0].length))) {
          inFence = false;
          fenceChar = '';
          fenceLen = 0;
          outLines.push(line + ending);
          prevLineBlank = false;
          continue;
        }
      }

      if (inFence) {
        outLines.push(line + ending);
        continue;
      }

      // 2. Check for indented code blocks (4+ spaces or 1+ tab after a blank line or continuing indented block)
      const isBlank = trimmed.length === 0;
      if (isBlank) {
        outLines.push(line + ending);
        // Blank lines inside indented code don't reset inIndentedCode if next line is indented,
        // so prevLineBlank stays true
        prevLineBlank = true;
        continue;
      }

      if ((prevLineBlank || inIndentedCode) && /^(?: {4,}|\t+)/.test(line)) {
        inIndentedCode = true;
        outLines.push(line + ending);
        prevLineBlank = false;
        continue;
      }
      inIndentedCode = false;
      prevLineBlank = false;

      // 3. Check for ATX Headings: # through ##### (H1 to H5; H6 is left unchanged!)
      const hMatch = line.match(/^([ \t]{0,3}#{1,5}[ \t]+)(.*?)([ \t]+#+[ \t]*|[ \t]*)$/);
      const isH6 = /^[ \t]{0,3}#{6}[ \t]+/.test(line);

      if (hMatch) {
        headingsFound++;
        const prefix = hMatch[1];
        const body = hMatch[2];
        const suffix = hMatch[3];

        const masker = createMasker();
        const maskedBody = maskMarkdownInline(body, masker);
        const res = processTitleSegments([maskedBody], opts);
        if (res.headingChanged) {
          headingsChanged++;
          wordsChanged += res.wordsChanged;
        }
        const restoredBody = masker.unmask(res.segments[0]);
        outLines.push(prefix + restoredBody + suffix + ending);
        continue;
      }

      if (isH6) {
        // Spec: "H6 is left unchanged."
        outLines.push(line + ending);
        continue;
      }

      // 4. If scope is "all", convert non-heading Markdown lines while keeping syntax
      if (opts.scope === 'all') {
        // Preserve leading blockquote `>`, list markers (`- `, `* `, `+ `, `1. `), etc.
        const prefixMatch = line.match(/^([ \t]*(?:>[ \t]*)*(?:(?:[-*+]|\d+[.)])[ \t]+)?)(.*)$/);
        const linePrefix = prefixMatch ? prefixMatch[1] : '';
        const lineBody = prefixMatch ? prefixMatch[2] : line;

        const masker = createMasker();
        const maskedBody = maskMarkdownInline(lineBody, masker);
        const res = processTitleSegments([maskedBody], opts);
        wordsChanged += res.wordsChanged;
        const restoredBody = masker.unmask(res.segments[0]);
        outLines.push(linePrefix + restoredBody + ending);
      } else {
        outLines.push(line + ending);
      }
    }

    return {
      output: outLines.join(''),
      headingsFound,
      headingsChanged,
      wordsChanged
    };
  }

  /**
   * Tokenizes HTML into an array of nodes:
   * - { type: 'protected', raw } for comments, <script>, <style>, <pre>, <code>
   * - { type: 'tag', raw, tagName, isClosing } for other HTML tags
   * - { type: 'text', raw } for text nodes
   */
  function tokenizeHtml(html) {
    const tokens = [];
    const len = html.length;
    let i = 0;

    while (i < len) {
      const lt = html.indexOf('<', i);
      if (lt === -1) {
        tokens.push({ type: 'text', raw: html.slice(i) });
        break;
      }
      if (lt > i) {
        tokens.push({ type: 'text', raw: html.slice(i, lt) });
        i = lt;
      }

      const rest = html.slice(i);

      // 1. HTML Comment
      if (rest.startsWith('<!--')) {
        const endComment = html.indexOf('-->', i + 4);
        if (endComment !== -1) {
          tokens.push({ type: 'protected', raw: html.slice(i, endComment + 3) });
          i = endComment + 3;
          continue;
        }
      }

      // 2. Protected raw elements: script, style, pre, code
      const protMatch = rest.match(/^<(script|style|pre|code)(?=\s|>|\/)[^>]*>/i);
      if (protMatch && !protMatch[0].endsWith('/>')) {
        const tagName = protMatch[1].toLowerCase();
        const closeRegex = new RegExp('<\\/' + tagName + '\\s*>', 'i');
        const afterOpen = i + protMatch[0].length;
        const closeMatch = closeRegex.exec(html.slice(afterOpen));
        if (closeMatch) {
          const endIdx = afterOpen + closeMatch.index + closeMatch[0].length;
          tokens.push({ type: 'protected', raw: html.slice(i, endIdx) });
          i = endIdx;
          continue;
        }
      }

      // 3. Standard HTML tag
      const tagMatch = rest.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)(?:\s[^>]*)?\/?>/);
      if (tagMatch) {
        tokens.push({
          type: 'tag',
          raw: tagMatch[0],
          isClosing: tagMatch[1] === '/',
          tagName: tagMatch[2].toLowerCase()
        });
        i += tagMatch[0].length;
        continue;
      }

      // Fallback: literal '<' that isn't a tag
      tokens.push({ type: 'text', raw: '<' });
      i += 1;
    }

    return tokens;
  }

  /**
   * Process HTML text according to scope ("headings" or "all").
   */
  function processHtml(text, opts) {
    let headingsFound = 0;
    let headingsChanged = 0;
    let wordsChanged = 0;

    const tokens = tokenizeHtml(text);
    const len = tokens.length;
    let idx = 0;

    const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5']);
    const BLOCK_TAGS = new Set([
      'p', 'div', 'li', 'blockquote', 'td', 'th', 'dt', 'dd',
      'figcaption', 'caption', 'article', 'section', 'header', 'footer',
      'aside', 'nav', 'main', 'address', 'h6'
    ]);

    while (idx < len) {
      const tok = tokens[idx];

      // Check for <h1>..<h5> heading block
      if (tok.type === 'tag' && !tok.isClosing && HEADING_TAGS.has(tok.tagName)) {
        const hTag = tok.tagName;
        let endIdx = idx + 1;
        while (endIdx < len) {
          if (tokens[endIdx].type === 'tag' && tokens[endIdx].isClosing && tokens[endIdx].tagName === hTag) {
            break;
          }
          endIdx++;
        }

        headingsFound++;
        const textTokenIndices = [];
        const rawSegments = [];
        const masker = createMasker();

        for (let k = idx + 1; k < endIdx; k++) {
          if (tokens[k].type === 'text') {
            textTokenIndices.push(k);
            rawSegments.push(maskUrlsAndEmails(tokens[k].raw, masker));
          }
        }

        if (rawSegments.length > 0) {
          const res = processTitleSegments(rawSegments, opts);
          if (res.headingChanged) {
            headingsChanged++;
            wordsChanged += res.wordsChanged;
            for (let s = 0; s < textTokenIndices.length; s++) {
              tokens[textTokenIndices[s]].raw = masker.unmask(res.segments[s]);
            }
          }
        }

        idx = endIdx + 1;
        continue;
      }

      // If scope is "all", process text nodes outside of H1-H5 per block-level grouping
      if (opts.scope === 'all') {
        if (tok.type === 'text' || (tok.type === 'tag' && !BLOCK_TAGS.has(tok.tagName) && !HEADING_TAGS.has(tok.tagName))) {
          // Collect inline text segments until next block tag or heading tag
          const textTokenIndices = [];
          const rawSegments = [];
          const masker = createMasker();

          let scanIdx = idx;
          while (scanIdx < len) {
            const t = tokens[scanIdx];
            if (t.type === 'tag' && (BLOCK_TAGS.has(t.tagName) || HEADING_TAGS.has(t.tagName))) {
              break;
            }
            if (t.type === 'text') {
              textTokenIndices.push(scanIdx);
              rawSegments.push(maskUrlsAndEmails(t.raw, masker));
            }
            scanIdx++;
          }

          if (rawSegments.length > 0) {
            const res = processTitleSegments(rawSegments, opts);
            if (res.headingChanged) {
              wordsChanged += res.wordsChanged;
              for (let s = 0; s < textTokenIndices.length; s++) {
                tokens[textTokenIndices[s]].raw = masker.unmask(res.segments[s]);
              }
            }
          }

          idx = scanIdx > idx ? scanIdx : idx + 1;
          continue;
        }
      }

      idx++;
    }

    return {
      output: tokens.map(t => t.raw).join(''),
      headingsFound,
      headingsChanged,
      wordsChanged
    };
  }

  /**
   * Determines if a line at index `i` in `lines` qualifies as a Plain Text heading.
   *
   * Plain text heading rules:
   * 1. A line is a heading if ALL of these hold:
   *    - it is non-empty
   *    - it is at the start of the document or follows a blank line
   *    - it is followed by a blank line or the end of the document
   *    - it is 100 characters or fewer
   *    - it does not end with `.`, `,` or `;`
   * 2. A line entirely in uppercase that is 100 characters or fewer and has at least 2 words
   *    also counts as a heading.
   */
  function isPlainTextHeading(lines, i) {
    const rawLine = lines[i].content;
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) return false;
    if (rawLine.length > 100) return false;

    // Rule B: Entirely in uppercase, <= 100 chars, and >= 2 words
    if (isAllUpperCase(trimmed) && countWordsInString(trimmed) >= 2) {
      return true;
    }

    // Rule A: Surrounded by blank lines / document boundaries, <= 100 chars, doesn't end with .,;
    const prevIsBlankOrStart = i === 0 || lines[i - 1].content.trim().length === 0;
    const nextIsBlankOrEnd =
      i === lines.length - 1 ||
      (i === lines.length - 2 && lines[lines.length - 1].content === '' && lines[lines.length - 1].ending === '') ||
      lines[i + 1].content.trim().length === 0;

    if (!prevIsBlankOrStart || !nextIsBlankOrEnd) {
      return false;
    }

    if (/[.,;]$/.test(trimmed)) {
      return false;
    }

    return true;
  }

  /**
   * Process Plain Text according to scope ("headings" or "all").
   */
  function processPlainText(text, opts) {
    let headingsFound = 0;
    let headingsChanged = 0;
    let wordsChanged = 0;

    const lines = splitLinesWithEndings(text);
    const outLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].content;
      const ending = lines[i].ending;

      if (line.trim().length === 0) {
        outLines.push(line + ending);
        continue;
      }

      const isHeading = isPlainTextHeading(lines, i);
      if (isHeading) {
        headingsFound++;
      }

      if (isHeading || opts.scope === 'all') {
        const masker = createMasker();
        const maskedLine = maskUrlsAndEmails(line, masker);
        const res = processTitleSegments([maskedLine], opts);

        if (res.headingChanged) {
          wordsChanged += res.wordsChanged;
          if (isHeading) {
            headingsChanged++;
          }
        }

        outLines.push(masker.unmask(res.segments[0]) + ending);
      } else {
        outLines.push(line + ending);
      }
    }

    return {
      output: outLines.join(''),
      headingsFound,
      headingsChanged,
      wordsChanged
    };
  }

  // ============================================================================
  // 7. PUBLIC API: convert()
  // ============================================================================

  /**
   * Main entry point. Converts input text according to options and returns
   * { output, format, stats }. Never throws on any input.
   */
  function convert(text, options) {
    try {
      const safeText = typeof text === 'string' ? text : '';
      const opts = normalizeOptions(options);
      const format = opts.format === 'auto' ? detectFormat(safeText) : opts.format;

      const characters = safeText.length;
      const words = countWordsInString(safeText);

      if (safeText.length === 0 || safeText.trim().length === 0) {
        return {
          output: safeText,
          format,
          stats: {
            headingsFound: 0,
            headingsChanged: 0,
            wordsChanged: 0,
            characters,
            words
          }
        };
      }

      let result;
      if (format === 'html') {
        result = processHtml(safeText, opts);
      } else if (format === 'markdown') {
        result = processMarkdown(safeText, opts);
      } else {
        result = processPlainText(safeText, opts);
      }

      return {
        output: result.output,
        format,
        stats: {
          headingsFound: result.headingsFound,
          headingsChanged: result.headingsChanged,
          wordsChanged: result.wordsChanged,
          characters,
          words
        }
      };
    } catch (_) {
      const fallbackText = typeof text === 'string' ? text : '';
      return {
        output: fallbackText,
        format: 'plain',
        stats: {
          headingsFound: 0,
          headingsChanged: 0,
          wordsChanged: 0,
          characters: fallbackText.length,
          words: 0
        }
      };
    }
  }

  return Object.freeze({
    convert,
    detectFormat,
    titleCaseString,
    RULES
  });
});