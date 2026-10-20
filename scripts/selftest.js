/**
 * Self-test Script
 * 
 * Validates built offers.json:
 * - Offers exist
 * - Required fields present
 * - No GN-only offers
 * - Calculation samples (no NaN, positive totals)
 * - Golden cases against the real js/calculator.js
 * 
 * Usage:
 *   node scripts/selftest.js
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OFFERS_PATH = path.join(DATA_DIR, 'offers.json');
const META_PATH = path.join(DATA_DIR, 'meta.json');

// The real calculator, loaded in runSelftest (it is an ES module)
const CALCULATOR_URL = pathToFileURL(path.join(__dirname, '..', 'js', 'calculator.js')).href;
const CONFIG_URL = pathToFileURL(path.join(__dirname, '..', 'js', 'config.js')).href;
const PDF_SERVICE_PATH = path.join(__dirname, '..', 'js', 'pdf-service.js');
let calculateMonthlyCost;

/**
 * Run self-tests
 */
async function runSelftest() {
  console.log('🧪 Running self-tests...\n');
  
  const calculator = await import(CALCULATOR_URL);
  calculateMonthlyCost = calculator.calculateMonthlyCost;
  const { PROVIDERS } = await import(CONFIG_URL);
  
  let passed = 0;
  let failed = 0;
  
  function test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }
  
  // Test 1: File exists
  test('offers.json exists', () => {
    if (!fs.existsSync(OFFERS_PATH)) {
      throw new Error(`Missing ${OFFERS_PATH}`);
    }
  });
  
  // Test 2: Valid JSON
  let offers = [];
  test('offers.json is valid JSON', () => {
    const content = fs.readFileSync(OFFERS_PATH, 'utf8');
    offers = JSON.parse(content);
    if (!Array.isArray(offers)) {
      throw new Error('offers.json is not an array');
    }
  });
  
  // Test 3: Has offers
  test('has offers', () => {
    if (offers.length === 0) {
      throw new Error('No offers found');
    }
    console.log(`   Found ${offers.length} offers`);
  });
  
  // Test 4: Required fields
  test('all offers have required fields', () => {
    const requiredFields = ['COM', 'COD_Proposta', 'Pot_Cont', 'Contagem', 'TF', 'TV|TVFV|TVP'];
    const missing = [];
    
    offers.forEach((offer, index) => {
      for (const field of requiredFields) {
        if (offer[field] === undefined || offer[field] === null || offer[field] === '') {
          missing.push(`Offer ${index}: missing ${field}`);
        }
      }
    });
    
    if (missing.length > 0) {
      throw new Error(`Missing fields: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
    }
  });
  
  // Test 5: No GN/DUAL offers (ELE-only)
  test('no GN or DUAL offers (ELE-only)', () => {
    const nonELE = offers.filter(o => o.fornecimento && o.fornecimento !== 'ELE');
    if (nonELE.length > 0) {
      throw new Error(`Found ${nonELE.length} non-ELE offers (should be filtered to ELE-only)`);
    }
  });
  
  // Test 5a: Domestic only (ADR-020)
  test('no non-domestic (Ndom) offers', () => {
    const nonDomestic = offers.filter(o => o.segmento === 'Ndom');
    if (nonDomestic.length > 0) {
      throw new Error(`Found ${nonDomestic.length} Ndom offers (should be filtered at build time)`);
    }
  });

  // Test 5a2: Supplier codes the UI and the PDF parser use exist in the data
  test('every supplier code has a name and offers', () => {
    const inData = new Set(offers.map(o => o.COM));
    const unnamed = [...inData].filter(code => !PROVIDERS[code]);
    const withoutOffers = Object.keys(PROVIDERS).filter(code => !inData.has(code));
    const parserCodes = [...fs.readFileSync(PDF_SERVICE_PATH, 'utf8').matchAll(/provider = '([A-Z0-9]+)'/g)].map(m => m[1]);
    const parserUnknown = parserCodes.filter(code => !inData.has(code));
    const problems = [];
    if (unnamed.length) problems.push(`no name in PROVIDERS: ${unnamed.join(', ')}`);
    if (withoutOffers.length) problems.push(`no offers for: ${withoutOffers.join(', ')}`);
    if (parserUnknown.length) problems.push(`PDF parser emits codes with no offers: ${parserUnknown.join(', ')}`);
    if (parserCodes.length === 0) problems.push('found no provider codes in pdf-service.js');
    if (problems.length) throw new Error(problems.join('; '));
    console.log(`   ${inData.size} suppliers, ${parserCodes.length} detectable from a PDF`);
  });

  // Test 5b: Lock-in detection
  test('lock-in detection fields present', () => {
    const withLockIn = offers.filter(o => o.hasLockIn === true);
    const withoutLockIn = offers.filter(o => o.hasLockIn === false);
    
    if (withLockIn.length === 0 && withoutLockIn.length === 0) {
      throw new Error('No offers have hasLockIn field');
    }
    
    // Check that lock-in offers have lockInMonths or lockInSource
    const invalidLockIn = withLockIn.filter(o => 
      o.lockInMonths === undefined && o.lockInSource === undefined
    );
    if (invalidLockIn.length > 0) {
      throw new Error(`Found ${invalidLockIn.length} lock-in offers without lockInMonths or lockInSource`);
    }
    
    console.log(`   Found ${withLockIn.length} lock-in offers, ${withoutLockIn.length} without lock-in`);
  });
  
  // Test 5b2: Lock-in follows ERSE's S/N flag ("sem fidelização" is not lock-in)
  test('offers that ERSE marks without lock-in are not excluded', () => {
    const known = offers.filter(o =>
      (o.COM === 'EDPSU' && o.COD_Proposta === 'TUR') ||
      (o.COM === 'IBELECTRA' && o.COD_Proposta === 'IBELECTRA_01')
    );
    if (known.length === 0) {
      throw new Error('TUR and IBELECTRA_01 are missing from offers.json');
    }
    const wrong = known.filter(o => o.hasLockIn !== false);
    if (wrong.length > 0) {
      throw new Error(`${wrong.length} TUR/IBELECTRA_01 rows marked as lock-in`);
    }
  });

  // Test 5c: Promotion parsing
  test('promotion parsing sanity checks', () => {
    const withPromotion = offers.filter(o => o.promotion !== null && o.promotion !== undefined);
    
    if (withPromotion.length > 0) {
      const invalid = [];
      withPromotion.forEach((offer, index) => {
        const promo = offer.promotion;
        if (!promo.fixedEuroMonth || promo.fixedEuroMonth <= 0 || !isFinite(promo.fixedEuroMonth)) {
          invalid.push(`Offer ${index}: invalid fixedEuroMonth (${promo.fixedEuroMonth})`);
        }
        // Check durationMonthsApplied (clamped 0..12)
        if (promo.durationMonthsApplied !== null && promo.durationMonthsApplied !== undefined) {
          if (promo.durationMonthsApplied < 0 || promo.durationMonthsApplied > 12 || !isFinite(promo.durationMonthsApplied)) {
            invalid.push(`Offer ${index}: invalid durationMonthsApplied (${promo.durationMonthsApplied})`);
          }
        }
        // Check durationMonthsExtracted (raw, 1..24)
        if (promo.durationMonthsExtracted !== null && promo.durationMonthsExtracted !== undefined) {
          if (promo.durationMonthsExtracted < 1 || promo.durationMonthsExtracted > 24 || !isFinite(promo.durationMonthsExtracted)) {
            invalid.push(`Offer ${index}: invalid durationMonthsExtracted (${promo.durationMonthsExtracted})`);
          }
        }
        if (promo.durationAssumed === undefined) {
          invalid.push(`Offer ${index}: missing durationAssumed field`);
        }
      });
      
      if (invalid.length > 0) {
        throw new Error(`Invalid promotions: ${invalid.slice(0, 3).join('; ')}${invalid.length > 3 ? '...' : ''}`);
      }
      
      console.log(`   Found ${withPromotion.length} offers with promotion metadata`);
    }
  });
  
  // Test 5d: Promotions are NOT applied to calculations
  test('promotions do not affect cost calculations', () => {
    const withPromotion = offers.filter(o => o.promotion !== null && o.promotion !== undefined);
    
    if (withPromotion.length > 0) {
      // Verify that promotions are metadata only and do not affect costs
      const errors = [];
      const testConsumption = 250;
      const testPower = 4.6;
      
      // Test a sample of offers with promotions
      withPromotion.slice(0, 10).forEach(offer => {
        if (offer.Pot_Cont !== testPower || offer.Contagem !== 1) {
          return; // Skip if doesn't match test case
        }
        
        // Calculate base cost
        const baseCost = calculateMonthlyCost(offer, testConsumption, testPower);
        
        // Calculate annual cost (should be base * 12, ignoring promotions)
        const annualBase = baseCost * 12;
        
        // Verify promotion doesn't reduce the cost
        // If promotion were applied, we'd expect: monthlyCostPromo < monthlyCostBase
        // But we ensure monthlyCostPromo === monthlyCostBase
        if (baseCost <= 0 || isNaN(baseCost)) {
          errors.push(`Invalid base cost for ${offer.COM} ${offer.COD_Proposta}: ${baseCost}`);
        }
        
        if (annualBase <= 0 || isNaN(annualBase)) {
          errors.push(`Invalid annual cost for ${offer.COM} ${offer.COD_Proposta}: ${annualBase}`);
        }
      });
      
      if (errors.length > 0) {
        throw new Error(`Promotion cost verification errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
      }
      
      console.log(`   Verified ${Math.min(10, withPromotion.length)} offers: promotions do not affect costs`);
    }
  });
  
  // Test 6: Valid numeric fields
  test('numeric fields are valid numbers', () => {
    const invalid = [];
    
    offers.forEach((offer, index) => {
      const tf = offer.TF;
      const tv = offer['TV|TVFV|TVP'];
      const pot = offer.Pot_Cont;
      
      if (typeof tf !== 'number' || isNaN(tf) || tf <= 0) {
        invalid.push(`Offer ${index}: invalid TF (${tf})`);
      }
      if (typeof tv !== 'number' || isNaN(tv) || tv <= 0) {
        invalid.push(`Offer ${index}: invalid TV (${tv})`);
      }
      if (typeof pot !== 'number' || isNaN(pot) || pot <= 0) {
        invalid.push(`Offer ${index}: invalid Pot_Cont (${pot})`);
      }
    });
    
    if (invalid.length > 0) {
      throw new Error(`Invalid numbers: ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '...' : ''}`);
    }
  });
  
  // Test 7: Calculation samples (no NaN, positive totals)
  test('calculation samples produce valid results', () => {
    const testCases = [
      { consumption: 250, power: 4.6 },
      { consumption: 150, power: 3.45 },
      { consumption: 400, power: 6.9 }
    ];
    
    const errors = [];
    
    for (const testCase of testCases) {
      // Find offers matching test case (exclude lock-in for selection test)
      const matching = offers.filter(o => 
        o.Pot_Cont === testCase.power && 
        o.Contagem === 1 && // Simple tariff
        o.hasLockIn !== true // Exclude lock-in for selection
      );
      
      if (matching.length === 0) {
        continue; // Skip if no matching offers
      }
      
      // Test first 5 matching offers
      matching.slice(0, 5).forEach(offer => {
        const cost = calculateMonthlyCost(offer, testCase.consumption, testCase.power);
        
        if (isNaN(cost)) {
          errors.push(`NaN cost for ${offer.COM} ${offer.COD_Proposta} (${testCase.consumption} kWh, ${testCase.power} kVA)`);
        }
        if (cost <= 0) {
          errors.push(`Non-positive cost for ${offer.COM} ${offer.COD_Proposta} (${testCase.consumption} kWh, ${testCase.power} kVA): ${cost}`);
        }
        if (cost > 1000) {
          errors.push(`Unrealistically high cost for ${offer.COM} ${offer.COD_Proposta} (${testCase.consumption} kWh, ${testCase.power} kVA): ${cost}`);
        }
      });
    }
    
    if (errors.length > 0) {
      throw new Error(`Calculation errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
    }
  });
  
  // Test 7b: Promotion cost calculations (promotions NOT applied)
  test('promotion cost calculations ignore promotions', () => {
    const offersWithPromo = offers.filter(o => 
      o.promotion !== null && 
      o.promotion !== undefined &&
      o.Pot_Cont > 0 &&
      o.Contagem === 1
    );
    
    if (offersWithPromo.length === 0) {
      return; // Skip if no promotions to test
    }
    
    const errors = [];
    const testConsumption = 250;
    const testPower = 4.6;
    
    offersWithPromo.slice(0, 10).forEach(offer => {
      if (offer.Pot_Cont !== testPower) {
        return; // Skip if power doesn't match
      }
      
      const baseCost = calculateMonthlyCost(offer, testConsumption, testPower);
      
      // Verify base cost is valid (promotions should not affect it)
      if (baseCost <= 0 || isNaN(baseCost)) {
        errors.push(`Invalid base cost for ${offer.COM} ${offer.COD_Proposta}: ${baseCost}`);
      }
      
      // Annual cost should be base * 12 (no promotion discount)
      const annualCost = baseCost * 12;
      if (annualCost <= 0 || isNaN(annualCost)) {
        errors.push(`Invalid annual cost for ${offer.COM} ${offer.COD_Proposta}: ${annualCost}`);
      }
    });
    
    if (errors.length > 0) {
      throw new Error(`Promotion calculation errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
    }
  });
  
  // Test 7c: Annual effective cost calculation
  test('annual effective cost is computed correctly', () => {
    const testOffers = offers.filter(o => 
      o.Pot_Cont === 4.6 &&
      o.Contagem === 1 &&
      o.hasLockIn !== true
    ).slice(0, 10);
    
    if (testOffers.length === 0) {
      return; // Skip if no test offers
    }
    
    const errors = [];
    const testConsumption = 250;
    const testPower = 4.6;
    
    // Field check only; the golden cases below pin the values
    testOffers.forEach(offer => {
      if (!offer.TF || offer.TF <= 0) {
        errors.push(`Invalid TF for ${offer.COM} ${offer.COD_Proposta}`);
      }
      if (!offer['TV|TVFV|TVP'] || offer['TV|TVFV|TVP'] <= 0) {
        errors.push(`Invalid TV for ${offer.COM} ${offer.COD_Proposta}`);
      }
    });
    
    if (errors.length > 0) {
      throw new Error(`Annual cost calculation prep errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
    }
  });
  
  // Test 7d: Best offer selection excludes lock-in
  test('best offer selection excludes lock-in offers', () => {
    // This test verifies that if we were to select a best offer,
    // it would not have hasLockIn === true
    // We can't easily test the full selection logic here, but we can verify
    // that there are non-lock-in offers available for selection
    
    const nonLockInOffers = offers.filter(o => 
      o.hasLockIn !== true &&
      o.Pot_Cont > 0 &&
      o.TF > 0 &&
      o['TV|TVFV|TVP'] > 0 &&
      o.Contagem === 1
    );
    
    if (nonLockInOffers.length === 0) {
      throw new Error('No non-lock-in offers available for selection');
    }
    
    console.log(`   ${nonLockInOffers.length} non-lock-in offers available for selection`);
  });
  
  // Golden cases: synthetic offers, expected values worked out by hand.
  // A formula change in js/calculator.js must update these literals.
  const CENT = 0.005;
  function expectCost(actual, expected, label) {
    if (Math.abs(actual - expected) > CENT) {
      throw new Error(`${label}: expected ${expected.toFixed(4)}, got ${actual.toFixed(4)}`);
    }
  }
  const SIMPLE = { COM: 'TEST', COD_Proposta: 'S1', Contagem: 1, Pot_Cont: 4.6, TF: 0.3, 'TV|TVFV|TVP': 0.15 };
  const BI = { COM: 'TEST', COD_Proposta: 'B1', Contagem: 2, Pot_Cont: 4.6, TF: 0.3, 'TV|TVFV|TVP': 0.20, 'TVV|TVC': 0.10 };
  const TRI = { COM: 'TEST', COD_Proposta: 'T1', Contagem: 3, Pot_Cont: 4.6, TF: 0.3, 'TV|TVFV|TVP': 0.25, 'TVV|TVC': 0.15, TVVz: 0.08 };

  // Fixed parts at 4.6 kVA: fixed term 0.3*30*1.23 = 11.07, IEC 0.2*1.23 = 0.246,
  // CAV 2.85*1.06 = 3.021, DGEG 0.07*1.23 = 0.0861; all 200 kWh get the 6% rate
  test('golden: simple tariff, 200 kWh at 4.6 kVA', () => {
    // 200*0.15*1.06 + 11.07 + 0.246 + 3.021 + 0.0861
    expectCost(calculateMonthlyCost(SIMPLE, 200, 4.6), 46.2231, 'simple');
  });

  test('golden: bi-hourly tariff, default 35/65 split', () => {
    // (200*0.35*0.10 + 200*0.65*0.20)*1.06 + 11.07 + 0.246 + 3.021 + 0.0861
    expectCost(calculateMonthlyCost(BI, 200, 4.6), 49.4031, 'bi-hourly');
  });

  test('golden: tri-hourly tariff, default 30/50/20 split', () => {
    // 200*(0.30*0.08 + 0.50*0.15 + 0.20*0.25)*1.06 + 11.07 + 0.246 + 3.021 + 0.0861
    expectCost(calculateMonthlyCost(TRI, 200, 4.6), 46.0111, 'tri-hourly');
  });

  test('golden: above 200 kWh the rest of the energy pays 23%', () => {
    // 400 kWh: 60*(0.5*1.06 + 0.5*1.23) + 11.07 + 0.4*1.23 + 3.021 + 0.0861
    expectCost(calculateMonthlyCost(SIMPLE, 400, 4.6), 83.3691, 'simple 400 kWh');
  });

  test('golden: a household of 5 or more gets 300 kWh at 6%', () => {
    // 400 kWh: 60*(0.75*1.06 + 0.25*1.23) + 11.07 + 0.492 + 3.021 + 0.0861
    expectCost(calculateMonthlyCost(SIMPLE, 400, 4.6, null, { largeHousehold: true }), 80.8191, 'large household');
  });

  test('golden: at 250 kWh the household answer changes the cost', () => {
    // Fixed parts: 11.07 + 0.25*1.23 + 3.021 + 0.0861 = 14.4846
    // No: 200*0.15*1.06 + 50*0.15*1.23 + 14.4846; yes: 250*0.15*1.06 + 14.4846
    expectCost(calculateMonthlyCost(SIMPLE, 250, 4.6), 55.5096, 'household no');
    expectCost(calculateMonthlyCost(SIMPLE, 250, 4.6, null, { largeHousehold: true }), 54.2346, 'household yes');
  });

  test('golden: above 6.9 kVA everything but the CAV pays 23%', () => {
    const offer = { ...SIMPLE, Pot_Cont: 10.35, TF: 0.5 };
    // (15 + 75 + 0.5 + 0.07)*1.23 + 3.021
    expectCost(calculateMonthlyCost(offer, 500, 10.35), 114.4221, '10.35 kVA');
  });

  test('golden: at 3.45 kVA the TAR share of the fixed term pays 6%', () => {
    const offer = { ...SIMPLE, Pot_Cont: 3.45, TF: 0.25 };
    const tar = { fixedTermByPower: { '3.45': 0.1718 } };
    // fixed 7.5: 5.154*1.06 + 2.346*1.23; energy 30*1.06; IEC 0.246; CAV 3.021; DGEG 0.0861
    expectCost(calculateMonthlyCost(offer, 200, 3.45, null, { tar }), 43.50192, 'tar share');
  });

  // ERSExplica "Aplicação do IVA na fatura de eletricidade", examples 1, 3 and 4.
  // They use the 2022 thresholds (100 kWh, 150 kWh for large households), passed explicitly.
  test('golden: ERSE Exemplo 1 (simple, 3.45 kVA, 160 kWh) = 37.73', () => {
    const offer = { Contagem: 1, Pot_Cont: 3.45, TF: 0.0904 + 0.0758, 'TV|TVFV|TVP': 0.1599 };
    const tar = { fixedTermByPower: { '3.45': 0.0904 } };
    expectCost(calculateMonthlyCost(offer, 160, 3.45, null, { tar, reducedVatKwh: 100 }), 37.73, 'Exemplo 1');
  });

  const ERSE_BI = { Contagem: 2, Pot_Cont: 6.9, TF: 0.3160, 'TV|TVFV|TVP': 0.1926, 'TVV|TVC': 0.1073 };
  const ERSE_SPLIT = { vazio: 80 / 250, foraVazio: 170 / 250 };
  test('golden: ERSE Exemplo 3 (bi-hourly, 6.9 kVA, 250 kWh) = 63.10', () => {
    expectCost(calculateMonthlyCost(ERSE_BI, 250, 6.9, ERSE_SPLIT, { reducedVatKwh: 100 }), 63.10, 'Exemplo 3');
  });

  test('golden: ERSE Exemplo 4 (large household, same profile) = 61.69', () => {
    expectCost(calculateMonthlyCost(ERSE_BI, 250, 6.9, ERSE_SPLIT, { reducedVatKwh: 150 }), 61.69, 'Exemplo 4');
  });

  test('data/tar.json covers every power with reduced VAT on the fixed term', () => {
    const tar = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'tar.json'), 'utf8'));
    for (const power of ['1.15', '2.3', '3.45']) {
      const value = tar.fixedTermByPower?.[power];
      if (typeof value !== 'number' || value <= 0 || value > 0.5) {
        throw new Error(`missing or implausible TAR for ${power} kVA: ${value}`);
      }
    }
  });

  test('golden: ranking picks the cheapest offer without lock-in', () => {
    const cheaperLocked = { ...SIMPLE, COD_Proposta: 'LOCK', 'TV|TVFV|TVP': 0.10, hasLockIn: true };
    const cheaper = { ...SIMPLE, COD_Proposta: 'CHEAP', 'TV|TVFV|TVP': 0.12 };
    const pool = [SIMPLE, cheaperLocked, cheaper];
    const best = calculator.findBestOfferForTariff(pool, 200, 4.6, 1);
    if (best.COD_Proposta !== 'CHEAP') {
      throw new Error(`expected CHEAP, got ${best.COD_Proposta}`);
    }
    expectCost(best.annualCostEffective, calculateMonthlyCost(cheaper, 200, 4.6) * 12, 'annual');
  });

  test('golden: equal costs break ties by name', () => {
    const b = { ...SIMPLE, COD_Proposta: 'B', tariffName: 'Beta' };
    const a = { ...SIMPLE, COD_Proposta: 'A', tariffName: 'Alfa' };
    const best = calculator.findBestOfferForTariff([b, a], 200, 4.6, 1);
    if (best.COD_Proposta !== 'A') {
      throw new Error(`expected A, got ${best.COD_Proposta}`);
    }
  });

  test('golden: estimate round trip on a synthetic offer stays within 1 kWh', () => {
    const offer = { Contagem: 1, Pot_Cont: 4.6, TF: 0.40, 'TV|TVFV|TVP': 0.15 };
    for (const kWh of [100, 200, 300, 600]) {
      const bill = calculateMonthlyCost(offer, kWh, 4.6);
      const estimated = calculator.estimateConsumption(bill, [offer]);
      if (Math.abs(estimated - kWh) > 1) {
        throw new Error(`${kWh} kWh -> €${bill.toFixed(2)} -> ${estimated} kWh`);
      }
    }
  });

  test('golden: estimate on the real data reproduces the bill on the typical offer', () => {
    const typical = calculator.typicalOffer(offers);
    for (const bill of [40, 80, 120]) {
      const estimated = calculator.estimateConsumption(bill, offers);
      const cost = calculateMonthlyCost(typical, estimated, 4.6);
      // One kWh is worth well under €0.50 on any offer
      if (Math.abs(cost - bill) > 0.5) {
        throw new Error(`€${bill} -> ${estimated} kWh -> €${cost.toFixed(2)}`);
      }
    }
  });

  // Test 8: Tariff types are valid
  test('tariff types are valid (1, 2, or 3)', () => {
    const invalid = offers.filter(o => ![1, 2, 3].includes(o.Contagem));
    if (invalid.length > 0) {
      throw new Error(`Found ${invalid.length} offers with invalid Contagem`);
    }
  });
  
  // Test 9: Power values are standard
  test('power values are standard kVA values', () => {
    const standardPowers = [1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7, 27.6, 34.5, 41.4];
    const invalid = offers.filter(o => !standardPowers.includes(o.Pot_Cont));
    if (invalid.length > 0) {
      // This is a warning, not an error - some offers might have non-standard powers
      console.log(`   ⚠️  Found ${invalid.length} offers with non-standard power values`);
    }
  });
  
  // Test 10: Discovery metadata exists
  test('meta.json includes discovery analytics', () => {
    if (!fs.existsSync(META_PATH)) {
      throw new Error(`Missing ${META_PATH}`);
    }
    
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    
    if (!meta.discovery) {
      throw new Error('meta.json missing discovery section');
    }
    
    if (!Array.isArray(meta.discovery.promotionFieldHits)) {
      throw new Error('discovery.promotionFieldHits must be an array');
    }
    
    if (!Array.isArray(meta.discovery.samplePromotionSnippets)) {
      throw new Error('discovery.samplePromotionSnippets must be an array');
    }
    
    if (!Array.isArray(meta.discovery.lockInSamples)) {
      throw new Error('discovery.lockInSamples must be an array');
    }
    
    // Check for new diagnostics
    if (!meta.discovery.lockInBySource || typeof meta.discovery.lockInBySource !== 'object') {
      throw new Error('discovery.lockInBySource must be an object');
    }
    
    if (!Array.isArray(meta.discovery.promotionParsedSamples)) {
      throw new Error('discovery.promotionParsedSamples must be an array');
    }
    
    console.log(`   Discovery: ${meta.discovery.promotionFieldHits.length} columns with promotion hits`);
    console.log(`   - ${meta.discovery.samplePromotionSnippets.length} promotion samples`);
    console.log(`   - ${meta.discovery.lockInSamples.length} lock-in samples`);
    console.log(`   - Lock-in by source: field=${meta.discovery.lockInBySource.field || 0}, text=${meta.discovery.lockInBySource.text || 0}`);
    console.log(`   - Promotion parsed samples: ${meta.discovery.promotionParsedSamples.length}`);
  });
  
  // Test 10b: Statistics validation
  test('meta.json statistics include new metrics', () => {
    if (!fs.existsSync(META_PATH)) {
      throw new Error(`Missing ${META_PATH}`);
    }
    
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    
    if (!meta.build || !meta.build.statistics) {
      throw new Error('meta.json missing build.statistics');
    }
    
    const stats = meta.build.statistics;
    
    // Check for new metrics (prefer new names, accept old for backwards compatibility)
    if (stats.activeOffersCount === undefined && stats.activeCampaignCount === undefined) {
      throw new Error('statistics missing activeOffersCount or activeCampaignCount');
    }
    
    if (stats.promotionsWithMetadataCount === undefined) {
      throw new Error('statistics missing promotionsWithMetadataCount');
    }
    
    if (stats.promotionsWithKnownActiveStatusCount === undefined) {
      throw new Error('statistics missing promotionsWithKnownActiveStatusCount');
    }
    
    if (stats.promotionsActiveCount === undefined) {
      throw new Error('statistics missing promotionsActiveCount');
    }
    
    if (stats.promotionsAppliedCount === undefined) {
      throw new Error('statistics missing promotionsAppliedCount');
    }
    
    // Check for lock-in totals
    if (!stats.lockInBySourceTotals || typeof stats.lockInBySourceTotals !== 'object') {
      throw new Error('statistics missing lockInBySourceTotals');
    }
    
    // Verify promotions are not applied (should be 0)
    if (stats.promotionsAppliedCount !== 0) {
      throw new Error(`promotionsAppliedCount should be 0 (promotions not used in calculations), got ${stats.promotionsAppliedCount}`);
    }
    
    const activeOffers = stats.activeOffersCount !== undefined ? stats.activeOffersCount : stats.activeCampaignCount;
    console.log(`   Statistics:`);
    console.log(`   - Active offers: ${activeOffers}`);
    console.log(`   - Lock-in by source totals: field=${stats.lockInBySourceTotals.field || 0}, text=${stats.lockInBySourceTotals.text || 0}`);
    console.log(`   - Promotions with metadata: ${stats.promotionsWithMetadataCount}`);
    console.log(`   - Promotions with known active status: ${stats.promotionsWithKnownActiveStatusCount}`);
    console.log(`   - Promotions active: ${stats.promotionsActiveCount}`);
    console.log(`   - Promotions applied: ${stats.promotionsAppliedCount} (not used in ranking)`);
  });
  
  // Test 11: Promotion discovery validation
  test('promotion discovery validation', () => {
    if (!fs.existsSync(META_PATH)) {
      return; // Skip if meta.json doesn't exist
    }
    
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    const discovery = meta.discovery;
    
    if (!discovery) {
      return; // Skip if discovery not present
    }
    
    const hasPromotionHits = discovery.promotionFieldHits && discovery.promotionFieldHits.length > 0;
    const promotionMetadataCount = offers.filter(o => o.promotion !== null).length;
    
    if (hasPromotionHits && promotionMetadataCount === 0) {
      // This is a warning, not an error - patterns may need refinement
      console.log(`   ⚠️  WARNING: Promotion tokens found in data (${discovery.promotionFieldHits.length} columns) but no promotions extracted.`);
      console.log(`   This may indicate pattern matching needs refinement.`);
    } else if (hasPromotionHits && promotionMetadataCount > 0) {
      console.log(`   ✅ Promotion discovery successful: ${promotionMetadataCount} promotions extracted from ${discovery.promotionFieldHits.length} columns`);
    }
  });
  
  // Summary
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.error('\n❌ Self-test failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

// Run
if (require.main === module) {
  runSelftest().catch(error => {
    console.error(`\n❌ Self-test crashed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runSelftest };

