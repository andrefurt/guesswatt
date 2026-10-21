/**
 * Rules check
 *
 * Greps the shipped files for the CLAUDE.md rules a script can test. Part of the gate (alfred.json),
 * so it runs before every commit and in CI. What stays judgement (semantic HTML, keyboard, the
 * voice) is not here.
 * - Rule 1: imports are relative paths; no bare specifiers and no URLs.
 * - Rule 3: no localStorage, sessionStorage, IndexedDB or cookies; app state lives in the URL.
 * - Rule 7: no HTML sink (innerHTML, outerHTML, insertAdjacentHTML, document.write) except
 *   clearing with '', unless HTML_SINKS_ALLOWED names the file and why.
 * - Rule 4 and .claude/rules/copy.md: the text a user reads (JS strings, the pages, index.md,
 *   sobre.md, the manifest) has no formal address, no Brazilian forms, no pre-AO90 spelling, no
 *   gerunds, no em dashes and no "€54.28" numbers. Code comments and regex literals are skipped:
 *   the PDF parser has to match what the bills say.
 * - CSS: every var(--*) has a definition.
 * - Shipped files: every local file the site loads (src and href in the pages, file paths in JS
 *   strings, url() in CSS, the manifest's icons) is tracked by git. The site ships what git holds, so
 *   an ignored or uncommitted file works locally and 404s live (PDF.js, hidden by *.min.js).
 * - Doc links: every relative link in README.md, CLAUDE.md, docs/ and .claude/rules/ opens a tracked
 *   file. docs/audit/ and docs/archive/ are history and are not checked.
 *
 * Usage:
 *   node scripts/rules-check.js   # prints one line per rule; exits 1 on any breach
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const filesIn = (dir, ext) => fs.readdirSync(path.join(ROOT, dir))
  .filter(name => name.endsWith(ext))
  .sort()
  .map(name => `${dir}/${name}`);

const JS = [...filesIn('js', '.js'), 'sw.js'];
const CSS = filesIn('css', '.css');
const PAGES = ['index.html', 'sobre.html'];
const TEXTS = ['index.md', 'sobre.md', 'manifest.webmanifest'];
const DOCS = ['README.md', 'CLAUDE.md', ...filesIn('docs', '.md'), ...filesIn('docs', '.mdc'), ...filesIn('.claude/rules', '.md')];

// A string that is a whole file path ('vendor/pdfjs/pdf.min.js', './utils.js'), not a URL or a word
const FILE_PATH = /^(?:\.{1,2}\/)*(?:[\w.-]+\/)*[\w.-]+\.(?:html|md|js|mjs|css|json|webmanifest|woff2?|svg|png|jpe?g|webp|ico|txt)$/;
const isLocal = url => !/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(url);
// The repo path a reference resolves to: './x' and '../x' from the referring file, anything else
// from the site root (the pages and sw.js sit at the root, and fetch() resolves against the page)
const resolveRef = (from, url, relativeToFile) => {
  const clean = decodeURI(url.split(/[?#]/)[0]);
  const base = relativeToFile || /^\.{1,2}\//.test(clean) ? path.dirname(from) : '.';
  return path.posix.normalize(path.posix.join(base, clean)).replace(/\/$/, '');
};

// HTML sinks that are reviewed and safe: { file: 'js/x.js', why: '...' }
const HTML_SINKS_ALLOWED = [];

// Words that end like a gerund but are not one
const NOT_GERUNDS = new Set([
  'quando', 'segundo', 'segundos', 'fundo', 'mundo', 'comando', 'brando', 'lindo',
  'incluindo', // works as a preposition ("including"); no "a" + infinitive replaces it
]);

// Built from its code so the dash itself never sits in this file
const EM_DASH = String.fromCharCode(0x2014);

// A whole word: \b treats accented letters as non-word characters, so "você" would never match
const word = source => new RegExp(`(?<!\\p{L})(?:${source})(?!\\p{L})`, 'giu');

// Each prose rule: a pattern over the text a user reads and the fix the message gives
const PROSE = [
  { re: word('vocês?'), fix: 'use "tu" (rule 4)' },
  { re: word('usuári[oa]s?|registro|celular|arquivos?|contatos?|cadastr\\p{L}*|senha|aplicativo|economiz\\p{L}*|\\p{L}*[ôê]mic[oa]s?|anônim[oa]s?|eletrônic[oa]s?|telefônic[oa]s?'), fix: 'Brazilian form; use the PT-PT word (utilizador, registo, telemóvel, ficheiro, contacto, poupar, económico)' },
  { re: word('factura\\p{L}*|electricidade|el[eé]ctric[oa]s?|actua(?:l|liz)\\p{L}*|exact[oa]s?|projecto\\p{L}*|direc[çc][ãa]o|[óo]ptim[oa]s?|extrac[çc][ãa]o'), fix: 'pre-AO90 spelling; write fatura, eletricidade, atual, exato, projeto, ótimo, extração (copy.md rule 4)' },
  { re: word('\\p{L}{2,}(?:ando|endo|indo)'), fix: 'gerund; PT-PT uses "a" + infinitive ("a gastar", copy.md rule 7)', skip: match => NOT_GERUNDS.has(match.toLowerCase()) },
  { re: new RegExp(EM_DASH, 'g'), fix: 'em dash; use a colon, a comma or a full stop (copy.md rule 7)' },
  { re: /€\s?\d[\d.,]*|(?<![\d.,])\d+\.\d+\s?(?:€|kVA|kWh)/g, fix: 'number in English form; write "54,28 €" or "4,6 kVA" through formatEuro or formatNumber (copy.md rule 6)' },
];

/**
 * Splits JavaScript into the code with comments blanked and the strings (template chunks included).
 * Regex literals are skipped whole, so their quotes never start a string. Blanking keeps every
 * offset, so a match still gives its line.
 */
function lexJs(src) {
  const bare = src.split('');
  const strings = [];
  const blank = (chars, from, to) => { for (let k = from; k < to; k++) if (chars[k] !== '\n') chars[k] = ' '; };
  const stack = []; // '{' for a block, '`' for a template substitution
  let last = '';    // the previous token, to tell a regex from a division
  let i = 0;

  const readTemplate = start => {
    let j = start;
    while (j < src.length && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) j += src[j] === '\\' ? 2 : 1;
    strings.push({ text: src.slice(start, j), at: start });
    if (src[j] === '`') { last = 'a'; return j + 1; }
    stack.push('`');
    last = '{';
    return j + 2;
  };

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i);
      blank(bare, i, end); i = end; continue;
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2) < 0 ? src.length : src.indexOf('*/', i + 2) + 2;
      blank(bare, i, end); i = end; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      strings.push({ text: src.slice(i + 1, j), at: i + 1 });
      i = j + 1; last = 'a'; continue;
    }
    if (c === '`') { i = readTemplate(i + 1); continue; }
    if (c === '}' && stack[stack.length - 1] === '`') { stack.pop(); i = readTemplate(i + 1); continue; }
    if (c === '/' && (/^[(,=:[!&|?{};+\-*%<>~^]?$/.test(last) || /^(return|typeof|case|in|of|new|throw|yield|await|void|delete)$/.test(last))) {
      let j = i + 1;
      let inClass = false;
      while (j < src.length && src[j] !== '\n' && (src[j] !== '/' || inClass)) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        j++;
      }
      i = j + 1; last = 'a'; continue;
    }
    if (c === '{') stack.push('{');
    if (c === '}') stack.pop();
    if (/\s/.test(c)) { i++; continue; }
    if (/[\w$]/.test(c)) {
      let j = i;
      while (j < src.length && /[\w$]/.test(src[j])) j++;
      last = src.slice(i, j); i = j; continue;
    }
    last = c;
    i++;
  }
  return { bare: bare.join(''), strings };
}

// The page with scripts, styles and comments blanked: what a user reads, attributes included
const htmlText = src => src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, m => m.replace(/[^\n]/g, ' '));

const lineOf = (src, offset) => src.slice(0, offset).split('\n').length;

function check() {
  const breaches = { 1: [], 3: [], 7: [], 4: [], css: [], files: [], links: [] };
  const sources = Object.fromEntries([...JS, ...CSS, ...PAGES, ...TEXTS, ...DOCS].map(file => [file, read(file)]));
  const prose = []; // { file, src, text, at }
  const refs = [];  // { file, at, url, relativeToFile }: what the site loads

  for (const file of JS) {
    const src = sources[file];
    const { bare, strings } = lexJs(src);

    // On the code with its strings: window['localStorage'] counts too
    for (const m of bare.matchAll(/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/g)) {
      breaches[3].push(`${file}:${lineOf(src, m.index)}: ${m[1]}; app state lives in the URL (js/url-state.js)`);
    }
    for (const m of bare.matchAll(/\b(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?\(?\s*['"]([^'"]+)['"]|\bimportScripts\s*\(\s*['"]([^'"]+)['"]/g)) {
      const specifier = m[1] ?? m[2];
      if (!/^\.{0,2}\//.test(specifier)) {
        breaches[1].push(`${file}:${lineOf(src, m.index)}: import of "${specifier}"; import a relative path ('./x.js') or vendor the file`);
      }
    }
    if (!HTML_SINKS_ALLOWED.some(entry => entry.file === file)) {
      for (const m of bare.matchAll(/\.(innerHTML|outerHTML)\s*\+?=(?!=)\s*([^;\n]*)|\b(insertAdjacentHTML|document\.write(?:ln)?)\s*\(/g)) {
        if (m[1] && /^(''|""|``)$/.test(m[2].trim())) continue;
        breaches[7].push(`${file}:${lineOf(src, m.index)}: ${m[1] ?? m[3]}; build nodes with createElement and textContent`);
      }
    }
    for (const s of strings) {
      prose.push({ file, src, text: s.text, at: s.at });
      if (FILE_PATH.test(s.text)) refs.push({ file, at: s.at, url: s.text });
    }
  }
  for (const file of PAGES) {
    for (const m of sources[file].matchAll(/\b(?:src|href)="([^"]+)"/g)) refs.push({ file, at: m.index, url: m[1] });
  }
  for (const file of CSS) {
    for (const m of sources[file].matchAll(/url\(\s*['"]?([^'")]+)/g)) refs.push({ file, at: m.index, url: m[1], relativeToFile: true });
  }
  for (const m of sources['manifest.webmanifest'].matchAll(/"src"\s*:\s*"([^"]+)"/g)) {
    refs.push({ file: 'manifest.webmanifest', at: m.index, url: m[1] });
  }
  for (const file of PAGES) prose.push({ file, src: sources[file], text: htmlText(sources[file]), at: 0 });
  for (const file of TEXTS) prose.push({ file, src: sources[file], text: sources[file], at: 0 });

  for (const { file, src, text, at } of prose) {
    for (const rule of PROSE) {
      for (const m of text.matchAll(rule.re)) {
        if (rule.skip?.(m[0])) continue;
        breaches[4].push(`${file}:${lineOf(src, at + m.index)}: "${m[0]}"; ${rule.fix}`);
      }
    }
  }

  const styled = [...CSS, ...PAGES, ...JS].map(file => sources[file]).join('\n');
  const defined = new Set([...styled.matchAll(/(--[\w-]+)\s*:|setProperty\(\s*['"](--[\w-]+)/g)].map(m => m[1] ?? m[2]));
  for (const file of [...CSS, ...PAGES, ...JS]) {
    for (const m of sources[file].matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!defined.has(m[1])) breaches.css.push(`${file}:${lineOf(sources[file], m.index)}: var(${m[1]}) has no definition; define it in css/tokens.css or use a token that exists`);
    }
  }

  // The index, staged files included, so a file added in this commit counts
  const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0'));
  const isTracked = file => tracked.has(file) || [...tracked].some(t => t.startsWith(`${file}/`));
  for (const { file, at, url, relativeToFile } of refs) {
    if (!isLocal(url)) continue;
    const target = resolveRef(file, url, relativeToFile);
    if (target === '.' || isTracked(target)) continue;
    breaches.files.push(`${file}:${lineOf(sources[file], at)}: loads ${target}, which git does not track; run \`git check-ignore -v ${target}\` and commit it, or fix the path`);
  }
  for (const file of DOCS) {
    const text = sources[file].replace(/```[\s\S]*?```/g, m => m.replace(/[^\n]/g, ' '));
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (!isLocal(m[1])) continue;
      const target = resolveRef(file, m[1], true);
      if (target === '.' || isTracked(target)) continue;
      breaches.links.push(`${file}:${lineOf(sources[file], m.index)}: links to ${target}, which is not in the repo; point it at the current file or remove the link`);
    }
  }

  const labels = {
    1: 'Rule 1: relative imports only',
    3: 'Rule 3: no browser storage',
    7: 'Rule 7: no HTML sinks',
    4: 'Rule 4 and copy.md: PT-PT text',
    css: 'CSS: every var(--*) is defined',
    files: 'Shipped files: everything the site loads is in git',
    links: 'Doc links: every relative link opens',
  };
  let total = 0;
  for (const [key, label] of Object.entries(labels)) {
    const list = breaches[key];
    total += list.length;
    console.log(`${list.length ? '❌' : '✅'} ${label}${list.length ? ` (${list.length})` : ''}`);
    for (const line of list) console.log(`   ${line}`);
  }
  if (total) {
    console.error(`\n${total} breach(es) of the rules in CLAUDE.md and .claude/rules/. Each line says the fix.`);
    process.exit(1);
  }
}

try {
  check();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
