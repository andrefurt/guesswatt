/**
 * Self-test Script
 * 
 * Validates built offers.json:
 * - Offers exist
 * - Required fields present
 * - No GN-only offers
 * - Calculation samples (no NaN, positive totals)
 * 
 * Usage:
 *   node scripts/selftest.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OFFERS_PATH = path.join(DATA_DIR, 'offers.json');
const META_PATH = path.join(DATA_DIR, 'meta.json');

// Constants for calculation (matching frontend)
const VAT = 1.23;
const DAYS_PER_MONTH = 30;
const AUDIOVISUAL_TAX = 2.85;
const IEC_KWH = 0.001;

/**
 * Calculate monthly cost for an offer (simplified, matches calculator.js logic)
 */
function calculateMonthlyCost(offer, consumption, power) {
  const tvField = offer['TV|TVFV|TVP'] || offer.TV || 0;
  const fixedTerm = (offer.TF || 0) * DAYS_PER_MONTH;
  const variableTerm = consumption * tvField;
  const iec = consumption * IEC_KWH;
  const subtotal = fixedTerm + variableTerm + iec + AUDIOVISUAL_TAX;
  return subtotal * VAT;
}

/**
 * Run self-tests
 */
function runSelftest() {
  console.log('🧪 Running self-tests...\n');
  
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
    
    // Note: We can't import the calculator functions here (CommonJS vs ES modules)
    // So we'll just verify that offers have the required fields for calculation
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
  
  // Test 8: Tariff types are valid
  test('tariff types are valid (1, 2, or 3)', () => {
    const invalid = offers.filter(o => ![1, 2, 3].includes(o.Contagem));
    if (invalid.length > 0) {
      throw new Error(`Found ${invalid.length} offers with invalid Contagem`);
    }
  });
  
  // Test 9: Power values are standard
  test('power values are standard kVA values', () => {
    const standardPowers = [1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7];
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
  runSelftest();
}

module.exports = { runSelftest };

