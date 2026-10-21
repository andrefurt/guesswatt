/**
 * Data bounds
 *
 * Runs after build-offers.js and before selftest.js in the weekly refresh, so a broken ERSE export
 * never reaches main. It checks what ERSE sends, not the code (selftest.js does that):
 * - Headers: every CSV column build-offers.js reads is present.
 * - Floors and ranges: enough offers and suppliers, prices and promotions within plausible values.
 * - Delta against HEAD: offer count, suppliers and the median energy price did not jump, and the
 *   price date did not go backwards.
 * - TAR (data/tar.json): a value for every power that gets reduced VAT, within range.
 *
 * Usage:
 *   node scripts/validate-data.js             # bounds; exits 1 on any breach
 *   node scripts/validate-data.js --tar-year  # exits 1 when data/tar.json is not for this year
 *
 * The TAR year check is separate because ERSE's new TAR comes once a year in a PDF that is updated
 * by hand: a stale year opens its own issue in the workflow and does not block the price refresh.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

// Columns build-offers.js reads. An array lists names ERSE has used for the same column.
const REQUIRED_COLUMNS = {
  'Precos_ELEGN.csv': ['COM', 'Pot_Cont', 'COD_Proposta', 'Contagem', 'TF', 'TV|TVFV|TVP', 'TVV|TVC', 'TVVz'],
  'CondComerciais.csv': [
    'COM', 'COD_Proposta', 'NomeProposta', 'Fornecimento', 'Segmento', 'Data ini', 'Data fim',
    'FiltroRestrições', ['FiltroPrecosIndex_ELE', 'FiltroPrecosIndex'], 'FiltroFidelização',
    'ConsIni_ELE', 'ConsFim_ELE', 'CustoServicos_c/IVA (€/ano)', 'LinkOfertaCom', 'LinkCOM',
    'ContactoComercialTel'
  ]
};

const BOUNDS = {
  minOffers: 1000,
  minProviders: 15,
  fixedEuroDay: [0.01, 5], // TF, €/day without VAT
  energyEuroKwh: [0.01, 1], // TV, TVV, TVVz, €/kWh without VAT
  maxPromotionEuroMonth: 50,
  maxOfferCountChange: 0.4, // ±40% against HEAD
  maxProvidersLost: 3,
  maxMedianEnergyChange: 0.3, // ±30% against HEAD
  tarEuroDay: [0.01, 1],
  tarPowers: ['1.15', '2.3', '3.45']
};

function readHeader(file) {
  const firstLine = fs.readFileSync(path.join(DATA_DIR, file), 'utf8').replace(/^﻿/, '').split(/\r?\n/, 1)[0];
  return firstLine.split(';').map(column => column.trim());
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

/**
 * A data file as committed at HEAD, or null when there is no git history to compare with.
 */
function readJsonAtHead(file) {
  try {
    const text = execFileSync('git', ['show', `HEAD:data/${file}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Median simple-tariff energy price at 6.9 kVA: a stable figure that a unit change (cents
 * instead of euros) or a broken column would move far.
 */
function medianEnergyPrice(offers) {
  return median(offers.filter(o => o.Contagem === 1 && o.Pot_Cont === 6.9).map(o => o['TV|TVFV|TVP']));
}

function inRange(value, [min, max]) {
  return typeof value === 'number' && value >= min && value <= max;
}

function checkBounds() {
  const breaches = [];

  for (const [file, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const header = readHeader(file);
    for (const column of columns) {
      const names = Array.isArray(column) ? column : [column];
      if (!names.some(name => header.includes(name))) {
        breaches.push(`${file} has no column ${names.join(' or ')} (ERSE may have renamed it; map it in build-offers.js)`);
      }
    }
  }

  const offers = readJson('offers.json');
  const meta = readJson('meta.json');
  const providers = new Set(offers.map(o => o.COM));

  if (offers.length < BOUNDS.minOffers) {
    breaches.push(`only ${offers.length} offers (floor ${BOUNDS.minOffers})`);
  }
  if (providers.size < BOUNDS.minProviders) {
    breaches.push(`only ${providers.size} suppliers (floor ${BOUNDS.minProviders})`);
  }

  const outOfRange = (field, range, allowZero) => {
    const bad = offers.filter(o => !(allowZero && o[field] === 0) && !inRange(o[field], range));
    if (bad.length > 0) {
      breaches.push(`${bad.length} offers have ${field} outside ${range.join(' to ')}, e.g. ${bad[0].COD_Proposta} at ${bad[0][field]}`);
    }
  };
  outOfRange('TF', BOUNDS.fixedEuroDay, false);
  outOfRange('TV|TVFV|TVP', BOUNDS.energyEuroKwh, false);
  outOfRange('TVV|TVC', BOUNDS.energyEuroKwh, true);
  outOfRange('TVVz', BOUNDS.energyEuroKwh, true);

  const bigPromotions = offers.filter(o => o.promotion && !(o.promotion.fixedEuroMonth <= BOUNDS.maxPromotionEuroMonth));
  if (bigPromotions.length > 0) {
    const sample = bigPromotions[0];
    breaches.push(`${bigPromotions.length} offers have a promotion above €${BOUNDS.maxPromotionEuroMonth}/month, e.g. ${sample.COD_Proposta} at €${sample.promotion.fixedEuroMonth} (check extractPromotion in build-offers.js)`);
  }

  const previousMeta = readJsonAtHead('meta.json');
  const previousOffers = readJsonAtHead('offers.json');
  if (previousMeta?.build && Array.isArray(previousOffers)) {
    const previousCount = previousOffers.length;
    const change = (offers.length - previousCount) / previousCount;
    if (Math.abs(change) > BOUNDS.maxOfferCountChange) {
      breaches.push(`offer count moved ${Math.round(change * 100)}% (${previousCount} to ${offers.length}); limit ±${BOUNDS.maxOfferCountChange * 100}%`);
    }

    const previousProviders = new Set(previousOffers.map(o => o.COM));
    const lost = [...previousProviders].filter(code => !providers.has(code));
    if (lost.length > BOUNDS.maxProvidersLost) {
      breaches.push(`${lost.length} suppliers disappeared: ${lost.join(', ')}`);
    }

    const previousMedian = medianEnergyPrice(previousOffers);
    const currentMedian = medianEnergyPrice(offers);
    const priceChange = (currentMedian - previousMedian) / previousMedian;
    if (Math.abs(priceChange) > BOUNDS.maxMedianEnergyChange) {
      breaches.push(`median energy price at 6.9 kVA moved ${Math.round(priceChange * 100)}% (${previousMedian.toFixed(4)} to ${currentMedian.toFixed(4)} €/kWh)`);
    }

    const previousDate = new Date(previousMeta.build.sourceUpdatedAt);
    const currentDate = new Date(meta.build?.sourceUpdatedAt);
    if (currentDate < previousDate) {
      breaches.push(`price date went backwards (${previousMeta.build.sourceUpdatedAt} to ${meta.build?.sourceUpdatedAt})`);
    }
  } else {
    console.log('ℹ️  No committed data at HEAD: delta checks skipped');
  }

  const tar = readJson('tar.json');
  for (const power of BOUNDS.tarPowers) {
    const value = tar.fixedTermByPower?.[power];
    if (!inRange(value, BOUNDS.tarEuroDay)) {
      breaches.push(`tar.json fixed term for ${power} kVA is ${value} (expected ${BOUNDS.tarEuroDay.join(' to ')} €/day)`);
    }
  }

  return breaches;
}

function checkTarYear() {
  const tar = readJson('tar.json');
  const year = new Date().getUTCFullYear();
  if (tar.year !== year) {
    return [`data/tar.json is for ${tar.year}, not ${year}: copy the BTN fixed terms (1.15, 2.3 and 3.45 kVA) from ERSE's tariff directive for ${year} (https://www.erse.pt/atividade/regulacao/tarifas-e-precos-eletricidade/)`];
  }
  return [];
}

if (require.main === module) {
  const tarYearOnly = process.argv.includes('--tar-year');
  const breaches = tarYearOnly ? checkTarYear() : checkBounds();
  if (breaches.length > 0) {
    console.error(`❌ ${tarYearOnly ? 'TAR year' : 'Data bounds'} breached:`);
    breaches.forEach(breach => console.error(`   - ${breach}`));
    process.exit(1);
  }
  console.log(tarYearOnly ? '✅ data/tar.json is for this year' : '✅ Data within bounds');
}

module.exports = { checkBounds, checkTarYear, BOUNDS };
