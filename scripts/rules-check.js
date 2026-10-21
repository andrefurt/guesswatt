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
 *
 * Usage:
 *   node scripts/rules-check.js   # prints one line per rule; exits 1 on any breach
 */

const fs = require('fs');
const path = require('path');

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
 * Splits JavaScript into the code with comments blanked, the code with comments, strings and regex
 * literals blanked, and the strings (template chunks included). Blanking keeps every offset, so a
 * match still gives its line.
 */
function lexJs(src) {
  const bare = src.split('');
  const skeleton = src.split('');
  const strings = [];
  const blank = (chars, from, to) => { for (let k = from; k < to; k++) if (chars[k] !== '\n') chars[k] = ' '; };
  const stack = []; // '{' for a block, '`' for a template substitution
  let last = '';    // the previous token, to tell a regex from a division
  let i = 0;

  const readTemplate = start => {
    let j = start;
    while (j < src.length && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) j += src[j] === '\\' ? 2 : 1;
    strings.push({ text: src.slice(start, j), at: start });
    blank(skeleton, start, j);
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
      blank(bare, i, end); blank(skeleton, i, end); i = end; continue;
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2) < 0 ? src.length : src.indexOf('*/', i + 2) + 2;
      blank(bare, i, end); blank(skeleton, i, end); i = end; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      strings.push({ text: src.slice(i + 1, j), at: i + 1 });
      blank(skeleton, i + 1, j); i = j + 1; last = 'a'; continue;
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
      blank(skeleton, i + 1, j); i = j + 1; last = 'a'; continue;
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
  return { bare: bare.join(''), skeleton: skeleton.join(''), strings };
}

// The page with scripts, styles and comments blanked: what a user reads, attributes included
const htmlText = src => src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, m => m.replace(/[^\n]/g, ' '));

const lineOf = (src, offset) => src.slice(0, offset).split('\n').length;

function check() {
  const breaches = { 1: [], 3: [], 7: [], 4: [], css: [] };
  const sources = Object.fromEntries([...JS, ...CSS, ...PAGES, ...TEXTS].map(file => [file, read(file)]));
  const prose = []; // { file, src, text, at }

  for (const file of JS) {
    const src = sources[file];
    const { bare, skeleton, strings } = lexJs(src);

    for (const m of skeleton.matchAll(/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/g)) {
      breaches[3].push(`${file}:${lineOf(src, m.index)}: ${m[1]}; app state lives in the URL (js/url-state.js)`);
    }
    for (const m of bare.matchAll(/\bimport\s*(?:[\w$*{}\s,]+?\s*from\s*)?\(?\s*['"]([^'"]+)['"]|\bimportScripts\s*\(\s*['"]([^'"]+)['"]/g)) {
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
    for (const s of strings) prose.push({ file, src, text: s.text, at: s.at });
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

  const labels = {
    1: 'Rule 1: relative imports only',
    3: 'Rule 3: no browser storage',
    7: 'Rule 7: no HTML sinks',
    4: 'Rule 4 and copy.md: PT-PT text',
    css: 'CSS: every var(--*) is defined',
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
