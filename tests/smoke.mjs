/**
 * Smoke test
 *
 * Drives the real page in a headless browser through the flows a person uses, at a phone and a
 * desktop width. Runs in CI (.github/workflows/ci.yml, and before the weekly refresh pushes); it is
 * not part of the pre-commit gate. Playwright is never a repo dependency: CI installs it in the
 * runner's temp folder and passes its path in PLAYWRIGHT.
 *
 * Each flow fails on: a missing result or error, horizontal overflow, the input pill on the first
 * screen, a page or console error, or a request to any host but the local server (rule 2).
 *
 * Usage (with the site served at the base URL):
 *   PLAYWRIGHT=/path/to/node_modules/playwright node tests/smoke.mjs [base]
 *   SMOKE_BROWSER=webkit SMOKE_EXECUTABLE=/path/to/pw_run.sh ...   # another engine, locally
 *   SMOKE_FORCE_FAIL=1 ...                                          # one failing check, to test the alert
 */

const base = process.argv[2] || 'http://localhost:8000';
const playwright = await import(process.env.PLAYWRIGHT || 'playwright');
const engine = playwright[process.env.SMOKE_BROWSER || 'chromium'];
const browser = await engine.launch(process.env.SMOKE_EXECUTABLE ? { executablePath: process.env.SMOKE_EXECUTABLE } : {});

const WIDTHS = [375, 1280];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

const check = (ok, message) => { if (!ok) throw new Error(message); };

// Reads what the page shows, in one round trip
const look = page => page.evaluate(() => {
  const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const status = document.getElementById('form-status');
  return {
    results: document.getElementById('page-wrapper').classList.contains('results-view'),
    result: document.getElementById('result').innerText.trim(),
    pill: shown(document.getElementById('input-pill')),
    status: shown(status) ? document.getElementById('form-status-text').textContent.trim() : '',
    focus: document.activeElement?.id || '',
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    search: location.search,
    saving: document.querySelector('#result [data-slot="savings-monthly"]')?.textContent.trim() || '',
  };
});

const waitForResult = page => page.waitForFunction(
  () => document.getElementById('page-wrapper').classList.contains('results-view')
    && document.getElementById('result').innerText.trim().length > 0,
  null, { timeout: 15000 });

// A result is on screen, the pill shows it, nothing overflows, and the URL brings it back
async function resultHolds(page, label) {
  await waitForResult(page);
  const shown = await look(page);
  check(/€/.test(shown.result), `${label}: the result has no price`);
  check(shown.pill, `${label}: the input pill is hidden on the result`);
  check(shown.overflow <= 0, `${label}: the result overflows by ${shown.overflow}px`);
  check(shown.search.length > 1, `${label}: the result is not in the URL`);
  await page.reload();
  await waitForResult(page);
  const reloaded = await look(page);
  check(reloaded.result.split('\n')[0] === shown.result.split('\n')[0], `${label}: reloading the URL shows another result`);
  return shown;
}

// Suppliers come from the page's own dropdown, which follows the week's data: a supplier leaving the
// market never breaks the smoke (supplier churn only opens an issue, validate-data.js)
const suppliers = page => page.$$eval('#current-provider option', options =>
  options.map(option => option.value).filter(value => value && value !== 'outro'));

// The supplier whose customers save the most at 250 kWh, worked out by the page's own calculator
const supplierWithSaving = async page => page.evaluate(async codes => {
  const { compare } = await import(new URL('js/calculator.js', location.href).href);
  const offers = await (await fetch(new URL('data/offers.json', location.href))).json();
  let best = null;
  for (const provider of codes) {
    try {
      const { savings } = compare(offers, { mode: 'precise', consumption: 250, power: 4.6, tariffType: 1, provider });
      if (savings && (!best || savings.monthly > best.monthly)) best = { provider, monthly: savings.monthly };
    } catch { /* no offer for this profile */ }
  }
  return best;
}, await suppliers(page));

async function manual(page, { provider, tariff, consumption }) {
  await page.click('#tab-preciso');
  await page.click('#manual-link');
  await page.selectOption('#current-provider', provider);
  await page.selectOption('#tariff-type', String(tariff));
  await page.fill('#consumption', String(consumption));
  await page.click('#manual-submit-btn');
}

const FLOWS = {
  'first screen': async page => {
    const shown = await look(page);
    check(!shown.pill, 'the input pill shows before any input');
    check(!shown.results, 'the page opens on the results view');
    check(shown.overflow <= 0, `the first screen overflows by ${shown.overflow}px`);
  },
  'estimate 80 €': async page => {
    await page.fill('#monthly-bill', '80');
    await page.click('#submit-btn');
    await resultHolds(page, 'estimate 80 €');
  },
  // The field is required, so the browser stops the submit with its own message
  'estimate empty': async page => {
    await page.click('#submit-btn');
    await page.waitForTimeout(300);
    const shown = await look(page);
    const blocked = await page.$eval('#monthly-bill', input => input.validity.valueMissing);
    check(!shown.results, 'an empty bill shows a result');
    check(blocked || shown.status.length > 0, 'an empty bill is neither blocked nor explained');
    check(shown.focus === 'monthly-bill', `focus is on "${shown.focus}", not the bill field`);
  },
  'estimate 5 € (out of range)': async page => {
    await page.fill('#monthly-bill', '5');
    await page.click('#submit-btn');
    await page.waitForTimeout(300);
    const shown = await look(page);
    check(!shown.results, 'a 5 € bill shows a result');
    check(shown.status.length > 0, 'a 5 € bill shows no message');
    check(shown.focus === 'monthly-bill', `focus is on "${shown.focus}", not the bill field`);
  },
  ...Object.fromEntries([1, 2, 3].map(tariff => [`manual, tariff type ${tariff}`, async page => {
    await manual(page, { provider: (await suppliers(page))[0], tariff, consumption: 250 });
    await resultHolds(page, `manual tariff ${tariff}`);
  }])),
  // The card's savings line, not the word "Poupas": a small saving also says it, in the verdict
  'a supplier with a saving': async page => {
    const best = await supplierWithSaving(page);
    check(best && best.monthly > 1, `no supplier saves more than 1 €/month at 250 kWh (best: ${JSON.stringify(best)})`);
    await manual(page, { provider: best.provider, tariff: 1, consumption: 250 });
    const shown = await resultHolds(page, `${best.provider} 250 kWh`);
    check(shown.saving.length > 0, `${best.provider} saves ${best.monthly.toFixed(2)} €/month but the card shows no savings line`);
  },
};

let failed = 0;
const started = Date.now();
for (const width of WIDTHS) {
  for (const [name, flow] of Object.entries(FLOWS)) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', error => problems.push(`page error: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') problems.push(`console error: ${message.text().slice(0, 160)}`); });
    page.on('dialog', dialog => { problems.push(`dialog: ${dialog.message()}`); dialog.dismiss(); });
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.protocol.startsWith('http') && !LOCAL_HOSTS.has(url.hostname)) problems.push(`request to ${url.hostname} (rule 2: nothing leaves the device)`);
    });
    try {
      await page.goto(base, { waitUntil: 'networkidle' });
      await flow(page);
      if (problems.length) throw new Error([...new Set(problems)].join('; '));
      console.log(`✅ ${width}px ${name}`);
    } catch (error) {
      failed++;
      console.error(`❌ ${width}px ${name}: ${error.message.split('\n')[0]}`);
    }
    await context.close();
  }
}
if (process.env.SMOKE_FORCE_FAIL) {
  failed++;
  console.error('❌ forced failure (SMOKE_FORCE_FAIL), to test the alert');
}
await browser.close();

console.log(`\n${failed ? '❌' : '✅'} Smoke: ${failed} failed, ${((Date.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
