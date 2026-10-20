/**
 * ERSE CSV Downloader
 *
 * Downloads the latest electricity pricing data from ERSE's price simulator with plain fetch,
 * no browser (ADR-005 superseded):
 * 1. Settings.json names the current ZIP in `csvPath` (a URL with spaces, encoded here).
 * 2. The ZIP's name carries ERSE's export date ("20261019 172747 CSV.zip"); that date, not the
 *    download time, becomes `updatedAt` in data/meta.json, which build-offers.js publishes.
 * 3. The ZIP is read in memory with zlib. Its entries use Windows paths (`csv\Precos_ELEGN.csv`),
 *    so names are normalised to their basename.
 *
 * Usage:
 *   node scripts/download-erse.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SETTINGS_URL = 'https://simuladorprecos.erse.pt/config/Settings.json';
const ERSE_HOST = 'simuladorprecos.erse.pt';
const DATA_DIR = path.join(__dirname, '..', 'data');
const REQUIRED_FILES = ['Precos_ELEGN.csv', 'CondComerciais.csv'];

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const TIMEOUT_MS = 60000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.log(`⚠️  Attempt ${attempt + 1} failed: ${error.message}`);
        console.log(`   Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

async function fetchOk(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status} ${response.statusText}`);
  }
  return response;
}

/**
 * Reads csvPath from Settings.json and checks it still points to an ERSE ZIP.
 */
async function getZipUrl() {
  const settings = await retryWithBackoff(async () => (await fetchOk(SETTINGS_URL)).json());
  const csvPath = settings?.csvPath;
  if (typeof csvPath !== 'string') {
    throw new Error(`Settings.json has no csvPath; keys found: ${Object.keys(settings || {}).join(', ')}`);
  }

  const url = new URL(encodeURI(csvPath));
  if (url.protocol !== 'https:' || url.hostname !== ERSE_HOST || !url.pathname.toLowerCase().endsWith('.zip')) {
    throw new Error(`csvPath is not an https ZIP on ${ERSE_HOST}: ${csvPath}`);
  }
  return { url: url.href, csvPath };
}

/**
 * ERSE's export date from the ZIP name ("20261019 172747 CSV.zip"), as midnight UTC of that day.
 */
function parseExportDate(csvPath) {
  const match = path.posix.basename(csvPath).match(/^(\d{4})(\d{2})(\d{2})\D/);
  if (!match) {
    throw new Error(`No export date in the ZIP name: ${csvPath}`);
  }
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new Error(`Invalid export date in the ZIP name: ${csvPath}`);
  }
  return date.toISOString();
}

/**
 * Reads every file in a ZIP buffer through its central directory.
 * Returns a Map of basename to contents (Buffer).
 */
function unzip(buffer) {
  // End of central directory record: signature 0x06054b50, within the last 64 KB + 22 bytes
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('Not a ZIP file: no end of central directory');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = new Map();

  for (let n = 0; n < entryCount; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt ZIP central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/') || name.endsWith('\\')) continue; // directory entry

    // The local header repeats name and extra field with its own lengths
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Corrupt ZIP entry: ${name}`);
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    let contents;
    if (method === 0) contents = data;
    else if (method === 8) contents = zlib.inflateRawSync(data);
    else throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);

    // ERSE builds the ZIP on Windows: `csv\Precos_ELEGN.csv`
    files.set(name.split(/[\\/]/).pop(), contents);
  }
  return files;
}

/**
 * Count lines in CSV contents (excluding empty lines)
 */
function countCSVLines(contents) {
  return contents.toString('utf8').split('\n').filter(line => line.trim().length > 0).length;
}

async function downloadERSE() {
  console.log('🔄 Starting ERSE data download...');

  const { url, csvPath } = await getZipUrl();
  const updatedAt = parseExportDate(csvPath);
  console.log(`📡 ${url}`);
  console.log(`📅 ERSE export date: ${updatedAt.slice(0, 10)}`);

  const zip = await retryWithBackoff(async () => {
    const buffer = Buffer.from(await (await fetchOk(url)).arrayBuffer());
    if (buffer.length < 1000) {
      throw new Error(`Downloaded file too small: ${buffer.length} bytes`);
    }
    return buffer;
  });
  console.log(`📦 File size: ${(zip.length / 1024).toFixed(1)} KB`);

  const files = unzip(zip);
  console.log('📄 Files in the ZIP:', [...files.keys()]);

  const meta = { updatedAt, sourceUrl: url, files: {} };
  for (const name of REQUIRED_FILES) {
    const contents = files.get(name);
    if (!contents) {
      throw new Error(`Missing ${name}. Found: ${[...files.keys()].join(', ')}`);
    }
    if (contents.length < 100) {
      throw new Error(`${name} too small: ${contents.length} bytes`);
    }
    meta.files[name] = { rows: countCSVLines(contents) - 1, path: `data/${name}` };
  }

  // Write only after both files passed, so a failed run leaves data/ as it was
  for (const name of REQUIRED_FILES) {
    fs.writeFileSync(path.join(DATA_DIR, name), files.get(name));
  }
  fs.writeFileSync(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log('');
  console.log('✅ Update complete!');
  for (const name of REQUIRED_FILES) {
    console.log(`   - ${name}: ${meta.files[name].rows} rows`);
  }
  console.log(`   - ERSE date: ${meta.updatedAt}`);
}

// Run
if (require.main === module) {
  downloadERSE().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = { downloadERSE, parseExportDate, unzip };
