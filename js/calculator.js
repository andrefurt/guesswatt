/**
 * Calculator Module
 * Pure business logic for cost calculations, offer filtering, and consumption estimation
 */

import { VAT, DAYS_PER_MONTH, AUDIOVISUAL_TAX, DEFAULT_POWER } from './config.js';
import { detectCycleType } from './utils.js';

// Constants from DATA_MODEL.mdc
const IEC_KWH = 0.001; // Special consumption tax (€/kWh)

// Consumption distribution assumptions (when unknown)
const BI_HORARIA = {
  vazio: 0.35,      // 22h-08h
  foraVazio: 0.65   // 08h-22h
};

const TRI_HORARIA = {
  vazio: 0.30,      // night
  cheias: 0.50,     // mid-day
  ponta: 0.20       // peak hours
};

// Fallback typical offer when no data is loaded (DATA_MODEL.mdc defaults)
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
 * median fixed term and median energy price
 * @param {Array<Object>|null} offers - Loaded offers
 * @returns {Object} Synthetic offer accepted by calculateMonthlyCost
 */
export function typicalOffer(offers = null) {
  const atPower = (offers || []).filter(o => o.Pot_Cont === DEFAULT_POWER && o.TF > 0);
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
 * @returns {number} Estimated consumption in kWh
 */
export function estimateConsumption(monthlyBill, offers = null) {
  const typical = typicalOffer(offers);
  const costAt = kWh => calculateMonthlyCost(typical, kWh, DEFAULT_POWER);

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
 * Implements full calculation with IEC, proper tariff splitting, and VAT
 * @param {Object} offer - Offer object from CSV/JSON
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {Object} distribution - Optional: actual consumption distribution for bi/tri tariffs
 * @returns {number} Monthly cost in euros (with VAT)
 */
export function calculateMonthlyCost(offer, consumption, power, distribution = null) {
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
  
  // Taxes
  const iec = consumption * IEC_KWH;
  const subtotal = fixedTerm + variableTerm + iec + AUDIOVISUAL_TAX;
  const total = subtotal * VAT;
  
  return total;
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
export function calculateMonthlyCostWithPromotion(offer, consumption, power, distribution = null) {
  const monthlyCostBase = calculateMonthlyCost(offer, consumption, power, distribution);
  
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
export function calculateAnnualEffectiveCost(offer, consumption, power, distribution = null) {
  const monthlyCostBase = calculateMonthlyCost(offer, consumption, power, distribution);
  
  // Promotions are NOT applied - use base cost only for conservative, trustworthy pricing
  return monthlyCostBase * 12;
}

/**
 * Find best offer for simple tariff (Contagem=1)
 * Excludes lock-in offers by default and uses annual effective cost for ranking
 * @param {Array<Object>} offers - Array of offer objects
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @returns {Object} Best offer object with monthlyCost and annualCostEffective properties
 * @throws {Error} If no valid offers found
 */
export function findBestOffer(offers, consumption, power) {
  // Filtrar ofertas válidas (exclude lock-in by default)
  const valid = offers.filter(o => {
    const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
    const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
    return o.TF > 0 && 
           tvField > 0 && 
           potCont === power &&
           o.Contagem === 1 && // tarifa simples
           o.hasLockIn !== true; // Exclude lock-in offers
  });
  
  if (valid.length === 0) {
    throw new Error('Nenhuma oferta válida encontrada');
  }
  
  // Calcular custos para cada uma
  const withCosts = valid.map(o => {
    const monthlyCost = calculateMonthlyCost(o, consumption, power);
    const annualCostEffective = calculateAnnualEffectiveCost(o, consumption, power);
    const { monthlyCostBase, monthlyCostPromo } = calculateMonthlyCostWithPromotion(o, consumption, power);
    
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
 * Find best offer for specific tariff type
 * Excludes lock-in offers by default and uses annual effective cost for ranking
 * @param {Array<Object>} offers - Array of offer objects
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {number} tariffType - Tariff type (1=simples, 2=bi-horária, 3=tri-horária)
 * @param {Object} distribution - Optional: actual consumption distribution for bi/tri tariffs
 * @returns {Object} Best offer object with monthlyCost and annualCostEffective properties
 * @throws {Error} If no valid offers found
 */
export function findBestOfferForTariff(offers, consumption, power, tariffType = 1, distribution = null) {
  // Normalize power to number for comparison
  const normalizedPower = typeof power === 'number' ? power : parseFloat(String(power).replace(',', '.'));
  const normalizedTariffType = typeof tariffType === 'number' ? tariffType : parseInt(tariffType);
  
  // Debug logging (can be removed in production)
  console.log(`[findBestOfferForTariff] Searching with: power=${normalizedPower} kVA, tariffType=${normalizedTariffType}, consumption=${consumption} kWh, total offers=${offers.length}`);
  
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
           o.hasLockIn !== true; // Exclude lock-in offers
  });
  
  console.log(`[findBestOfferForTariff] Found ${valid.length} valid offers after filtering`);
  
  if (valid.length === 0) {
    throw new Error(`Nenhuma oferta válida encontrada para potência ${normalizedPower} kVA e tarifa ${normalizedTariffType}`);
  }
  
  // Calcular custos para cada uma
  const withCosts = valid.map(o => {
    const monthlyCost = calculateMonthlyCost(o, consumption, power, distribution);
    const annualCostEffective = calculateAnnualEffectiveCost(o, consumption, power, distribution);
    const { monthlyCostBase, monthlyCostPromo } = calculateMonthlyCostWithPromotion(o, consumption, power, distribution);
    
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
  
  // Debug logging (with defensive check)
  const best = withValidCosts[0];
  if (best) {
    console.log(`[findBestOfferForTariff] Best offer: ${best.COM} - ${best.tariffName || best.COD_Proposta} (annual cost: €${best.annualCostEffective.toFixed(2)})`);
    if (withValidCosts.length > 1) {
      console.log(`[findBestOfferForTariff] Top 3 offers:`, withValidCosts.slice(0, 3).map(o => ({
        provider: o.COM,
        tariff: o.tariffName || o.COD_Proposta,
        annualCost: o.annualCostEffective.toFixed(2)
      })));
    }
  }
  
  return best; // melhor oferta
}

/**
 * Enrich offer with commercial data and campaign metadata
 * @param {Object} offer - Offer object
 * @param {Array<Object>} conditions - Commercial conditions array
 * @returns {Object} Enriched offer object with campaign metadata
 */
export function enrichOffer(offer, conditions) {
  const condition = conditions.find(c => 
    c.COM === offer.COM && 
    c.COD_Proposta === offer.COD_Proposta
  );
  
  // If condition has _enriched metadata (from offers.json), use it
  if (condition?._enriched) {
    return {
      ...offer,
      ...condition._enriched,
      tariffName: condition._enriched.tariffName || offer.COD_Proposta,
      phone: condition._enriched.phone || condition?.ContactoComercialTel || null,
      website: condition._enriched.website || condition?.LinkOfertaCom || condition?.LinkCOM || null
    };
  }
  
  // Fallback: extract from condition object (CSV mode)
  const tariffName = condition?.NomeProposta || offer.COD_Proposta;
  
  // Detect cycle type from tariff name (for CSV fallback)
  const cycleType = tariffName ? detectCycleType(tariffName) : null;
  
  return {
    ...offer,
    tariffName: tariffName,
    cycleType: cycleType, // Include cycleType for CSV fallback
    phone: condition?.ContactoComercialTel || null,
    website: condition?.LinkOfertaCom || condition?.LinkCOM || null,
    fornecimento: condition?.Fornecimento || '',
    segmento: condition?.Segmento || '',
    validFrom: condition?.['Data ini'] || '',
    validTo: condition?.['Data fim'] || '',
    isIndexed: condition?.FiltroPrecosIndex === 'S',
    hasLockIn: condition?.FiltroFidelização === 'S',
    newCustomerOnly: false,
    requiresDirectDebit: false,
    requiresEBill: false,
    campaignSummary: condition?.TxTOferta ? String(condition.TxTOferta).substring(0, 200) : '',
    isCampaignActive: null // Would need date parsing to determine
  };
}

