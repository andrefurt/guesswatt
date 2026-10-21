/**
 * Size budget
 *
 * Gzips each file the way a server would send it (Node's zlib, default level) and checks the sums
 * against the budget table in docs/TECH_STACK.mdc (between the size-check markers). The limits live
 * only in that table; this script owns which files each row counts. Part of the gate (alfred.json).
 *
 * Usage:
 *   node scripts/size-check.js   # prints every row; exits 1 when one is over or the table is unreadable
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const BUDGET_DOC = 'docs/TECH_STACK.mdc';
const KB = 1000;

const filesIn = (dir, ext) => fs.readdirSync(path.join(ROOT, dir))
  .filter(name => name.endsWith(ext))
  .sort()
  .map(name => `${dir}/${name}`);

const css = filesIn('css', '.css');
const js = [...filesIn('js', '.js'), 'components.js'];

// Each row of the budget table, by its first cell, and the files it sums
const ROWS = {
  'index.html': ['index.html'],
  'sobre.html': ['sobre.html'],
  'CSS': css,
  'JavaScript': js,
  'Landing page': ['index.html', ...css, ...js, 'vendor/fonts/inter-latin.woff2'],
};

function readBudget() {
  const doc = fs.readFileSync(path.join(ROOT, BUDGET_DOC), 'utf8');
  const table = doc.match(/<!-- size-check -->([\s\S]*?)<!-- \/size-check -->/);
  if (!table) throw new Error(`${BUDGET_DOC}: no <!-- size-check --> table`);
  const limits = {};
  for (const line of table[1].split('\n')) {
    const cells = line.split('|').map(cell => cell.trim());
    const kb = cells[cells.length - 2]?.match(/^([\d.]+) KB$/);
    if (kb) limits[cells[1].replace(/`/g, '')] = Number(kb[1]) * KB;
  }
  for (const row of Object.keys(ROWS)) {
    if (!limits[row]) throw new Error(`${BUDGET_DOC}: the size-check table has no "${row}" row`);
  }
  return limits;
}

const gzipSize = file => zlib.gzipSync(fs.readFileSync(path.join(ROOT, file))).length;

function main() {
  const limits = readBudget();
  let over = 0;
  for (const [row, files] of Object.entries(ROWS)) {
    const size = files.reduce((sum, file) => sum + gzipSize(file), 0);
    const ok = size <= limits[row];
    if (!ok) over++;
    const pct = Math.round((size / limits[row]) * 100);
    console.log(`${ok ? '✅' : '❌'} ${row}: ${(size / KB).toFixed(1)} KB of ${limits[row] / KB} KB (${pct}%)`);
  }
  if (over) {
    console.error(`\n${over} row(s) over the budget in ${BUDGET_DOC}. Shrink the change, or raise the limit there with the reason.`);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
