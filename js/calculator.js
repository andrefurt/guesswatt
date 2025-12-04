/**
 * Calculator Module
 * Pure business logic for cost calculations, offer filtering, and consumption estimation
 */

import { VAT, DAYS_PER_MONTH, AUDIOVISUAL_TAX, DEFAULT_POWER } from './config.js';

/**
 * Estimate consumption (kWh) from monthly bill amount
 * @param {number} monthlyBill - Monthly bill amount in euros
 * @returns {number} Estimated consumption in kWh
 */
export function estimateConsumption(monthlyBill) {
  // Fórmula inversa: dado o valor da factura, estimar kWh
  // monthlyBill = (fixedTerm + variableTerm + taxes) * VAT
  // Assumindo valores médios, resolver para consumo
  
  const withoutVAT = monthlyBill / VAT;
  const withoutFixed = withoutVAT - (0.25 * DAYS_PER_MONTH) - AUDIOVISUAL_TAX;
  const consumption = withoutFixed / 0.16; // preço médio €/kWh
  
  return Math.max(50, Math.round(consumption)); // mínimo 50 kWh
}

/**
 * Calculate monthly cost for an offer
 * @param {Object} offer - Offer object from CSV
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @returns {number} Monthly cost in euros
 */
export function calculateMonthlyCost(offer, consumption, power) {
  // O CSV tem "TV|TVFV|TVP" como nome do campo, mas quando parseado vira "TV|TVFV|TVP"
  // Para tarifa simples (Contagem=1), usar o primeiro valor deste campo
  const tvField = offer['TV|TVFV|TVP'] || offer.TV || 0;
  const fixedTerm = (offer.TF || 0) * DAYS_PER_MONTH;
  const variableTerm = consumption * tvField;
  const subtotal = fixedTerm + variableTerm + AUDIOVISUAL_TAX;
  return subtotal * VAT;
}

/**
 * Find best offer for simple tariff (Contagem=1)
 * @param {Array<Object>} offers - Array of offer objects
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @returns {Object} Best offer object with monthlyCost property
 * @throws {Error} If no valid offers found
 */
export function findBestOffer(offers, consumption, power) {
  // Filtrar ofertas válidas
  const valid = offers.filter(o => {
    const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
    const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
    return o.TF > 0 && 
           tvField > 0 && 
           potCont === power &&
           o.Contagem === 1; // tarifa simples
  });
  
  if (valid.length === 0) {
    throw new Error('Nenhuma oferta válida encontrada');
  }
  
  // Calcular custo para cada uma
  const withCosts = valid.map(o => ({
    ...o,
    monthlyCost: calculateMonthlyCost(o, consumption, power)
  }));
  
  // Filtrar ofertas com custo válido
  const withValidCosts = withCosts.filter(o => 
    o.monthlyCost > 0 && !isNaN(o.monthlyCost)
  );
  
  if (withValidCosts.length === 0) {
    throw new Error('Nenhuma oferta com custo válido encontrada');
  }
  
  // Ordenar por custo (mais barato primeiro)
  withValidCosts.sort((a, b) => a.monthlyCost - b.monthlyCost);
  
  return withValidCosts[0]; // melhor oferta
}

/**
 * Find best offer for specific tariff type
 * @param {Array<Object>} offers - Array of offer objects
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {number} tariffType - Tariff type (1=simples, 2=bi-horária, 3=tri-horária)
 * @returns {Object} Best offer object with monthlyCost property
 * @throws {Error} If no valid offers found
 */
export function findBestOfferForTariff(offers, consumption, power, tariffType = 1) {
  // Filtrar ofertas válidas
  const valid = offers.filter(o => {
    const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
    const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
    return o.TF > 0 && 
           tvField > 0 && 
           potCont === power &&
           o.Contagem === tariffType; // usar tipo de tarifa fornecido
  });
  
  if (valid.length === 0) {
    throw new Error('Nenhuma oferta válida encontrada');
  }
  
  // Calcular custo para cada uma
  const withCosts = valid.map(o => ({
    ...o,
    monthlyCost: calculateMonthlyCost(o, consumption, power)
  }));
  
  // Filtrar ofertas com custo válido
  const withValidCosts = withCosts.filter(o => 
    o.monthlyCost > 0 && !isNaN(o.monthlyCost)
  );
  
  if (withValidCosts.length === 0) {
    throw new Error('Nenhuma oferta com custo válido encontrada');
  }
  
  // Ordenar por custo (mais barato primeiro)
  withValidCosts.sort((a, b) => a.monthlyCost - b.monthlyCost);
  
  return withValidCosts[0]; // melhor oferta
}

/**
 * Enrich offer with commercial data (tariff name, phone, website)
 * @param {Object} offer - Offer object
 * @param {Array<Object>} conditions - Commercial conditions array
 * @returns {Object} Enriched offer object
 */
export function enrichOffer(offer, conditions) {
  const condition = conditions.find(c => 
    c.COM === offer.COM && 
    c.COD_Proposta === offer.COD_Proposta
  );
  
  return {
    ...offer,
    tariffName: condition?.NomeProposta || offer.COD_Proposta,
    phone: condition?.ContactoComercialTel || null,
    website: condition?.LinkOfertaCom || condition?.LinkCOM || null
  };
}

