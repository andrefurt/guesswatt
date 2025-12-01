/**
 * GuessWatt - Calculator
 * 
 * Invoice calculation and offer comparison logic.
 * Formulas based on ERSE documentation.
 * See: docs/DATA_MODEL.mdc
 */

import { 
  IVA, 
  CONTRIB_AUDIOVISUAL, 
  TAXA_DGEG, 
  IMPOSTO_ESPECIAL, 
  DIAS_MES,
  DEFAULTS,
  DISTRIBUICAO,
} from '../constants.js';
import { parseNumber } from './csv-parser.js';
import { getProviderName } from './providers.js';

/**
 * Calculate monthly invoice for an offer.
 * 
 * @param {Object} offer - Price data from CSV
 * @param {Object} conditions - Commercial conditions from CSV
 * @param {number} consumption - Monthly consumption (kWh)
 * @param {number} tariffType - 1=simple, 2=bi-hourly, 3=tri-hourly
 * @param {number} offPeakPercent - Fraction of consumption in off-peak (0-1)
 * @returns {Object} Invoice breakdown
 */
export function calculateInvoice(offer, conditions, consumption, tariffType, offPeakPercent = DEFAULTS.percentagemVazio) {
  // Parse base rates from CSV
  const fixedRateBase = parseNumber(offer.TF);
  const variablePeakBase = parseNumber(offer['TV|TVFV|TVP']);
  const variableOffPeakBase = parseNumber(offer['TVV|TVC']);
  
  // Parse discounts
  const discountFixed = parseNumber(conditions['ReembTF_ELE (%)']);
  const discountVariable = parseNumber(conditions['ReembTW_ELE (%)']);
  
  // Apply discounts
  const fixedRate = fixedRateBase * (1 - discountFixed);
  const variablePeak = variablePeakBase * (1 - discountVariable);
  const variableOffPeak = variableOffPeakBase * (1 - discountVariable);
  
  // Additional costs/discounts from conditions
  const servicesCostYearly = parseNumber(conditions['CustoServicos_c/IVA (€/ano)']);
  const servicesCostMonthly = servicesCostYearly / 12;
  const newCustomerDiscountYearly = parseNumber(conditions['DescontNovoCliente_c/IVA (€/ano)']);
  const newCustomerDiscountMonthly = newCustomerDiscountYearly / 12;
  
  // Calculate energy cost based on tariff type
  let energyCost = 0;
  
  if (tariffType === 1) {
    // Simple: single rate
    energyCost = consumption * variablePeak;
  } else if (tariffType === 2) {
    // Bi-hourly: peak + off-peak
    const consumptionOffPeak = consumption * offPeakPercent;
    const consumptionPeak = consumption * (1 - offPeakPercent);
    energyCost = (consumptionPeak * variablePeak) + (consumptionOffPeak * variableOffPeak);
  } else if (tariffType === 3) {
    // Tri-hourly: use distribution assumptions
    const dist = DISTRIBUICAO.triHoraria;
    const superOffPeak = parseNumber(offer.TVVz) * (1 - discountVariable);
    energyCost = 
      (consumption * dist.vazio * superOffPeak) +
      (consumption * dist.cheias * variableOffPeak) +
      (consumption * dist.ponta * variablePeak);
  }
  
  // Fixed costs
  const powerCost = fixedRate * DIAS_MES;
  
  // Taxes
  const specialTax = consumption * IMPOSTO_ESPECIAL;
  const taxes = CONTRIB_AUDIOVISUAL + TAXA_DGEG + specialTax;
  
  // Totals
  const subtotal = powerCost + energyCost;
  const vat = subtotal * IVA;
  const total = subtotal + vat + taxes + servicesCostMonthly;
  // Ensure total is never negative (new customer discount can't exceed total)
  const totalWithDiscount = Math.max(0, total - newCustomerDiscountMonthly);
  
  return {
    // Base rates
    fixedRateBase,
    variablePeakBase,
    variableOffPeakBase,
    
    // After discounts
    fixedRate,
    variablePeak,
    variableOffPeak,
    
    // Discount info
    discountFixed,
    discountVariable,
    hasDiscount: discountFixed > 0 || discountVariable > 0,
    
    // Cost breakdown
    powerCost,
    energyCost,
    taxes,
    vat,
    servicesCostMonthly,
    newCustomerDiscountMonthly,
    
    // Totals
    subtotal,
    total,
    totalWithDiscount,
    
    // For sorting (use total without first-year discount)
    comparableTotal: total,
  };
}

/**
 * Filter offers by power and tariff type.
 * Excludes non-domestic and invalid offers.
 * 
 * @param {Array} prices - All prices from CSV
 * @param {Object} conditions - Conditions map
 * @param {number} power - Contracted power (kVA)
 * @param {number} tariffType - 1, 2, or 3
 * @returns {Array} Filtered offers
 */
export function filterOffers(prices, conditions, power, tariffType) {
  return prices.filter(row => {
    // Match power (with floating point tolerance)
    const rowPower = parseNumber(row.Pot_Cont);
    if (Math.abs(rowPower - power) > 0.01) return false;
    
    // Match tariff type
    if (row.Contagem !== String(tariffType)) return false;
    
    // Exclude non-domestic segment
    const cond = conditions[row.COD_Proposta];
    if (cond) {
      const segment = cond.Segmento?.toLowerCase().trim() || '';
      if (segment === 'ndom') return false;
    }
    
    // Exclude offers with zero or invalid prices (more strict filtering)
    const fixedRate = parseNumber(row.TF);
    const variableRate = parseNumber(row['TV|TVFV|TVP']);
    
    // Must have at least one valid rate > 0
    if (fixedRate <= 0 && variableRate <= 0) return false;
    
    // Must be electricity supply (not gas)
    const supplyType = row.Fornecimento?.toUpperCase().trim();
    if (supplyType && supplyType !== 'ELE') return false;
    
    // Must have valid proposal code
    if (!row.COD_Proposta || row.COD_Proposta.trim() === '') return false;
    
    return true;
  });
}

/**
 * Compare all offers for a consumption profile.
 * Returns sorted results with full details.
 * 
 * @param {Array} prices - All prices from CSV
 * @param {Object} conditions - Conditions map
 * @param {number} power - Contracted power (kVA)
 * @param {number} consumption - Monthly consumption (kWh)
 * @param {number} tariffType - 1, 2, or 3
 * @param {number} offPeakPercent - Fraction in off-peak (0-1)
 * @param {number} currentPrice - Current monthly price for savings calculation (optional)
 * @returns {Array} Sorted offers with calculated invoices
 */
export function compareOffers(prices, conditions, power, consumption, tariffType, offPeakPercent = DEFAULTS.percentagemVazio, currentPrice = null) {
  const filtered = filterOffers(prices, conditions, power, tariffType);
  
  console.log('🔍 [DEBUG] filterOffers returned:', filtered.length, 'offers');
  
  if (filtered.length === 0) {
    console.warn('⚠️ [DEBUG] No offers matched filters!', {
      power,
      tariffType,
      pricesCount: prices.length
    });
  }
  
  const results = filtered.map(offer => {
    const cond = conditions[offer.COD_Proposta] || {};
    const invoice = calculateInvoice(offer, cond, consumption, tariffType, offPeakPercent);
    
    // Skip offers with invalid totals
    // Minimum total should be at least €5/month (very low consumption scenario)
    // This filters out offers with invalid data or calculation errors
    if (!isFinite(invoice.total) || invoice.total < 5) {
      console.warn('⚠️ [DEBUG] Skipping offer with invalid/too low total:', {
        provider: offer.COM,
        code: offer.COD_Proposta,
        total: invoice.total,
        fixedRate: invoice.fixedRate,
        energyCost: invoice.energyCost,
        powerCost: invoice.powerCost,
        subtotal: invoice.subtotal
      });
      return null; // Will be filtered out
    }
    
    // Extract offer link
    const offerLink = cond.LinkOfertaCom || cond.LinkCOM || '';
    const hasValidLink = offerLink && 
      offerLink !== 'NA' && 
      offerLink !== ' ' && 
      offerLink.startsWith('http');
    
    // Calculate savings if current price is provided
    const savings = currentPrice ? Math.max(0, currentPrice - invoice.total) : 0;
    
    return {
      // Identification
      code: offer.COM,
      offerCode: offer.COD_Proposta, // Use proposal code as offerCode for consistency
      provider: getProviderName(offer.COM),
      providerName: getProviderName(offer.COM), // Alias for app.js compatibility
      proposalCode: offer.COD_Proposta,
      offerName: cond.NomeProposta || 'Tarifa standard',
      name: cond.NomeProposta || 'Tarifa standard',
      
      // Links & contacts
      link: hasValidLink ? offerLink : null,
      phone: cond.ContactoComercialTel || null,
      website: cond.LinkCOM || null,
      
      // Rates (for display)
      fixedRate: invoice.fixedRate,
      variablePeak: invoice.variablePeak,
      variableOffPeak: invoice.variableOffPeak,
      
      // Flags
      hasDiscount: invoice.hasDiscount,
      discountPercent: Math.round(invoice.discountVariable * 100),
      hasLoyalty: (cond['FiltroFidelização'] === 'S' || cond['FiltroFidelizacao'] === 'S'),
      hasServices: invoice.servicesCostMonthly > 0,
      hasNewCustomerDiscount: invoice.newCustomerDiscountMonthly > 0,
      isRenewable: cond['FiltroRenovavel'] === 'S',
      isIndexed: cond['FiltroPrecosIndex'] === 'S',
      
      // Costs
      servicesCostMonthly: invoice.servicesCostMonthly,
      newCustomerDiscountMonthly: invoice.newCustomerDiscountMonthly,
      
      // Totals - ensure never negative and valid
      total: Math.max(5, invoice.total), // Minimum €5 to avoid invalid offers
      totalWithDiscount: Math.max(0, invoice.totalWithDiscount),
      savings: Math.max(0, savings), // Monthly savings vs current price (never negative)
      
      // Full breakdown for detail view
      invoice,
    };
  })
  .filter(result => result !== null); // Remove invalid offers
  
  console.log('🔍 [DEBUG] Valid results after filtering:', results.length);
  
  // Sort by total cost (ascending) - cheapest first
  results.sort((a, b) => a.total - b.total);
  
  // Debug: Log first 3 results
  if (results.length > 0) {
    console.log('🔍 [DEBUG] Top 3 results:');
    results.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.providerName}: €${r.total.toFixed(2)}/mês`, {
        savings: r.savings,
        total: r.total,
        code: r.offerCode
      });
    });
  }
  
  return results;
}

/**
 * Estimate monthly consumption from invoice amount.
 * Used for quick €/month input.
 * 
 * @param {number} monthlyBill - Monthly bill amount (€)
 * @param {number} power - Assumed power (default: 4.6 kVA)
 * @param {number} avgRate - Average €/kWh (default: 0.18)
 * @returns {Object} Estimated profile
 */
export function estimateFromBill(monthlyBill, power = DEFAULTS.potencia, avgRate = 0.18) {
  // Remove VAT
  const withoutVat = monthlyBill / (1 + IVA);
  
  // Estimate fixed costs
  const estimatedFixedDaily = 0.25; // ~€0.25/day average
  const fixedCosts = (estimatedFixedDaily * DIAS_MES) + CONTRIB_AUDIOVISUAL + TAXA_DGEG;
  
  // Remaining is variable (energy)
  const variableCost = withoutVat - fixedCosts;
  
  // Estimate consumption
  const consumption = Math.max(0, Math.round(variableCost / avgRate));
  
  // Debug logging
  console.log('🔍 [DEBUG] estimateFromBill:', {
    monthlyBill,
    withoutVat: withoutVat.toFixed(2),
    fixedCosts: fixedCosts.toFixed(2),
    variableCost: variableCost.toFixed(2),
    avgRate,
    estimatedConsumption: consumption
  });
  
  return {
    consumption,
    power,
    tariffType: DEFAULTS.tipoTarifa,
    confidence: 'estimate',
  };
}

/**
 * Calculate statistics for a set of results.
 * 
 * @param {Array} results - Comparison results
 * @param {number} currentPrice - Current monthly price (optional)
 * @returns {Object} Statistics
 */
export function calculateStats(results, currentPrice = null) {
  if (results.length === 0) {
    return { best: null, worst: null, average: 0, savings: 0, annualSavings: 0 };
  }
  
  const best = results[0];
  const worst = results[results.length - 1];
  const average = results.reduce((sum, r) => sum + r.total, 0) / results.length;
  const yearlySavings = (worst.total - best.total) * 12;
  
  // Calculate annual savings vs current price if provided
  const annualSavings = currentPrice ? (currentPrice - best.total) * 12 : 0;
  
  return {
    best,
    worst,
    average,
    yearlySavings,
    annualSavings, // Savings vs current price
    count: results.length,
  };
}
