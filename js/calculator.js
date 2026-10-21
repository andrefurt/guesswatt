/**
 * Calculator Module
 * Pure business logic for cost calculations, offer filtering, and consumption estimation
 */

import {
  VAT,
  VAT_REDUCED,
  REDUCED_VAT_MAX_POWER,
  REDUCED_VAT_KWH,
  REDUCED_VAT_KWH_LARGE_HOUSEHOLD,
  REDUCED_FIXED_VAT_MAX_POWER,
  DGEG_FEE,
  DAYS_PER_MONTH,
  AUDIOVISUAL_TAX,
  DEFAULT_POWER
} from './config.js';

// Constants; docs/DATA_MODEL.mdc explains them
const IEC_KWH = 0.001; // Special consumption tax (€/kWh)

// Consumption distribution assumptions (when unknown)
// ERSE's simulator assumes 40% vazio for all three of its typical consumers
// (Manual do Simulador, "Pressupostos considerados", p. 15)
const BI_HORARIA = {
  vazio: 0.40,      // 22h-08h
  foraVazio: 0.60   // 08h-22h
};

// Not from an official source: ERSE publishes no tri-hourly typical split
const TRI_HORARIA = {
  vazio: 0.30,      // night
  cheias: 0.50,     // mid-day
  ponta: 0.20       // peak hours
};

// Fallback typical offer when no data is loaded
const FALLBACK_TF = 0.25;   // €/day
const FALLBACK_TV = 0.18;   // €/kWh

const MIN_ESTIMATE_KWH = 50;
const MAX_ESTIMATE_KWH = 5000;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Build a typical simple-tariff offer at the default power from the loaded offers:
 * median fixed term and median energy price among the offers active on asOf
 * @param {Array<Object>|null} offers - Loaded offers
 * @param {Date} asOf - Day for the active check (defaults to today)
 * @returns {Object} Synthetic offer accepted by calculateMonthlyCost
 */
export function typicalOffer(offers = null, asOf = new Date()) {
  const atPower = (offers || []).filter(o => o.Pot_Cont === DEFAULT_POWER && o.TF > 0 && isOfferActive(o, asOf));
  const simple = atPower.filter(o => o.Contagem === 1 && o['TV|TVFV|TVP'] > 0);

  return {
    Contagem: 1,
    Pot_Cont: DEFAULT_POWER,
    TF: atPower.length > 0 ? median(atPower.map(o => o.TF)) : FALLBACK_TF,
    'TV|TVFV|TVP': simple.length > 0 ? median(simple.map(o => o['TV|TVFV|TVP'])) : FALLBACK_TV
  };
}

/**
 * Estimate consumption (kWh) from monthly bill amount
 * Inverts calculateMonthlyCost on the typical offer by bisection, so the estimate
 * uses exactly the same formula (and taxes) as the costs shown afterwards
 * @param {number} monthlyBill - Monthly bill amount in euros
 * @param {Array<Object>} offers - Optional: loaded offers for data-driven estimation
 * @param {Object} context - Optional context (see calculateMonthlyCost)
 * @returns {number} Estimated consumption in kWh
 */
export function estimateConsumption(monthlyBill, offers = null, context = {}) {
  const typical = typicalOffer(offers, context.asOf);
  const costAt = kWh => calculateMonthlyCost(typical, kWh, DEFAULT_POWER, null, context);

  let low = 0;
  let high = MAX_ESTIMATE_KWH;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (costAt(mid) < monthlyBill) low = mid;
    else high = mid;
  }

  // Clamp to reasonable bounds
  return Math.max(MIN_ESTIMATE_KWH, Math.min(MAX_ESTIMATE_KWH, Math.round(low)));
}

/**
 * Calculate monthly cost for an offer
 * Implements full calculation with IEC, DGEG, proper tariff splitting, and VAT per component
 * @param {Object} offer - Offer object from offers.json
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {Object} distribution - Optional: actual consumption distribution for bi/tri tariffs
 * @param {Object} context - Optional: { tar (data/tar.json), largeHousehold, reducedVatKwh, asOf (Date for eligibility) }
 * @returns {number} Monthly cost in euros (with VAT)
 */
export function calculateMonthlyCost(offer, consumption, power, distribution = null, context = {}) {
  const tariffType = offer.Contagem || 1;
  const fixedTerm = (offer.TF || 0) * DAYS_PER_MONTH;
  
  // Variable term depends on tariff type
  let variableTerm = 0;
  
  if (tariffType === 1) {
    // Simple: single price
    const tv = offer['TV|TVFV|TVP'] || offer.TV || 0;
    variableTerm = consumption * tv;
  } else if (tariffType === 2) {
    // Bi-hourly: valley (vazio) + off-valley (fora vazio)
    const dist = distribution || BI_HORARIA;
    const tvv = offer['TVV|TVC'] || offer.TVV || 0; // Valley price
    const tvfv = offer['TV|TVFV|TVP'] || offer.TVFV || 0; // Off-valley price
    
    variableTerm = 
      consumption * dist.vazio * tvv +
      consumption * dist.foraVazio * tvfv;
  } else if (tariffType === 3) {
    // Tri-hourly: valley (vazio) + mid (cheias) + peak (ponta)
    const dist = distribution || TRI_HORARIA;
    const tvvz = offer.TVVz || 0; // Super-valley price
    const tvc = offer['TVV|TVC'] || offer.TVC || 0; // Mid price
    const tvp = offer['TV|TVFV|TVP'] || offer.TVP || 0; // Peak price
    
    variableTerm = 
      consumption * dist.vazio * tvvz +
      consumption * dist.cheias * tvc +
      consumption * dist.ponta * tvp;
  } else {
    // Fallback: treat as simple
    const tv = offer['TV|TVFV|TVP'] || offer.TV || 0;
    variableTerm = consumption * tv;
  }
  
  // VAT per component. Energy: reduced rate on the first kWh up to the threshold,
  // prorated across periods. Fixed term: reduced rate on its network-access (TAR) share.
  const reducedKwh = power <= REDUCED_VAT_MAX_POWER ? reducedVatKwh(context) : 0;
  const reducedShare = consumption > 0 ? Math.min(1, reducedKwh / consumption) : 0;
  const energy =
    variableTerm * reducedShare * VAT_REDUCED +
    variableTerm * (1 - reducedShare) * VAT;

  const tarPerDay = power <= REDUCED_FIXED_VAT_MAX_POWER ? accessFixedPerDay(context, power) : 0;
  const fixedReduced = Math.min(fixedTerm, tarPerDay * DAYS_PER_MONTH);
  const fixed = fixedReduced * VAT_REDUCED + (fixedTerm - fixedReduced) * VAT;

  const iec = consumption * IEC_KWH * VAT;
  const audiovisual = AUDIOVISUAL_TAX * VAT_REDUCED;
  const dgeg = DGEG_FEE * VAT;

  // Mandatory services bundled with the offer (ERSE gives €/year with VAT), as ERSE's simulator does
  const services = (offer.serviceCostYear || 0) / 12;

  return energy + fixed + iec + audiovisual + dgeg + services;
}

/**
 * kWh per 30 days that get the reduced VAT rate
 * @param {Object} context - Context: { largeHousehold, reducedVatKwh }
 * @returns {number}
 */
function reducedVatKwh(context) {
  if (typeof context.reducedVatKwh === 'number') return context.reducedVatKwh;
  return context.largeHousehold ? REDUCED_VAT_KWH_LARGE_HOUSEHOLD : REDUCED_VAT_KWH;
}

/**
 * Network-access (TAR) fixed term for a power, from data/tar.json
 * @param {Object} context - Context: { tar }
 * @param {number} power - Power in kVA
 * @returns {number} €/day, 0 when the table has no value
 */
function accessFixedPerDay(context, power) {
  const table = context.tar?.fixedTermByPower;
  if (!table) return 0;
  const key = String(Number(String(power).replace(',', '.')));
  return table[key] || 0;
}

/**
 * Parse an ERSE date (DD/MM/YYYY) as UTC midnight
 * @param {string} value
 * @returns {Date|null}
 */
function parseErseDate(value) {
  const parts = String(value || '').split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Whether an offer is inside its validity dates on a given day
 * @param {Object} offer - Offer with validFrom/validTo (DD/MM/YYYY, either may be empty)
 * @param {Date} asOf - Day to check (defaults to today)
 * @returns {boolean}
 */
export function isOfferActive(offer, asOf = new Date()) {
  const day = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const from = parseErseDate(offer.validFrom);
  const to = parseErseDate(offer.validTo);
  if (from && day < from.getTime()) return false;
  if (to && day > to.getTime()) return false;
  return true;
}

/**
 * Whether an offer can be offered to this profile on this day:
 * active (isOfferActive) and inside its annual consumption band
 * @param {Object} offer - Offer with validity dates and consMinYear/consMaxYear (kWh/year)
 * @param {number} consumption - Monthly consumption in kWh
 * @param {Date} asOf - Day to check (defaults to today)
 * @returns {boolean}
 */
export function isOfferEligible(offer, consumption, asOf = new Date()) {
  if (!isOfferActive(offer, asOf)) return false;

  const yearly = consumption * 12;
  if (typeof offer.consMinYear === 'number' && yearly < offer.consMinYear) return false;
  if (typeof offer.consMaxYear === 'number' && yearly > offer.consMaxYear) return false;
  return true;
}

/**
 * Calculate monthly cost with promotion applied (if applicable)
 * NOTE: Promotions are NOT applied - kept for backwards compatibility only
 * @param {Object} offer - Offer object with promotion metadata
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {Object} distribution - Optional: actual consumption distribution for bi/tri tariffs
 * @returns {Object} Object with monthlyCostBase, monthlyCostPromo, and promotionApplied
 */
export function calculateMonthlyCostWithPromotion(offer, consumption, power, distribution = null, context = {}) {
  const monthlyCostBase = calculateMonthlyCost(offer, consumption, power, distribution, context);
  
  // Promotions are NOT applied to calculations (metadata only)
  // This ensures we don't make speculative savings claims
  return {
    monthlyCostBase,
    monthlyCostPromo: monthlyCostBase, // Always equals base (no promotion discount)
    promotionApplied: false // Never applied
  };
}

/**
 * Calculate annual effective cost (12-month horizon)
 * NOTE: Promotions are NOT applied - uses base costs only for conservative pricing
 * @param {Object} offer - Offer object with promotion metadata
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {Object} distribution - Optional: actual consumption distribution for bi/tri tariffs
 * @returns {number} Annual cost in euros (base cost only, no promotions)
 */
export function calculateAnnualEffectiveCost(offer, consumption, power, distribution = null, context = {}) {
  const monthlyCostBase = calculateMonthlyCost(offer, consumption, power, distribution, context);
  
  // Promotions are NOT applied - use base cost only for conservative, trustworthy pricing
  return monthlyCostBase * 12;
}

/**
 * Find best offer for simple tariff (Contagem=1)
 * Excludes lock-in and ineligible offers (isOfferEligible) and uses annual effective cost for ranking
 * @param {Array<Object>} offers - Array of offer objects
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {Object} context - Optional context (see calculateMonthlyCost)
 * @returns {Object} Best offer object with monthlyCost and annualCostEffective properties
 * @throws {Error} If no valid offers found
 */
export function findBestOffer(offers, consumption, power, context = {}) {
  // Filtrar ofertas válidas (exclude lock-in by default)
  const valid = offers.filter(o => {
    const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
    const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
    return o.TF > 0 && 
           tvField > 0 && 
           potCont === power &&
           o.Contagem === 1 && // tarifa simples
           o.hasLockIn !== true && // Exclude lock-in offers
           o.isRestricted !== true && // Exclude conditioned offers
           isOfferEligible(o, consumption, context.asOf);
  });
  
  if (valid.length === 0) {
    throw new Error('Nenhuma oferta válida encontrada');
  }
  
  // Calcular custos para cada uma
  const withCosts = valid.map(o => {
    const monthlyCost = calculateMonthlyCost(o, consumption, power, null, context);
    const annualCostEffective = calculateAnnualEffectiveCost(o, consumption, power, null, context);
    const { monthlyCostBase, monthlyCostPromo } = calculateMonthlyCostWithPromotion(o, consumption, power, null, context);
    
    return {
      ...o,
      monthlyCost,
      monthlyCostBase,
      monthlyCostPromo,
      annualCostEffective
    };
  });
  
  // Filtrar ofertas com custo válido
  const withValidCosts = withCosts.filter(o => 
    o.monthlyCost > 0 && 
    !isNaN(o.monthlyCost) &&
    o.annualCostEffective > 0 &&
    !isNaN(o.annualCostEffective)
  );
  
  if (withValidCosts.length === 0) {
    throw new Error('Nenhuma oferta com custo válido encontrada');
  }
  
  // Ordenar por annualCostEffective (primary), depois monthlyCostBase (tiebreaker), depois nome (stable)
  withValidCosts.sort((a, b) => {
    // Primary: annual effective cost
    if (a.annualCostEffective !== b.annualCostEffective) {
      return a.annualCostEffective - b.annualCostEffective;
    }
    // Tiebreaker 1: monthly base cost
    if (a.monthlyCostBase !== b.monthlyCostBase) {
      return a.monthlyCostBase - b.monthlyCostBase;
    }
    // Tiebreaker 2: alphabetical by provider/tariff name (stable output)
    const nameA = (a.tariffName || a.COD_Proposta || a.COM || '').toLowerCase();
    const nameB = (b.tariffName || b.COD_Proposta || b.COM || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  return withValidCosts[0]; // melhor oferta
}

/**
 * Median monthly cost of the offers that could win for this profile (same filters as
 * findBestOfferForTariff). Used in estimate mode to place the best offer in the market;
 * the median is robust to the few offers that bundle equipment.
 * @returns {number|null} €/month, null when no offer qualifies
 */
export function marketMedianCost(offers, consumption, power, tariffType = 1, distribution = null, context = {}) {
  const costs = offers
    .filter(o =>
      Math.abs(o.Pot_Cont - power) < 0.01 &&
      o.Contagem === tariffType &&
      o.TF > 0 &&
      (o['TV|TVFV|TVP'] || 0) > 0 &&
      o.hasLockIn !== true &&
      o.isRestricted !== true &&
      isOfferEligible(o, consumption, context.asOf))
    .map(o => calculateMonthlyCost(o, consumption, power, distribution, context))
    .sort((a, b) => a - b);
  return costs.length > 0 ? median(costs) : null;
}

/**
 * Find best offer for specific tariff type
 * Excludes lock-in and ineligible offers (isOfferEligible) and uses annual effective cost for ranking
 * @param {Array<Object>} offers - Array of offer objects
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {number} tariffType - Tariff type (1=simples, 2=bi-horária, 3=tri-horária)
 * @param {Object} distribution - Optional: actual consumption distribution for bi/tri tariffs
 * @param {Object} context - Optional context (see calculateMonthlyCost)
 * @returns {Object} Best offer object with monthlyCost and annualCostEffective properties
 * @throws {Error} If no valid offers found
 */
export function findBestOfferForTariff(offers, consumption, power, tariffType = 1, distribution = null, context = {}) {
  // Normalize power to number for comparison
  const normalizedPower = typeof power === 'number' ? power : parseFloat(String(power).replace(',', '.'));
  const normalizedTariffType = typeof tariffType === 'number' ? tariffType : parseInt(tariffType);
  
  // Filtrar ofertas válidas (exclude lock-in by default)
  const valid = offers.filter(o => {
    const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
    const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
    const contagem = typeof o.Contagem === 'number' ? o.Contagem : parseInt(o.Contagem);
    
    // Use tolerance for floating point comparison (0.01 kVA tolerance)
    const powerMatch = Math.abs(potCont - normalizedPower) < 0.01;
    
    return o.TF > 0 && 
           tvField > 0 && 
           powerMatch &&
           contagem === normalizedTariffType &&
           o.hasLockIn !== true && // Exclude lock-in offers
           o.isRestricted !== true && // Exclude conditioned offers
           isOfferEligible(o, consumption, context.asOf);
  });
  
  if (valid.length === 0) {
    throw new Error(`Nenhuma oferta válida encontrada para potência ${normalizedPower} kVA e tarifa ${normalizedTariffType}`);
  }
  
  // Calcular custos para cada uma
  const withCosts = valid.map(o => {
    const monthlyCost = calculateMonthlyCost(o, consumption, power, distribution, context);
    const annualCostEffective = calculateAnnualEffectiveCost(o, consumption, power, distribution, context);
    const { monthlyCostBase, monthlyCostPromo } = calculateMonthlyCostWithPromotion(o, consumption, power, distribution, context);
    
    return {
      ...o,
      monthlyCost,
      monthlyCostBase,
      monthlyCostPromo,
      annualCostEffective
    };
  });
  
  // Filtrar ofertas com custo válido
  const withValidCosts = withCosts.filter(o => 
    o.monthlyCost > 0 && 
    !isNaN(o.monthlyCost) &&
    o.annualCostEffective > 0 &&
    !isNaN(o.annualCostEffective)
  );
  
  if (withValidCosts.length === 0) {
    throw new Error('Nenhuma oferta com custo válido encontrada');
  }
  
  // Ordenar por annualCostEffective (primary), depois monthlyCostBase (tiebreaker), depois nome (stable)
  withValidCosts.sort((a, b) => {
    // Primary: annual effective cost
    if (a.annualCostEffective !== b.annualCostEffective) {
      return a.annualCostEffective - b.annualCostEffective;
    }
    // Tiebreaker 1: monthly base cost
    if (a.monthlyCostBase !== b.monthlyCostBase) {
      return a.monthlyCostBase - b.monthlyCostBase;
    }
    // Tiebreaker 2: alphabetical by provider/tariff name (stable output)
    const nameA = (a.tariffName || a.COD_Proposta || a.COM || '').toLowerCase();
    const nameB = (b.tariffName || b.COD_Proposta || b.COM || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  const best = withValidCosts[0];
  
  return best; // melhor oferta
}

/**
 * Monthly saving of the best offer against the person's current supplier: that supplier's cheapest
 * offer for the same power and tariff type (lock-in and conditions included, since the person may
 * be on any of them). Zero or negative means the current supplier already matches the best offer.
 * @param {Array<Object>} offers
 * @param {string} provider - ERSE supplier code (COM)
 * @param {number} bestMonthlyCost - Monthly cost of the best offer
 * @returns {{monthly: number, yearly: number}|null} null when the supplier has no offer for this profile
 */
export function currentSupplierSaving(offers, provider, consumption, power, tariffType, bestMonthlyCost, distribution = null, context = {}) {
  const costs = offers
    .filter(o =>
      o.COM === provider &&
      o.TF > 0 &&
      (o['TV|TVFV|TVP'] || o.TV || 0) > 0 &&
      Math.abs(o.Pot_Cont - power) < 0.01 &&
      o.Contagem === tariffType)
    .map(o => calculateMonthlyCost(o, consumption, power, distribution, context));
  if (costs.length === 0) return null;
  const monthly = Math.min(...costs) - bestMonthlyCost;
  return { monthly, yearly: monthly * 12 };
}

/**
 * The one comparison every flow runs (estimate form, manual form, PDF)
 * @param {Array<Object>} offers
 * @param {Object} input - { mode: 'estimate', bill } or
 *   { mode: 'precise', consumption, power, tariffType, distribution?, provider? }
 * @param {Object} context - See calculateMonthlyCost
 * @returns {{best: Object, consumption: number, power: number, savings: Object|null, marketMedianCost: number|null}}
 * @throws {Error} When no offer qualifies for the profile
 */
export function compare(offers, input, context = {}) {
  if (input.mode === 'estimate') {
    const consumption = estimateConsumption(input.bill, offers, context);
    const best = findBestOffer(offers, consumption, DEFAULT_POWER, context);
    return {
      best,
      consumption,
      power: DEFAULT_POWER,
      savings: null, // estimate mode knows the bill, not the tariff behind it (ADR-011 superseded)
      marketMedianCost: marketMedianCost(offers, consumption, DEFAULT_POWER, 1, null, context)
    };
  }
  const { consumption, power, tariffType, distribution = null, provider = null } = input;
  const best = findBestOfferForTariff(offers, consumption, power, tariffType, distribution, context);
  const savings = provider
    ? currentSupplierSaving(offers, provider, consumption, power, tariffType, best.monthlyCost, distribution, context)
    : null;
  return { best, consumption, power, savings, marketMedianCost: null };
}
