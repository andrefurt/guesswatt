/**
 * ERSE CSV Downloader
 * 
 * Downloads the latest electricity pricing data from ERSE
 * using Playwright to handle the JavaScript-rendered page.
 * 
 * Features:
 * - Exponential backoff retries
 * - Deterministic temp dir cleanup
 * - Validates both required CSVs after extraction
 * - Writes data/meta.json with timestamp, row counts, source URL
 * 
 * Usage:
 *   node scripts/download-erse.js
 * 
 * Requirements:
 *   npm install playwright
 *   npx playwright install chromium
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ERSE_URL = 'https://simuladorprecos.erse.pt';
const DATA_DIR = path.join(__dirname, '..', 'data');
const TEMP_DIR = path.join(require('os').tmpdir(), 'erse-download');

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Sleep for specified milliseconds
 */
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

/**
 * Clean up temp directory deterministically
 */
function cleanupTempDir() {
  if (fs.existsSync(TEMP_DIR)) {
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      console.warn(`⚠️  Could not clean temp dir: ${error.message}`);
    }
  }
}

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Count lines in CSV file (excluding empty lines)
 */
function countCSVLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').filter(line => line.trim().length > 0).length;
}

/**
 * Write meta.json with download metadata
 */
function writeMeta(sourceUrl, precosPath, condPath) {
  const precosLines = countCSVLines(precosPath);
  const condLines = countCSVLines(condPath);
  const timestamp = new Date().toISOString();
  
  const meta = {
    updatedAt: timestamp,
    sourceUrl: sourceUrl,
    files: {
      'Precos_ELEGN.csv': {
        rows: precosLines - 1, // Exclude header
        path: 'data/Precos_ELEGN.csv'
      },
      'CondComerciais.csv': {
        rows: condLines - 1, // Exclude header
        path: 'data/CondComerciais.csv'
      }
    }
  };
  
  const metaPath = path.join(DATA_DIR, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(`📝 Wrote metadata to ${metaPath}`);
  
  // Also write last-update.json for footer sync
  const now = new Date();
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const lastUpdate = {
    month: months[now.getMonth()],
    year: now.getFullYear().toString()
  };
  
  const lastUpdatePath = path.join(DATA_DIR, 'last-update.json');
  fs.writeFileSync(lastUpdatePath, JSON.stringify(lastUpdate, null, 2));
  console.log(`📝 Wrote last update to ${lastUpdatePath}`);
  
  return meta;
}

/**
 * Main download function
 */
async function downloadERSE() {
  console.log('🔄 Starting ERSE data download...');
  
  // Cleanup temp dir before starting
  cleanupTempDir();
  ensureDir(TEMP_DIR);
  ensureDir(DATA_DIR);
  
  const browser = await chromium.launch({
    headless: true
  });
  
  try {
    const context = await browser.newContext({
      acceptDownloads: true
    });
    
    const page = await context.newPage();
    
    console.log(`📡 Navigating to ${ERSE_URL}...`);
    await page.goto(ERSE_URL, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    // Wait for page to fully load
    await page.waitForTimeout(3000);
    
    console.log('🔍 Looking for CSV download link...');
    
    // Try multiple selectors (ERSE might change their UI)
    const selectors = [
      'text=CSV',
      'text=Ofertas comerciais (CSV)',
      'a[href*=".zip"]',
      'button:has-text("CSV")',
      '[download*="CSV"]'
    ];
    
    let downloadLink = null;
    for (const selector of selectors) {
      try {
        downloadLink = await page.$(selector);
        if (downloadLink) {
          console.log(`✅ Found download link with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!downloadLink) {
      // Log page content for debugging
      const content = await page.content();
      console.log('Page content (first 2000 chars):', content.substring(0, 2000));
      throw new Error('Could not find CSV download link');
    }
    
    // Start download with retry
    console.log('📥 Starting download...');
    const zipPath = path.join(TEMP_DIR, 'erse.zip');
    
    await retryWithBackoff(async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        downloadLink.click()
      ]);
      
      await download.saveAs(zipPath);
      
      // Verify file exists and has content
      const stats = fs.statSync(zipPath);
      if (stats.size < 1000) {
        throw new Error(`Downloaded file too small: ${stats.size} bytes`);
      }
      console.log(`📦 File size: ${(stats.size / 1024).toFixed(1)} KB`);
    });
    
    // Extract ZIP
    console.log('📂 Extracting ZIP...');
    const extractDir = path.join(TEMP_DIR, 'extracted');
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });
    
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'inherit' });
    
    // Find CSV files
    const files = fs.readdirSync(extractDir);
    console.log('📄 Extracted files:', files);
    
    const precosFile = files.find(f => f.toLowerCase().includes('precos') && f.endsWith('.csv'));
    const condFile = files.find(f => f.toLowerCase().includes('cond') && f.endsWith('.csv'));
    
    if (!precosFile || !condFile) {
      throw new Error(`Missing required CSV files. Found: ${files.join(', ')}`);
    }
    
    const precosPath = path.join(extractDir, precosFile);
    const condPath = path.join(extractDir, condFile);
    
    // Validate files have content
    const precosStats = fs.statSync(precosPath);
    const condStats = fs.statSync(condPath);
    
    if (precosStats.size < 100) {
      throw new Error(`Precos_ELEGN.csv too small: ${precosStats.size} bytes`);
    }
    if (condStats.size < 100) {
      throw new Error(`CondComerciais.csv too small: ${condStats.size} bytes`);
    }
    
    // Copy to data directory
    console.log('📋 Copying to data directory...');
    
    const finalPrecosPath = path.join(DATA_DIR, 'Precos_ELEGN.csv');
    const finalCondPath = path.join(DATA_DIR, 'CondComerciais.csv');
    
    fs.copyFileSync(precosPath, finalPrecosPath);
    fs.copyFileSync(condPath, finalCondPath);
    
    // Write metadata
    const meta = writeMeta(ERSE_URL, finalPrecosPath, finalCondPath);
    
    console.log('');
    console.log('✅ Update complete!');
    console.log(`   - Precos_ELEGN.csv: ${meta.files['Precos_ELEGN.csv'].rows} rows`);
    console.log(`   - CondComerciais.csv: ${meta.files['CondComerciais.csv'].rows} rows`);
    console.log(`   - Updated at: ${meta.updatedAt}`);
    
    // Cleanup
    cleanupTempDir();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Take screenshot for debugging
    try {
      const contexts = await browser.contexts();
      const page = contexts[0]?.pages()[0];
      if (page) {
        const screenshotPath = path.join(require('os').tmpdir(), 'erse-error.png');
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 Screenshot saved to ${screenshotPath}`);
      }
    } catch (e) {
      // Ignore screenshot errors
    }
    
    cleanupTempDir();
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run
if (require.main === module) {
  downloadERSE().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { downloadERSE };

