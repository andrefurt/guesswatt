/**
 * ERSE CSV Downloader
 * 
 * Downloads the latest electricity pricing data from ERSE
 * using Playwright to handle the JavaScript-rendered page.
 * 
 * Usage:
 *   node scripts/download-erse.js
 * 
 * Requirements:
 *   pnpm add playwright
 *   npx playwright install chromium
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ERSE_URL = 'https://simuladorprecos.erse.pt';
const DATA_DIR = path.join(__dirname, '..', 'data');
const TEMP_DIR = '/tmp/erse-download';

async function downloadERSE() {
  console.log('🔄 Starting ERSE data download...');
  
  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  
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
    
    // Start download
    console.log('📥 Starting download...');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      downloadLink.click()
    ]);
    
    // Save the file
    const zipPath = path.join(TEMP_DIR, 'erse.zip');
    await download.saveAs(zipPath);
    console.log(`💾 Downloaded to ${zipPath}`);
    
    // Verify file exists and has content
    const stats = fs.statSync(zipPath);
    if (stats.size < 1000) {
      throw new Error(`Downloaded file too small: ${stats.size} bytes`);
    }
    console.log(`📦 File size: ${(stats.size / 1024).toFixed(1)} KB`);
    
    // Extract ZIP
    console.log('📂 Extracting ZIP...');
    const extractDir = path.join(TEMP_DIR, 'extracted');
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });
    
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`);
    
    // Find CSV files
    const files = fs.readdirSync(extractDir);
    console.log('📄 Extracted files:', files);
    
    const precosFile = files.find(f => f.toLowerCase().includes('precos') && f.endsWith('.csv'));
    const condFile = files.find(f => f.toLowerCase().includes('cond') && f.endsWith('.csv'));
    
    if (!precosFile || !condFile) {
      throw new Error(`Missing CSV files. Found: ${files.join(', ')}`);
    }
    
    // Copy to data directory
    console.log('📋 Copying to data directory...');
    
    fs.copyFileSync(
      path.join(extractDir, precosFile),
      path.join(DATA_DIR, 'Precos_ELEGN.csv')
    );
    
    fs.copyFileSync(
      path.join(extractDir, condFile),
      path.join(DATA_DIR, 'CondComerciais.csv')
    );
    
    // Count lines for verification
    const precosLines = fs.readFileSync(path.join(DATA_DIR, 'Precos_ELEGN.csv'), 'utf8').split('\n').length;
    const condLines = fs.readFileSync(path.join(DATA_DIR, 'CondComerciais.csv'), 'utf8').split('\n').length;
    
    console.log('');
    console.log('✅ Update complete!');
    console.log(`   - Precos_ELEGN.csv: ${precosLines} lines`);
    console.log(`   - CondComerciais.csv: ${condLines} lines`);
    
    // Cleanup
    fs.rmSync(TEMP_DIR, { recursive: true });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Take screenshot for debugging
    try {
      const page = (await browser.contexts())[0]?.pages()[0];
      if (page) {
        await page.screenshot({ path: '/tmp/erse-error.png' });
        console.log('📸 Screenshot saved to /tmp/erse-error.png');
      }
    } catch (e) {
      // Ignore screenshot errors
    }
    
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run
downloadERSE();
